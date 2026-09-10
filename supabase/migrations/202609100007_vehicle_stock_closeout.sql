-- Persistent vehicle stock, timed closeout and immutable saved signatures.
begin;
alter table public.inventory_locations drop constraint inventory_locations_kind_check;
alter table public.inventory_locations drop constraint inventory_locations_check;
alter table public.inventory_locations add column vehicle_id uuid;
alter table public.inventory_locations add constraint vehicle_location_fk foreign key(vehicle_id,substation_id) references public.vehicles(id,substation_id);
alter table public.inventory_locations add constraint location_kind check(kind in ('warehouse','shift','vehicle'));
alter table public.inventory_locations add constraint location_owner check(
 (kind='warehouse' and shift_id is null and vehicle_id is null) or
 (kind='shift' and shift_id is not null and vehicle_id is null) or
 (kind='vehicle' and shift_id is null and vehicle_id is not null));
create unique index one_vehicle_location on public.inventory_locations(vehicle_id) where kind='vehicle';
alter table public.inventory_operations drop constraint inventory_operations_kind_check;
alter table public.inventory_operations add constraint operation_kind check(kind in ('receipt','initial','issue','return','consumption','vehicle_migration','closeout'));
alter table public.shifts add column closed_at timestamptz;
alter table public.shifts add column final_closeout_id uuid references public.closeout_versions(id);
alter table public.shifts add column submitted_closeout_id uuid references public.closeout_versions(id);

-- Immutable responsibility snapshots, distinct from the permanent vehicle balance.
create table public.shift_stock_allocations (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null,
 substation_id uuid not null,
 shift_id uuid not null,
 lot_id uuid not null,
 product_id uuid not null,
 quantity numeric not null check(quantity>0 and quantity<=999999999.999),
 product_code text not null, product_name text not null, base_unit text not null,
 quantity_precision integer not null, lot_code text not null, expires_on date,
 source text not null check(source in ('opening','issue')),
 foreign key(shift_id,substation_id) references public.shifts(id,substation_id),
 foreign key(lot_id,substation_id,product_id) references public.stock_lots(id,substation_id,product_id),
 foreign key(substation_id,institution_id) references public.substations(id,institution_id)
);
alter table public.shift_stock_allocations enable row level security;
revoke all on public.shift_stock_allocations from anon,authenticated;
grant select on public.shift_stock_allocations to authenticated;
grant all on public.shift_stock_allocations to service_role;
create policy read_allocations on public.shift_stock_allocations for select to authenticated using(app_private.read_shift(shift_id));
insert into public.shift_stock_allocations
 select l.id,l.institution_id,l.substation_id,s.shift_id,l.lot_id,l.product_id,l.quantity,l.product_code,l.product_name,l.base_unit,l.quantity_precision,l.lot_code,l.expires_on,'issue'
 from public.issue_sheet_lines l join public.issue_sheet_versions s on s.id=l.sheet_id where s.state='accepted';

