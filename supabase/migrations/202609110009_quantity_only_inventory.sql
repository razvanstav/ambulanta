-- Quantity-only warehouse management. Historical stock keys and movements remain unchanged.
begin;
select id from public.institutions order by id for update;
create temporary table quantity_migration_balances on commit drop as select id,quantity from public.stock_balances;
-- Only the medication tracking requirement is removed; measurement and identity stay fixed.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.products'::regclass and contype='c' and pg_get_constraintdef(oid) like '%category%medication%track_lots%' loop
  execute format('alter table public.products drop constraint %I',c.conname);
 end loop;
end $$;
create or replace function app_private.guard_catalog_local() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_product public.products;
begin
  -- Serializes metadata checks with product edits, including privileged imports.
  select * into strict v_product from public.products where id = new.product_id for update;
  if tg_op = 'UPDATE' then
    if row(new.id,new.institution_id,new.substation_id,new.product_id) is distinct from
      row(old.id,old.institution_id,old.substation_id,old.product_id) then
      raise exception 'Apartenența locală este fixă' using errcode = '23514'; end if;
  end if;
  if tg_table_name = 'station_product_settings' then
    if new.minimum_quantity <> trunc(new.minimum_quantity,v_product.quantity_precision) then
      raise exception 'Pragul nu respectă precizia produsului' using errcode = '23514'; end if;
  else
    if tg_op = 'UPDATE' then
      if row(new.lot_code,new.expires_on,new.is_internal) is distinct from row(old.lot_code,old.expires_on,old.is_internal) then
        raise exception 'Identitatea lotului este fixă; blochează lotul incorect' using errcode = '23514'; end if;
    end if;
    if (new.is_internal and (new.lot_code <> 'INTERN' or new.expires_on is not null)) then
      raise exception 'Lotul și expirarea nu respectă produsul' using errcode = '23514'; end if;
  end if;
  return new;
end
$$;
create function app_private.validate_product_lines(p_lines jsonb) returns void
language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)>100
 or exists(select 1 from jsonb_array_elements(p_lines) x where jsonb_typeof(x)<>'object'
   or coalesce(x->>'product_id','') !~ '^[0-9a-fA-F-]{36}$'
   or coalesce(x->>'quantity','') !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$'
   or (x->>'quantity')::numeric<=0)
 or (select count(*)<>count(distinct x->>'product_id') from jsonb_array_elements(p_lines) x)
 then raise exception 'Produse sau cantități nevalide' using errcode='22023'; end if;
end $$;

