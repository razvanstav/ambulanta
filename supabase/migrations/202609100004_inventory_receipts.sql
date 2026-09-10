-- M05: single transactional stock engine and idempotent receipts.
begin;
create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  kind text not null check (kind in ('warehouse','shift')),
  shift_id uuid,
  unique (id,substation_id),
  unique (shift_id),
  check ((kind = 'warehouse' and shift_id is null) or (kind = 'shift' and shift_id is not null)),
  foreign key (substation_id,institution_id) references public.substations(id,institution_id)
);
create unique index one_warehouse on public.inventory_locations(substation_id) where kind = 'warehouse';
create table public.inventory_operations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  kind text not null check (kind in ('receipt','initial','issue','return','consumption')),
  request_key uuid not null,
  request_payload jsonb not null,
  actor_id uuid not null references public.profiles(id),
  occurred_at timestamptz not null default now(),
  unique (substation_id,request_key),
  unique (id,substation_id),
  foreign key (substation_id,institution_id) references public.substations(id,institution_id)
);
create table public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  location_id uuid not null,
  lot_id uuid not null,
  product_id uuid not null,
  quantity numeric not null check (quantity >= 0 and quantity <= 999999999.999),
  unique (location_id,lot_id),
  foreign key (location_id,substation_id) references public.inventory_locations(id,substation_id),
  foreign key (lot_id,substation_id,product_id) references public.stock_lots(id,substation_id,product_id),
  foreign key (substation_id,institution_id) references public.substations(id,institution_id)
);
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  operation_id uuid not null,
  lot_id uuid not null,
  product_id uuid not null,
  source_id uuid,
  destination_id uuid,
  quantity numeric not null check (quantity > 0 and quantity <= 999999999.999),
  check (source_id is distinct from destination_id),
  foreign key (operation_id,substation_id) references public.inventory_operations(id,substation_id),
  foreign key (source_id,substation_id) references public.inventory_locations(id,substation_id),
  foreign key (destination_id,substation_id) references public.inventory_locations(id,substation_id),
  foreign key (lot_id,substation_id,product_id) references public.stock_lots(id,substation_id,product_id),
  foreign key (substation_id,institution_id) references public.substations(id,institution_id)
);
create index movements_station on public.inventory_movements(substation_id,operation_id);
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  operation_id uuid not null unique,
  document_number text not null check (length(btrim(document_number)) between 1 and 80),
  document_date date not null check (document_date between date '1900-01-01' and date '9999-12-31'),
  supplier text not null check (length(btrim(supplier)) between 2 and 150),
  reason text not null check (length(btrim(reason)) between 5 and 500),
  unique (id,substation_id),
  foreign key (operation_id,substation_id) references public.inventory_operations(id,substation_id),
  foreign key (substation_id,institution_id) references public.substations(id,institution_id)
);
create table public.receipt_lines (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  receipt_id uuid not null,
  lot_id uuid not null,
  product_id uuid not null,
  quantity numeric not null check (quantity > 0 and quantity <= 999999999.999),
  unique (receipt_id,lot_id),
  foreign key (receipt_id,substation_id) references public.receipts(id,substation_id),
  foreign key (lot_id,substation_id,product_id) references public.stock_lots(id,substation_id,product_id),
  foreign key (substation_id,institution_id) references public.substations(id,institution_id)
);