create function app_private.vehicle_location(p_vehicle uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare loc uuid;
begin
 insert into public.inventory_locations(institution_id,substation_id,kind,vehicle_id)
 select institution_id,substation_id,'vehicle',id from public.vehicles where id=p_vehicle
 on conflict(vehicle_id) where kind='vehicle' do nothing;
 select id into strict loc from public.inventory_locations where vehicle_id=p_vehicle;
 return loc;
end
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
    if v_lot.blocked or v_lot.expires_on < (now() at time zone 'Europe/Bucharest')::date or not v_product.active
      or not exists(select 1 from public.station_product_settings where substation_id=v_op.substation_id and product_id=v_product.id and active) then
      raise exception 'Lot indisponibil pentru predare' using errcode='23514'; end if;
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
-- Move existing stock through the journal; never rewrite historical movements.
do $$ declare r record; op uuid; loc uuid; b record; begin
 for r in select l.id,l.institution_id,l.substation_id,s.owner_id,s.vehicle_id from public.inventory_locations l join public.shifts s on s.id=l.shift_id
 where exists(select 1 from public.stock_balances bal where bal.location_id=l.id and bal.quantity>0) order by l.id loop
  perform 1 from public.institutions where id=r.institution_id for update;
  perform set_config('app.audit_reason','Migrare stoc existent în locația permanentă a mașinii',true);
  loc:=app_private.vehicle_location(r.vehicle_id);
  insert into public.inventory_operations(institution_id,substation_id,kind,request_key,request_payload,actor_id)
  values(r.institution_id,r.substation_id,'vehicle_migration',gen_random_uuid(),jsonb_build_object('legacy_location',r.id),r.owner_id) returning id into op;
  for b in select * from public.stock_balances where location_id=r.id and quantity>0 order by lot_id loop
   perform app_private.move_stock(op,b.lot_id,r.id,loc,b.quantity);
  end loop;
 end loop;
end $$;
create or replace function public.request_shift(p_substation uuid,p_vehicle uuid,p_request_key uuid,p_planned_start timestamp,p_planned_end timestamp) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_institution uuid:=app_private.current_institution(); v_employee uuid; v_name text; v_vehicle public.vehicles; v_existing public.shifts; v_payload jsonb; v_id uuid;
begin
  if not app_private.can_access_station(p_substation) then raise exception 'Substație inaccesibilă' using errcode='42501'; end if;
  perform 1 from public.institutions where id=v_institution for update;
  if not app_private.can_access_station(p_substation) then raise exception 'Acces revocat' using errcode='42501'; end if;
  if p_request_key is null then raise exception 'Cheie obligatorie' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('station',p_substation,'vehicle',p_vehicle,'start',p_planned_start,'end',p_planned_end);
  select * into v_existing from public.shifts where owner_id=auth.uid() and request_key=p_request_key;
  if found then
    if v_existing.request_payload<>v_payload then raise exception 'Cheie reutilizată cu alt conținut' using errcode='22023'; end if;
    return v_existing.id;
  end if;
  if p_planned_start is null or p_planned_end is null or p_planned_end<=p_planned_start
    or p_planned_end at time zone 'Europe/Bucharest' <= clock_timestamp() then
    raise exception 'Stabilește intervalul turei, cu finalul în viitor' using errcode='22023'; end if;
  select employee_id,display_name into v_employee,v_name from public.resolve_my_holder(p_substation);
  if v_employee is null then raise exception 'Nu ești titular eligibil' using errcode='42501'; end if;
  select * into v_vehicle from public.vehicles where id=p_vehicle and substation_id=p_substation and active and operational for update;
  if not found then raise exception 'Mașină indisponibilă' using errcode='23514'; end if;
  perform set_config('app.audit_reason','Cerere proprie de pornire a turei',true);
  insert into public.shifts(institution_id,substation_id,employee_id,owner_id,vehicle_id,holder_name,vehicle_identifier,state,request_key,request_payload,planned_start,planned_end)
    values(v_institution,p_substation,v_employee,auth.uid(),p_vehicle,v_name,v_vehicle.identifier,'awaiting_issue',p_request_key,v_payload,p_planned_start at time zone 'Europe/Bucharest',p_planned_end at time zone 'Europe/Bucharest') returning id into v_id;
  return v_id;
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
    if v_quantity is null or v_quantity<=0 or v_quantity>999999999.999 or v_quantity<>trunc(v_quantity,v_product.quantity_precision) or not v_product.active or v_lot.blocked
      or v_lot.expires_on < (now() at time zone 'Europe/Bucharest')::date or not exists(select 1 from public.station_product_settings where product_id=v_lot.product_id and substation_id=v_shift.substation_id and active) then
      raise exception 'Lot sau cantitate indisponibilă pentru predare' using errcode='23514'; end if;
    insert into public.issue_sheet_lines(institution_id,substation_id,sheet_id,lot_id,product_id,quantity,product_code,product_name,base_unit,quantity_precision,lot_code,expires_on)
      values(v_shift.institution_id,v_shift.substation_id,v_id,v_lot.id,v_product.id,v_quantity,v_product.code,v_product.name,v_product.base_unit,v_product.quantity_precision,v_lot.lot_code,v_lot.expires_on);
  end loop;
  if v_shift.started_at is null then update public.shifts set state=case when p_send then 'awaiting_acceptance' else 'awaiting_issue' end where id=p_shift; end if;
  return v_id;
end
$$;
create or replace function public.accept_issue_sheet(p_sheet uuid,p_request_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_sheet public.issue_sheet_versions; v_shift public.shifts; v_op public.inventory_operations; v_existing uuid; v_operation uuid; v_location uuid; v_warehouse uuid; v_line public.issue_sheet_lines;
begin
  select * into v_sheet from public.issue_sheet_versions where id=p_sheet;
  if not found or not app_private.owns_shift(v_sheet.shift_id) then raise exception 'Numai titularul propriu poate accepta' using errcode='42501'; end if;
  v_shift:=app_private.lock_shift_actor(v_sheet.shift_id,false,'Acceptarea versiunii exacte a fișei');
  if not app_private.owns_shift(v_shift.id) or p_request_key is null then raise exception 'Acceptare refuzată' using errcode='42501'; end if;
  select * into strict v_sheet from public.issue_sheet_versions where id=p_sheet;
  select * into v_op from public.inventory_operations where substation_id=v_shift.substation_id and request_key=p_request_key;
  if found and (v_op.actor_id<>auth.uid() or v_op.request_payload<>jsonb_build_object('sheet',p_sheet)) then raise exception 'Cheie reutilizată cu alt conținut' using errcode='22023'; end if;
  select operation_id into v_existing from public.issue_sheet_acceptances where sheet_id=p_sheet;
  if found then return v_existing; end if;
  if v_sheet.state<>'sent' or (v_sheet.kind='initial' and v_shift.state<>'awaiting_acceptance') or (v_sheet.kind='supplement' and v_shift.state<>'open') then
    raise exception 'Fișa nu mai poate fi acceptată' using errcode='23514'; end if;
  if not exists(select 1 from public.resolve_my_holder(v_shift.substation_id) h where h.employee_id=v_shift.employee_id)
    or not exists(select 1 from public.vehicles where id=v_shift.vehicle_id and active and operational) then
    raise exception 'Titular sau mașină neeligibilă' using errcode='42501'; end if;
  insert into public.inventory_operations(institution_id,substation_id,kind,request_key,request_payload,actor_id)
    values(v_shift.institution_id,v_shift.substation_id,'issue',p_request_key,jsonb_build_object('sheet',p_sheet),auth.uid()) returning id into v_operation;
  v_warehouse:=app_private.warehouse_location(v_shift.substation_id);
  v_location:=app_private.vehicle_location(v_shift.vehicle_id);
  if v_sheet.kind='initial' then
    if v_shift.planned_end is null or v_shift.planned_end<=clock_timestamp() then
      raise exception 'Intervalul turei lipsește sau s-a încheiat' using errcode='23514'; end if;
    insert into public.shift_stock_allocations(institution_id,substation_id,shift_id,lot_id,product_id,quantity,product_code,product_name,base_unit,quantity_precision,lot_code,expires_on,source)
    select v_shift.institution_id,v_shift.substation_id,v_shift.id,b.lot_id,b.product_id,b.quantity,p.code,p.name,p.base_unit,p.quantity_precision,l.lot_code,l.expires_on,'opening'
    from public.stock_balances b join public.stock_lots l on l.id=b.lot_id join public.products p on p.id=b.product_id
    where b.location_id=v_location and b.quantity>0;
  end if;
  for v_line in select * from public.issue_sheet_lines where sheet_id=p_sheet order by lot_id loop
    perform app_private.move_stock(v_operation,v_line.lot_id,v_warehouse,v_location,v_line.quantity);
  end loop;
  insert into public.shift_stock_allocations
    select l.id,l.institution_id,l.substation_id,v_shift.id,l.lot_id,l.product_id,l.quantity,l.product_code,l.product_name,l.base_unit,l.quantity_precision,l.lot_code,l.expires_on,'issue'
    from public.issue_sheet_lines l where l.sheet_id=p_sheet;
  insert into public.issue_sheet_acceptances(institution_id,substation_id,sheet_id,operation_id,actor_id)
    values(v_shift.institution_id,v_shift.substation_id,p_sheet,v_operation,auth.uid());
  update public.issue_sheet_versions set state='accepted' where id=p_sheet;
  if v_sheet.kind='initial' then update public.shifts set state='open',started_at=now(),operational_date=(now() at time zone 'Europe/Bucharest')::date where id=v_shift.id; end if;
  return v_operation;
end
$$;
create or replace function app_private.closeout_allocations(p_shift uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('allocation_id',l.id,'lot_id',l.lot_id,
    'product_code',l.product_code,'product_name',l.product_name,'base_unit',l.base_unit,
    'quantity_precision',l.quantity_precision,'lot_code',l.lot_code,'expires_on',l.expires_on,
    'issued',l.quantity) order by l.id),'[]'::jsonb)
  from public.shift_stock_allocations l where l.shift_id=p_shift
$$;
create or replace function public.save_closeout_draft(p_shift uuid,p_expected_version uuid,p_request_key uuid,p_lines jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.shifts; existing public.closeout_versions; current_id uuid; allocations jsonb; a jsonb; l jsonb;
  consumed numeric; returned numeric; lines jsonb:='[]'; payload jsonb; content jsonb; v_id uuid:=gen_random_uuid(); v_number integer;
begin
  s:=app_private.lock_shift_actor(p_shift,false,'Salvare ciornă declarație de închidere');
  if not app_private.owns_shift(s.id) then raise exception 'Numai titularul completează declarația proprie' using errcode='42501'; end if;
  if p_request_key is null or jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Declarație nevalidă' using errcode='22023'; end if;
  payload:=jsonb_build_object('expected',p_expected_version,'lines',p_lines);
  select * into existing from public.closeout_versions where shift_id=p_shift and request_key=p_request_key;
  if found then
    if existing.author_id<>auth.uid() or existing.request_payload<>payload then raise exception 'Cheie reutilizată' using errcode='22023'; end if;
    return existing.id;
  end if;
  if s.state<>'open' then raise exception 'Tura nu permite declarații' using errcode='23514'; end if;
  select id into current_id from public.closeout_versions where shift_id=p_shift order by version desc limit 1;
  if current_id is distinct from p_expected_version then raise exception 'Ciorna a fost schimbată; reîncarcă pagina' using errcode='23514'; end if;
  allocations:=app_private.closeout_allocations(p_shift);
  if jsonb_array_length(p_lines)<>jsonb_array_length(allocations) or jsonb_array_length(allocations)=0
    or (select count(distinct value->>'allocation_id') from jsonb_array_elements(p_lines))<>jsonb_array_length(p_lines) then
    raise exception 'Completează fiecare alocare o singură dată' using errcode='23514'; end if;
  for a in select value from jsonb_array_elements(allocations) loop
    select value into l from jsonb_array_elements(p_lines) where value->>'allocation_id'=a->>'allocation_id';
    if l is null or (l->>'consumed') is null or (l->>'returned') is null
      or l->>'consumed' !~ '^\d{1,9}(\.\d{1,3})?$' or l->>'returned' !~ '^\d{1,9}(\.\d{1,3})?$' then
      raise exception 'Cantități nevalide' using errcode='22023'; end if;
    consumed:=(l->>'consumed')::numeric; returned:=(l->>'returned')::numeric;
    if consumed+returned>(a->>'issued')::numeric or consumed<>trunc(consumed,(a->>'quantity_precision')::integer)
      or returned<>trunc(returned,(a->>'quantity_precision')::integer) then raise exception 'Cantități neconforme alocării' using errcode='23514'; end if;
    lines:=lines||jsonb_build_array(a||jsonb_build_object('consumed',consumed,'returned',returned,'remaining',(a->>'issued')::numeric-consumed-returned));
  end loop;
  select coalesce(max(version),0)+1 into v_number from public.closeout_versions where shift_id=p_shift;
  content:=jsonb_build_object('id',v_id,'version',v_number,'shift_id',s.id,'substation_id',s.substation_id,
    'holder_name',s.holder_name,'owner_id',s.owner_id,'vehicle',s.vehicle_identifier,'started_at',s.started_at,
    'planned_end',s.planned_end,'stock_model','vehicle','operational_date',s.operational_date,'lines',lines);
  insert into public.closeout_versions(id,institution_id,substation_id,shift_id,version,author_id,request_key,request_payload,content,content_hash,allocations)
    values(v_id,s.institution_id,s.substation_id,s.id,v_number,auth.uid(),p_request_key,payload,content,
      encode(sha256(convert_to(content::text,'UTF8')),'hex'),allocations);
  return v_id;
end
$$;
create or replace function app_private.current_closeout(p_version uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.closeout_versions v join public.shifts s on s.id=v.shift_id
    where v.id=p_version and (s.state='open' or (s.state='pending_close' and s.submitted_closeout_id=v.id))
    and not exists(select 1 from public.closeout_versions newer where newer.shift_id=v.shift_id and newer.version>v.version)
    and v.allocations=app_private.closeout_allocations(v.shift_id))
$$;
create or replace function app_private.lock_closeout(p_version uuid,p_reason text) returns public.closeout_versions
language plpgsql security definer set search_path='' as $$
declare v public.closeout_versions; s public.shifts;
begin
  select * into v from public.closeout_versions where id=p_version;
  if not found then raise exception 'Ciornă inaccesibilă' using errcode='42501'; end if;
  s:=app_private.lock_shift_actor(v.shift_id,false,p_reason);
  if not app_private.owns_shift(s.id) and not app_private.can_operate_stock(s.substation_id) then
    raise exception 'Colectare refuzată' using errcode='42501'; end if;
  if s.state<>'open' then raise exception 'Declarația trimisă nu mai permite modificări' using errcode='23514'; end if;
  if not app_private.current_closeout(v.id) then raise exception 'Versiune schimbată sau suplimentare nouă; salvează o ciornă nouă' using errcode='23514'; end if;
  return v;
end
$$;
create or replace function public.remove_draft_evidence(p_evidence uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.evidence_files;
begin
  select * into e from public.evidence_files where id=p_evidence;
  if not found then raise exception 'Dovadă inaccesibilă' using errcode='42501'; end if;
  perform app_private.lock_closeout(e.version_id,'Eliminare dovadă din ciornă');
  select * into strict e from public.evidence_files where id=p_evidence for update;
  if e.kind='signature' and e.state='validated' then raise exception 'Semnătura salvată se păstrează pe versiunea semnată' using errcode='23514'; end if;
  update public.evidence_files set state='removed',removed_at=now() where id=e.id and state<>'removed';
  return e.id;
end
$$;
create or replace function public.closeout_readiness(p_version uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v public.closeout_versions; policy text; count_valid integer; balanced boolean; current_version boolean;
begin
  select * into v from public.closeout_versions where id=p_version;
  if not found or not app_private.read_shift(v.shift_id) then raise exception 'Ciornă inaccesibilă' using errcode='42501'; end if;
  select evidence_policy into policy from public.substations where id=v.substation_id;
  select count(*) into count_valid from public.evidence_files e where e.version_id=v.id and e.state='validated' and e.content_hash=v.content_hash
    and exists(select 1 from storage.objects o where o.bucket_id='shift-evidence' and o.name=e.object_path and (o.metadata->>'size')::bigint=e.byte_size and o.metadata->>'mimetype'=e.mime_type);
  select bool_and((value->>'consumed')::numeric+(value->>'returned')::numeric+(value->>'remaining')::numeric=(value->>'issued')::numeric and (value->>'remaining')::numeric>=0) into balanced from jsonb_array_elements(v.content->'lines');
  current_version:=app_private.current_closeout(v.id);
  return jsonb_build_object('current',current_version,'balanced',balanced,'policy',policy,'evidence_count',count_valid,
    'ready',current_version and coalesce(balanced,false) and v.content->>'stock_model'='vehicle' and (policy='optional' or count_valid>0));
end
$$;

-- Final stock posting; only called by authorized public commands holding the institution lock.
create function app_private.finalize_vehicle_closeout(p_version uuid,p_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.closeout_versions; s public.shifts; op uuid; loc uuid; wh uuid; l jsonb;
begin
 select * into strict v from public.closeout_versions where id=p_version;
 select * into strict s from public.shifts where id=v.shift_id;
 if s.planned_end is null or clock_timestamp()<s.planned_end then raise exception 'Tura nu a ajuns la finalul programat' using errcode='23514'; end if;
 if not coalesce((public.closeout_readiness(v.id)->>'ready')::boolean,false) then raise exception 'Declarația sau dovezile nu sunt pregătite' using errcode='23514'; end if;
 loc:=app_private.vehicle_location(s.vehicle_id); wh:=app_private.warehouse_location(s.substation_id);
 insert into public.inventory_operations(institution_id,substation_id,kind,request_key,request_payload,actor_id)
 values(s.institution_id,s.substation_id,'closeout',p_key,jsonb_build_object('closeout',v.id),auth.uid()) returning id into op;
 for l in select value from jsonb_array_elements(v.content->'lines') order by value->>'lot_id',value->>'allocation_id' loop
  if (l->>'consumed')::numeric>0 then perform app_private.move_stock(op,(l->>'lot_id')::uuid,loc,null,(l->>'consumed')::numeric); end if;
  if (l->>'returned')::numeric>0 then perform app_private.move_stock(op,(l->>'lot_id')::uuid,loc,wh,(l->>'returned')::numeric); end if;
 end loop;
 update public.issue_sheet_versions set state='withdrawn',note='Închidere tură înainte de acceptarea suplimentării' where shift_id=s.id and state in ('draft','sent','disputed');
 update public.shifts set state='closed',closed_at=clock_timestamp(),final_closeout_id=v.id where id=s.id;
 return s.id;
end
$$;
create function public.submit_vehicle_closeout(p_version uuid,p_request_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.closeout_versions; s public.shifts;
begin
 select * into v from public.closeout_versions where id=p_version;
 if not found then raise exception 'Declarație inaccesibilă' using errcode='42501'; end if;
 s:=app_private.lock_shift_actor(v.shift_id,false,'Închidere declarată de titular');
 if not app_private.owns_shift(s.id) or p_request_key is null then raise exception 'Numai titularul trimite declarația' using errcode='42501'; end if;
 if s.state='closed' and s.final_closeout_id=v.id then return s.id; end if;
 if s.state='pending_close' and s.submitted_closeout_id=v.id then return s.id; end if;
 if s.state<>'open' or s.planned_end is null or clock_timestamp()<s.planned_end then raise exception 'Tura nu a ajuns la finalul programat' using errcode='23514'; end if;
 if not coalesce((public.closeout_readiness(v.id)->>'ready')::boolean,false) then raise exception 'Verifică declarația și dovezile' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(v.content->'lines') l where (l->>'returned')::numeric>0) then
  update public.shifts set state='pending_close',submitted_closeout_id=v.id where id=s.id;
  return s.id;
 end if;
 return app_private.finalize_vehicle_closeout(v.id,p_request_key);
end
$$;
create function public.confirm_vehicle_return(p_version uuid,p_request_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.closeout_versions; s public.shifts;
begin
 select * into v from public.closeout_versions where id=p_version;
 if not found then raise exception 'Declarație inaccesibilă' using errcode='42501'; end if;
 s:=app_private.lock_shift_actor(v.shift_id,true,'Confirmare retur fizic în magazie');
 if s.owner_id=auth.uid() or p_request_key is null then raise exception 'Returul se confirmă de un gestionar distinct' using errcode='42501'; end if;
 if s.state='closed' and s.final_closeout_id=v.id then return s.id; end if;
 if s.state<>'pending_close' or s.submitted_closeout_id is distinct from v.id then raise exception 'Returul nu a fost trimis' using errcode='23514'; end if;
 return app_private.finalize_vehicle_closeout(v.id,p_request_key);
end
$$;
-- Older unscheduled shifts receive a schedule once; owners cannot shorten an agreed end.
create function public.set_legacy_shift_schedule(p_shift uuid,p_start timestamp,p_end timestamp) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.shifts;
begin
 s:=app_private.lock_shift_actor(p_shift,false,'Stabilire interval pentru tură existentă fără program');
 if not app_private.owns_shift(s.id) or s.planned_end is not null or s.state not in ('awaiting_issue','awaiting_acceptance','open') then raise exception 'Programul nu poate fi schimbat' using errcode='42501'; end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end at time zone 'Europe/Bucharest'<=clock_timestamp() then raise exception 'Interval nevalid' using errcode='22023'; end if;
 update public.shifts set planned_start=p_start at time zone 'Europe/Bucharest',planned_end=p_end at time zone 'Europe/Bucharest' where id=s.id;
 return s.id;
end
$$;
-- Expose current stock without granting the next holder access to past holders' movements.
create function public.list_vehicle_stock(p_substation uuid,p_vehicle uuid default null)
returns table(vehicle_id uuid,vehicle_identifier text,lot_id uuid,product_name text,base_unit text,lot_code text,expires_on date,blocked boolean,quantity numeric)
language sql stable security definer set search_path='' as $$
 select v.id,v.identifier,l.id,p.name,p.base_unit,l.lot_code,l.expires_on,l.blocked,b.quantity
 from public.vehicles v join public.inventory_locations loc on loc.vehicle_id=v.id
 join public.stock_balances b on b.location_id=loc.id join public.stock_lots l on l.id=b.lot_id join public.products p on p.id=b.product_id
 where v.substation_id=p_substation and (p_vehicle is null or v.id=p_vehicle) and b.quantity>0
 and (app_private.can_view_logistics(p_substation) or exists(select 1 from public.shifts s where s.vehicle_id=v.id and s.state in ('awaiting_issue','awaiting_acceptance','open','pending_close') and app_private.owns_shift(s.id)))
 order by v.identifier,p.name,l.lot_code
$$;
revoke all on function app_private.vehicle_location(uuid),app_private.finalize_vehicle_closeout(uuid,uuid) from public,anon,authenticated;
revoke all on function public.submit_vehicle_closeout(uuid,uuid),public.confirm_vehicle_return(uuid,uuid),public.set_legacy_shift_schedule(uuid,timestamp,timestamp),public.list_vehicle_stock(uuid,uuid) from public,anon,authenticated;
grant execute on function public.submit_vehicle_closeout(uuid,uuid),public.confirm_vehicle_return(uuid,uuid),public.set_legacy_shift_schedule(uuid,timestamp,timestamp),public.list_vehicle_stock(uuid,uuid) to authenticated;
commit;