-- Stable technical key for new receipts; never rewrite historical stock rows.
create function app_private.product_stock_key(p_station uuid,p_product uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.products; k uuid; inst uuid;
begin
 select institution_id into strict inst from public.substations where id=p_station;
 select * into strict p from public.products where id=p_product and institution_id=inst;
 if not p.active or not exists(select 1 from public.station_product_settings where product_id=p_product and substation_id=p_station and active) then
  raise exception 'Produs inactiv' using errcode='23514'; end if;
 select id into k from public.stock_lots where product_id=p_product and substation_id=p_station
  and (is_internal or upper(btrim(lot_code))='INTERN') order by is_internal desc,id limit 1;
 if k is null then
  insert into public.stock_lots(institution_id,substation_id,product_id,lot_code,is_internal)
   values(inst,p_station,p_product,'INTERN',true) returning id into k;
 end if;
 return k;
end $$;

-- Called only under the existing institution/shift lock, after replay detection.
create function app_private.product_issue_lines(p_station uuid,p_lines jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare x jsonb; b record; needed numeric; take numeric; out_lines jsonb:='[]'; p public.products; warehouse uuid;
begin
 perform app_private.validate_product_lines(p_lines);
 warehouse:=app_private.warehouse_location(p_station);
 for x in select value from jsonb_array_elements(p_lines) order by value->>'product_id' loop
  select * into strict p from public.products where id=(x->>'product_id')::uuid
   and institution_id=(select institution_id from public.substations where id=p_station);
  needed:=(x->>'quantity')::numeric;
  if needed<>trunc(needed,p.quantity_precision) or not p.active
   or not exists(select 1 from public.station_product_settings where product_id=p.id and substation_id=p_station and active)
   then raise exception 'Produs sau cantitate nevalidă' using errcode='23514'; end if;
  for b in select lot_id,quantity from public.stock_balances where location_id=warehouse and product_id=p.id and quantity>0 order by lot_id loop
   take:=least(needed,b.quantity);
   if take>0 then out_lines:=out_lines||jsonb_build_array(jsonb_build_object('lot_id',b.lot_id,'quantity',take)); end if;
   needed:=needed-take;
   exit when needed=0;
  end loop;
  if needed>0 then raise exception 'Stoc insuficient pentru produs' using errcode='23514'; end if;
 end loop;
 return out_lines;
end $$;

create function public.save_simple_product(p_substation uuid,p_product uuid,p_code text,p_name text,p_category text,p_base_unit text,p_precision integer,p_active boolean,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.products; k uuid; local_active boolean;
begin
 perform app_private.lock_catalog_station(p_substation,true,p_reason);
 if p_product is not null then select * into strict p from public.products where id=p_product and institution_id=app_private.current_institution(); end if;
 k:=public.save_product(p_substation,p_product,p_code,p_name,p_category,p_base_unit,p_precision,coalesce(p.track_lots,false),coalesce(p.track_expiry,false),p_active,p_reason);
 select active into local_active from public.station_product_settings where product_id=k and substation_id=p_substation;
 if local_active is null then perform public.save_station_product(p_substation,k,0,true,p_reason); local_active:=true; end if;
 if p_active and local_active then perform app_private.product_stock_key(p_substation,k); end if;
 return k;
end $$;

create function public.list_vehicle_product_stock(p_substation uuid,p_vehicle uuid default null)
returns table(vehicle_id uuid,vehicle_identifier text,product_id uuid,product_name text,base_unit text,quantity numeric)
language sql stable security definer set search_path='' as $$
 select s.vehicle_id,s.vehicle_identifier,l.product_id,s.product_name,s.base_unit,sum(s.quantity)
 from public.list_vehicle_stock(p_substation,p_vehicle) s join public.stock_lots l on l.id=s.lot_id
 group by s.vehicle_id,s.vehicle_identifier,l.product_id,s.product_name,s.base_unit
$$;

create or replace function app_private.move_stock(p_operation uuid, p_lot uuid, p_source uuid, p_destination uuid, p_quantity numeric) returns void
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
    if not exists(select 1 from public.inventory_locations where id=p_source and kind='warehouse') or not exists(select 1 from public.inventory_locations where id=p_destination and kind='vehicle') then
      raise exception 'Traseu predare nevalid' using errcode='23514'; end if;
    if not v_product.active
      or not exists(select 1 from public.station_product_settings where substation_id=v_op.substation_id and product_id=v_product.id and active) then
      raise exception 'Produs indisponibil pentru predare' using errcode='23514'; end if;
  end if;
  if v_op.kind='closeout' and (not exists(select 1 from public.inventory_locations where id=p_source and kind='vehicle')
    or (p_destination is not null and not exists(select 1 from public.inventory_locations where id=p_destination and kind='warehouse'))) then
    raise exception 'Traseu închidere nevalid' using errcode='23514'; end if;
  if v_op.kind='vehicle_migration' and (not exists(select 1 from public.inventory_locations where id=p_source and kind='shift')
    or not exists(select 1 from public.inventory_locations where id=p_destination and kind='vehicle')) then
    raise exception 'Traseu migrare nevalid' using errcode='23514'; end if;
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
create or replace function public.save_issue_sheet(p_shift uuid,p_expected_sheet uuid,p_request_key uuid,p_send boolean,p_lines jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_shift public.shifts; v_current public.issue_sheet_versions; v_existing public.issue_sheet_versions; v_id uuid; v_version integer; v_payload jsonb; v_line jsonb; v_lot public.stock_lots; v_product public.products; v_quantity numeric;
begin
  v_shift:=app_private.lock_shift_actor(p_shift,true,p_reason);
  if v_shift.owner_id=auth.uid() then raise exception 'Autorul fișei trebuie să fie distinct de titular' using errcode='42501'; end if;
  if p_request_key is null or p_send is null or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 0 and 100 then raise exception 'Fișă nevalidă' using errcode='22023'; end if;
  if jsonb_array_length(p_lines)=0 and (v_shift.started_at is not null or not exists(select 1 from public.stock_balances b join public.inventory_locations l on l.id=b.location_id where l.vehicle_id=v_shift.vehicle_id and b.quantity>0)) then raise exception 'Fișa fără completare necesită stoc existent în mașină' using errcode='23514'; end if;
  v_payload:=jsonb_build_object('expected',p_expected_sheet,'send',p_send,'lines',p_lines,'reason',btrim(p_reason));
  select * into v_existing from public.issue_sheet_versions where shift_id=p_shift and request_key=p_request_key;
  if found then
    if v_existing.request_payload<>v_payload or v_existing.author_id<>auth.uid() then raise exception 'Cheie reutilizată cu alt conținut' using errcode='22023'; end if;
    return v_existing.id;
  end if;
  if v_shift.state not in ('awaiting_issue','awaiting_acceptance','open') then raise exception 'Tura nu permite fișe noi' using errcode='23514'; end if;
  select * into v_current from public.issue_sheet_versions where shift_id=p_shift and state in ('draft','sent','disputed');
  if v_current.id is distinct from p_expected_sheet then raise exception 'Fișa a fost schimbată; reîncarcă pagina' using errcode='23514'; end if;
  update public.issue_sheet_versions set state='superseded' where id=v_current.id;
  select coalesce(max(version),0)+1 into v_version from public.issue_sheet_versions where shift_id=p_shift;
  insert into public.issue_sheet_versions(institution_id,substation_id,shift_id,version,kind,state,request_key,request_payload,author_id,sent_at,note)
    values(v_shift.institution_id,v_shift.substation_id,p_shift,v_version,case when v_shift.started_at is null then 'initial' else 'supplement' end,
      case when p_send then 'sent' else 'draft' end,p_request_key,v_payload,auth.uid(),case when p_send then now() end,btrim(p_reason)) returning id into v_id;
  for v_line in select value from jsonb_array_elements(p_lines) order by value->>'lot_id' loop
    select * into strict v_lot from public.stock_lots where id=(v_line->>'lot_id')::uuid and substation_id=v_shift.substation_id;
    select * into strict v_product from public.products where id=v_lot.product_id;
    v_quantity:=(v_line->>'quantity')::numeric;
    if v_quantity is null or v_quantity<=0 or v_quantity>999999999.999 or v_quantity<>trunc(v_quantity,v_product.quantity_precision) or not v_product.active or not exists(select 1 from public.station_product_settings where product_id=v_lot.product_id and substation_id=v_shift.substation_id and active) then
      raise exception 'Produs sau cantitate indisponibilă pentru predare' using errcode='23514'; end if;
    insert into public.issue_sheet_lines(institution_id,substation_id,sheet_id,lot_id,product_id,quantity,product_code,product_name,base_unit,quantity_precision,lot_code,expires_on)
      values(v_shift.institution_id,v_shift.substation_id,v_id,v_lot.id,v_product.id,v_quantity,v_product.code,v_product.name,v_product.base_unit,v_product.quantity_precision,v_lot.lot_code,v_lot.expires_on);
  end loop;
  if v_shift.started_at is null then update public.shifts set state=case when p_send then 'awaiting_acceptance' else 'awaiting_issue' end where id=p_shift; end if;
  return v_id;
end
$$;
create or replace function public.save_product_issue_sheet(p_shift uuid,p_expected_sheet uuid,p_request_key uuid,p_send boolean,p_lines jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_shift public.shifts; v_current public.issue_sheet_versions; v_existing public.issue_sheet_versions; v_id uuid; v_version integer; v_payload jsonb; v_line jsonb; v_lot public.stock_lots; v_product public.products; v_quantity numeric;
begin
  v_shift:=app_private.lock_shift_actor(p_shift,true,p_reason);
  if v_shift.owner_id=auth.uid() then raise exception 'Autorul fișei trebuie să fie distinct de titular' using errcode='42501'; end if;
  if p_request_key is null or p_send is null or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 0 and 100 then raise exception 'Fișă nevalidă' using errcode='22023'; end if;
  if jsonb_array_length(p_lines)=0 and (v_shift.started_at is not null or not exists(select 1 from public.stock_balances b join public.inventory_locations l on l.id=b.location_id where l.vehicle_id=v_shift.vehicle_id and b.quantity>0)) then raise exception 'Fișa fără completare necesită stoc existent în mașină' using errcode='23514'; end if;
  v_payload:=jsonb_build_object('expected',p_expected_sheet,'send',p_send,'lines',p_lines,'reason',btrim(p_reason));
  select * into v_existing from public.issue_sheet_versions where shift_id=p_shift and request_key=p_request_key;
  if found then
    if v_existing.request_payload<>v_payload or v_existing.author_id<>auth.uid() then raise exception 'Cheie reutilizată cu alt conținut' using errcode='22023'; end if;
    return v_existing.id;
  end if;
  if v_shift.state not in ('awaiting_issue','awaiting_acceptance','open') then raise exception 'Tura nu permite fișe noi' using errcode='23514'; end if;
  select * into v_current from public.issue_sheet_versions where shift_id=p_shift and state in ('draft','sent','disputed');
  if v_current.id is distinct from p_expected_sheet then raise exception 'Fișa a fost schimbată; reîncarcă pagina' using errcode='23514'; end if;
  update public.issue_sheet_versions set state='superseded' where id=v_current.id;
  select coalesce(max(version),0)+1 into v_version from public.issue_sheet_versions where shift_id=p_shift;
  insert into public.issue_sheet_versions(institution_id,substation_id,shift_id,version,kind,state,request_key,request_payload,author_id,sent_at,note)
    values(v_shift.institution_id,v_shift.substation_id,p_shift,v_version,case when v_shift.started_at is null then 'initial' else 'supplement' end,
      case when p_send then 'sent' else 'draft' end,p_request_key,v_payload,auth.uid(),case when p_send then now() end,btrim(p_reason)) returning id into v_id;
  for v_line in select value from jsonb_array_elements(app_private.product_issue_lines(v_shift.substation_id,p_lines)) order by value->>'lot_id' loop
    select * into strict v_lot from public.stock_lots where id=(v_line->>'lot_id')::uuid and substation_id=v_shift.substation_id;
    select * into strict v_product from public.products where id=v_lot.product_id;
    v_quantity:=(v_line->>'quantity')::numeric;
    if v_quantity is null or v_quantity<=0 or v_quantity>999999999.999 or v_quantity<>trunc(v_quantity,v_product.quantity_precision) or not v_product.active or not exists(select 1 from public.station_product_settings where product_id=v_lot.product_id and substation_id=v_shift.substation_id and active) then
      raise exception 'Produs sau cantitate indisponibilă pentru predare' using errcode='23514'; end if;
    insert into public.issue_sheet_lines(institution_id,substation_id,sheet_id,lot_id,product_id,quantity,product_code,product_name,base_unit,quantity_precision,lot_code,expires_on)
      values(v_shift.institution_id,v_shift.substation_id,v_id,v_lot.id,v_product.id,v_quantity,v_product.code,v_product.name,v_product.base_unit,v_product.quantity_precision,v_lot.lot_code,v_lot.expires_on);
  end loop;
  if v_shift.started_at is null then update public.shifts set state=case when p_send then 'awaiting_acceptance' else 'awaiting_issue' end where id=p_shift; end if;
  return v_id;
end
$$;
create or replace function public.post_product_receipt(p_substation uuid,p_request_key uuid,p_document_number text,p_document_date date,p_supplier text,p_initial boolean,p_lines jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid; v_payload jsonb; v_existing public.inventory_operations; v_op uuid; v_receipt uuid; v_warehouse uuid; v_key uuid; v_line jsonb; v_lot public.stock_lots; v_quantity numeric;
begin
  v_institution := app_private.lock_stock_operator(p_substation,p_reason);
  if p_request_key is null or p_initial is null or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Cerere nevalidă' using errcode='22023'; end if;
  perform app_private.validate_product_lines(p_lines);
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
  for v_line in select value from jsonb_array_elements(p_lines) order by value->>'product_id' loop
    v_key:=app_private.product_stock_key(p_substation,(v_line->>'product_id')::uuid);
    select * into strict v_lot from public.stock_lots where id=v_key and substation_id=p_substation;
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
revoke all on function app_private.validate_product_lines(jsonb), app_private.product_stock_key(uuid,uuid), app_private.product_issue_lines(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.save_simple_product(uuid,uuid,text,text,text,text,integer,boolean,text), public.post_product_receipt(uuid,uuid,text,date,text,boolean,jsonb,text), public.save_product_issue_sheet(uuid,uuid,uuid,boolean,jsonb,text), public.list_vehicle_product_stock(uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_simple_product(uuid,uuid,text,text,text,text,integer,boolean,text), public.post_product_receipt(uuid,uuid,text,date,text,boolean,jsonb,text), public.save_product_issue_sheet(uuid,uuid,uuid,boolean,jsonb,text), public.list_vehicle_product_stock(uuid,uuid) to authenticated;
do $$ begin
 if exists(select id,quantity from public.stock_balances except select id,quantity from quantity_migration_balances)
 or exists(select id,quantity from quantity_migration_balances except select id,quantity from public.stock_balances)
 then raise exception 'Migrarea nu trebuie să modifice soldurile'; end if;
end $$;
commit;