create function app_private.can_operate_stock(p_station uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.can_view_logistics(p_station) and exists(select 1 from public.role_assignments r
    where r.user_id = auth.uid() and r.institution_id = app_private.current_institution()
    and (r.role in ('administrator','logistics') or (r.role = 'warehouse' and r.substation_id = p_station)))
$$;
create function app_private.lock_stock_operator(p_station uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid;
begin
  if not app_private.can_operate_stock(p_station) then raise exception 'Operație de magazie refuzată' using errcode = '42501'; end if;
  v_institution := app_private.lock_catalog_station(p_station,false,p_reason);
  if not app_private.can_operate_stock(p_station) then raise exception 'Drepturi revocate' using errcode = '42501'; end if;
  return v_institution;
end
$$;
create function app_private.warehouse_location(p_station uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.inventory_locations(institution_id,substation_id,kind)
    select institution_id,id,'warehouse' from public.substations where id=p_station
    on conflict (substation_id) where kind='warehouse' do nothing;
  select id into strict v_id from public.inventory_locations where substation_id=p_station and kind='warehouse';
  return v_id;
end
$$;
-- Internal-only engine. Commands lock the institution first, then rows in stable order.
-- NULL source means external receipt; NULL destination is consumed stock (future M08).
create function app_private.move_stock(p_operation uuid, p_lot uuid, p_source uuid, p_destination uuid, p_quantity numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare v_op public.inventory_operations; v_lot public.stock_lots; v_product public.products; v_location uuid;
begin
  select * into strict v_op from public.inventory_operations where id=p_operation;
  select * into strict v_lot from public.stock_lots where id=p_lot and substation_id=v_op.substation_id;
  select * into strict v_product from public.products where id=v_lot.product_id;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 999999999.999 or p_quantity <> trunc(p_quantity,v_product.quantity_precision)
    or p_source is not distinct from p_destination then raise exception 'Cantitate sau traseu nevalid' using errcode='23514'; end if;
  if v_op.kind in ('receipt','initial') and (p_source is not null or not exists(select 1 from public.inventory_locations where id=p_destination and kind='warehouse')) then
    raise exception 'Traseu recepție nevalid' using errcode='23514'; end if;
  if v_op.kind='issue' then
    if not exists(select 1 from public.inventory_locations where id=p_source and kind='warehouse') or not exists(select 1 from public.inventory_locations where id=p_destination and kind='shift') then
      raise exception 'Traseu predare nevalid' using errcode='23514'; end if;
    if v_lot.blocked or v_lot.expires_on < (now() at time zone 'Europe/Bucharest')::date or not v_product.active
      or not exists(select 1 from public.station_product_settings where substation_id=v_op.substation_id and product_id=v_product.id and active) then
      raise exception 'Lot indisponibil pentru predare' using errcode='23514'; end if;
  end if;
  for v_location in select id from public.inventory_locations where id in (p_source,p_destination) order by id loop
    insert into public.stock_balances(institution_id,substation_id,location_id,lot_id,product_id,quantity)
      values(v_op.institution_id,v_op.substation_id,v_location,p_lot,v_product.id,0) on conflict(location_id,lot_id) do nothing;
    perform 1 from public.stock_balances where location_id=v_location and lot_id=p_lot for update;
  end loop;
  if p_source is not null then
    update public.stock_balances set quantity=quantity-p_quantity where location_id=p_source and lot_id=p_lot and quantity>=p_quantity;
    if not found then raise exception 'Stoc insuficient' using errcode='23514'; end if;
  end if;
  if p_destination is not null then
    update public.stock_balances set quantity=quantity+p_quantity where location_id=p_destination and lot_id=p_lot;
    if not found then raise exception 'Destinație inaccesibilă' using errcode='23514'; end if;
  end if;
  insert into public.inventory_movements(institution_id,substation_id,operation_id,lot_id,product_id,source_id,destination_id,quantity)
    values(v_op.institution_id,v_op.substation_id,p_operation,p_lot,v_product.id,p_source,p_destination,p_quantity);
end
$$;
create function public.post_receipt(p_substation uuid,p_request_key uuid,p_document_number text,p_document_date date,p_supplier text,p_initial boolean,p_lines jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid; v_payload jsonb; v_existing public.inventory_operations; v_op uuid; v_receipt uuid; v_warehouse uuid; v_line jsonb; v_lot public.stock_lots; v_quantity numeric;
begin
  v_institution := app_private.lock_stock_operator(p_substation,p_reason);
  if p_request_key is null or p_initial is null or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Cerere nevalidă' using errcode='22023'; end if;
  v_payload := jsonb_build_object('document',btrim(p_document_number),'date',p_document_date,'supplier',btrim(p_supplier),'initial',p_initial,'lines',p_lines,'reason',btrim(p_reason));
  select * into v_existing from public.inventory_operations where substation_id=p_substation and request_key=p_request_key;
  if found then
    if v_existing.actor_id <> auth.uid() or v_existing.request_payload <> v_payload then raise exception 'Cheia a fost folosită pentru altă cerere' using errcode='22023'; end if;
    select id into strict v_receipt from public.receipts where operation_id=v_existing.id;
    return v_receipt;
  end if;
  insert into public.inventory_operations(institution_id,substation_id,kind,request_key,request_payload,actor_id)
    values(v_institution,p_substation,case when p_initial then 'initial' else 'receipt' end,p_request_key,v_payload,auth.uid()) returning id into v_op;
  insert into public.receipts(institution_id,substation_id,operation_id,document_number,document_date,supplier,reason)
    values(v_institution,p_substation,v_op,btrim(p_document_number),p_document_date,btrim(p_supplier),btrim(p_reason)) returning id into v_receipt;
  v_warehouse := app_private.warehouse_location(p_substation);
  for v_line in select value from jsonb_array_elements(p_lines) order by value->>'lot_id' loop
    select * into strict v_lot from public.stock_lots where id=(v_line->>'lot_id')::uuid and substation_id=p_substation;
    if not exists(select 1 from public.products where id=v_lot.product_id and active) or not exists(select 1 from public.station_product_settings where product_id=v_lot.product_id and substation_id=p_substation and active) then
      raise exception 'Produs inactiv' using errcode='23514'; end if;
    v_quantity := (v_line->>'quantity')::numeric;
    insert into public.receipt_lines(institution_id,substation_id,receipt_id,lot_id,product_id,quantity)
      values(v_institution,p_substation,v_receipt,v_lot.id,v_lot.product_id,v_quantity);
    perform app_private.move_stock(v_op,v_lot.id,null,v_warehouse,v_quantity);
  end loop;
  return v_receipt;
end
$$;

-- Immutable to application roles: mutations exist only inside the insert-only commands.
do $$ declare v_table text; begin
  foreach v_table in array array['inventory_locations','inventory_operations','stock_balances','inventory_movements','receipts','receipt_lines'] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all on public.%I from anon, authenticated',v_table);
    execute format('grant select on public.%I to authenticated',v_table);
    execute format('grant all on public.%I to service_role',v_table);
    execute format('create policy read_logistics on public.%I for select to authenticated using (app_private.can_view_logistics(substation_id))',v_table);
  end loop;
end $$;
create trigger audit_inventory_operations after insert on public.inventory_operations for each row execute function app_private.write_audit();
revoke execute on function app_private.can_operate_stock(uuid),app_private.lock_stock_operator(uuid,text),app_private.warehouse_location(uuid),app_private.move_stock(uuid,uuid,uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function app_private.can_operate_stock(uuid) to authenticated,service_role;
revoke execute on function public.post_receipt(uuid,uuid,text,date,text,boolean,jsonb,text) from public,anon,authenticated;
grant execute on function public.post_receipt(uuid,uuid,text,date,text,boolean,jsonb,text) to authenticated;
commit;
