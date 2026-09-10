-- M06: own requests, vehicle reservation, versioned sheets and atomic acceptance.
begin;
alter table public.vehicles add constraint vehicles_id_station_unique unique(id,substation_id);
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  employee_id uuid not null,
  owner_id uuid not null,
  vehicle_id uuid not null,
  holder_name text not null,
  vehicle_identifier text not null,
  state text not null check(state in ('awaiting_issue','awaiting_acceptance','open','pending_close','closed','cancelled')),
  request_key uuid not null,
  request_payload jsonb not null,
  requested_at timestamptz not null default now(),
  planned_start timestamptz,
  planned_end timestamptz,
  started_at timestamptz,
  operational_date date,
  unique(id,substation_id),
  unique(owner_id,request_key),
  check ((planned_start is null and planned_end is null) or (planned_start is not null and planned_end is not null and planned_end > planned_start)),
  check ((started_at is null and operational_date is null and state in ('awaiting_issue','awaiting_acceptance','cancelled')) or (started_at is not null and operational_date is not null and state in ('open','pending_close','closed'))),
  foreign key(substation_id,institution_id) references public.substations(id,institution_id),
  foreign key(employee_id,institution_id) references public.employees(id,institution_id),
  foreign key(owner_id,institution_id) references public.profiles(id,institution_id),
  foreign key(vehicle_id,substation_id) references public.vehicles(id,substation_id)
);
create unique index one_live_shift_holder on public.shifts(employee_id) where state in ('awaiting_issue','awaiting_acceptance','open','pending_close');
create unique index one_live_shift_owner on public.shifts(owner_id) where state in ('awaiting_issue','awaiting_acceptance','open','pending_close');
create unique index one_live_shift_vehicle on public.shifts(vehicle_id) where state in ('awaiting_issue','awaiting_acceptance','open','pending_close');
create index shifts_station on public.shifts(substation_id,requested_at desc);
alter table public.inventory_locations add constraint inventory_shift_fk foreign key(shift_id,substation_id) references public.shifts(id,substation_id);
create table public.issue_sheet_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  shift_id uuid not null,
  version integer not null check(version>0),
  kind text not null check(kind in ('initial','supplement')),
  state text not null check(state in ('draft','sent','disputed','superseded','withdrawn','accepted')),
  request_key uuid not null,
  request_payload jsonb not null,
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  note text not null,
  unique(id,substation_id),
  unique(shift_id,version),
  unique(shift_id,request_key),
  foreign key(shift_id,substation_id) references public.shifts(id,substation_id),
  foreign key(substation_id,institution_id) references public.substations(id,institution_id)
);
create unique index one_pending_sheet on public.issue_sheet_versions(shift_id) where state in ('draft','sent','disputed');
create table public.issue_sheet_lines (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  sheet_id uuid not null,
  lot_id uuid not null,
  product_id uuid not null,
  quantity numeric not null check(quantity>0 and quantity<=999999999.999),
  product_code text not null,
  product_name text not null,
  base_unit text not null,
  quantity_precision integer not null,
  lot_code text not null,
  expires_on date,
  unique(sheet_id,lot_id),
  foreign key(sheet_id,substation_id) references public.issue_sheet_versions(id,substation_id),
  foreign key(lot_id,substation_id,product_id) references public.stock_lots(id,substation_id,product_id),
  foreign key(substation_id,institution_id) references public.substations(id,institution_id)
);
create table public.issue_sheet_acceptances (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  sheet_id uuid not null unique,
  operation_id uuid not null unique,
  actor_id uuid not null references public.profiles(id),
  accepted_at timestamptz not null default now(),
  foreign key(sheet_id,substation_id) references public.issue_sheet_versions(id,substation_id),
  foreign key(operation_id,substation_id) references public.inventory_operations(id,substation_id),
  foreign key(substation_id,institution_id) references public.substations(id,institution_id)
);
create function app_private.owns_shift(p_shift uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.shifts s where s.id=p_shift and s.owner_id=auth.uid()
    and app_private.can_access_station(s.substation_id) and exists(select 1 from public.role_assignments r where r.user_id=auth.uid() and r.substation_id=s.substation_id and r.role='shift_leader'))
$$;
create function app_private.read_shift(p_shift uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.shifts s where s.id=p_shift and (app_private.can_view_logistics(s.substation_id) or app_private.owns_shift(s.id)))
$$;
create function app_private.read_sheet(p_sheet uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.issue_sheet_versions v where v.id=p_sheet and
    (app_private.can_view_logistics(v.substation_id) or (v.sent_at is not null and app_private.owns_shift(v.shift_id))))
$$;
create function app_private.owns_location(p_location uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.inventory_locations l where l.id=p_location and app_private.owns_shift(l.shift_id))
$$;
create function app_private.lock_shift_actor(p_shift uuid,p_warehouse boolean,p_reason text) returns public.shifts
language plpgsql security definer set search_path='' as $$
declare v_shift public.shifts; v_institution uuid:=app_private.current_institution();
begin
  select * into v_shift from public.shifts where id=p_shift and institution_id=v_institution;
  if not found or not app_private.read_shift(p_shift) then raise exception 'Tură inaccesibilă' using errcode='42501'; end if;
  perform 1 from public.institutions where id=v_institution for update;
  select * into strict v_shift from public.shifts where id=p_shift for update;
  if not app_private.read_shift(p_shift) or (p_warehouse and not app_private.can_operate_stock(v_shift.substation_id)) then
    raise exception 'Drepturi insuficiente sau revocate' using errcode='42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 5 and 500 then raise exception 'Motiv obligatoriu' using errcode='22023'; end if;
  perform set_config('app.audit_reason',btrim(p_reason),true);
  return v_shift;
end
$$;
create function public.list_available_vehicles(p_substation uuid)
returns table(id uuid,identifier text,description text,active boolean,operational boolean)
language sql stable security definer set search_path='' as $$
  select v.id,v.identifier,v.description,v.active,v.operational from public.vehicles v
  where v.substation_id=p_substation and v.active and v.operational and app_private.can_access_station(p_substation)
    and not exists(select 1 from public.shifts s where s.vehicle_id=v.id and s.state in ('awaiting_issue','awaiting_acceptance','open','pending_close')) order by v.identifier
$$;
create function public.request_shift(p_substation uuid,p_vehicle uuid,p_request_key uuid,p_planned_start timestamp,p_planned_end timestamp) returns uuid
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
create function public.save_issue_sheet(p_shift uuid,p_expected_sheet uuid,p_request_key uuid,p_send boolean,p_lines jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_shift public.shifts; v_current public.issue_sheet_versions; v_existing public.issue_sheet_versions; v_id uuid; v_version integer; v_payload jsonb; v_line jsonb; v_lot public.stock_lots; v_product public.products; v_quantity numeric;
begin
  v_shift:=app_private.lock_shift_actor(p_shift,true,p_reason);
  if v_shift.owner_id=auth.uid() then raise exception 'Autorul fișei trebuie să fie distinct de titular' using errcode='42501'; end if;
  if p_request_key is null or p_send is null or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Fișă nevalidă' using errcode='22023'; end if;
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
create function public.accept_issue_sheet(p_sheet uuid,p_request_key uuid) returns uuid
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
  insert into public.inventory_locations(institution_id,substation_id,kind,shift_id)
    values(v_shift.institution_id,v_shift.substation_id,'shift',v_shift.id) on conflict(shift_id) do nothing;
  select id into strict v_location from public.inventory_locations where shift_id=v_shift.id;
  for v_line in select * from public.issue_sheet_lines where sheet_id=p_sheet order by lot_id loop
    perform app_private.move_stock(v_operation,v_line.lot_id,v_warehouse,v_location,v_line.quantity);
  end loop;
  insert into public.issue_sheet_acceptances(institution_id,substation_id,sheet_id,operation_id,actor_id)
    values(v_shift.institution_id,v_shift.substation_id,p_sheet,v_operation,auth.uid());
  update public.issue_sheet_versions set state='accepted' where id=p_sheet;
  if v_sheet.kind='initial' then update public.shifts set state='open',started_at=now(),operational_date=(now() at time zone 'Europe/Bucharest')::date where id=v_shift.id; end if;
  return v_operation;
end
$$;
create function public.change_issue_sheet(p_sheet uuid,p_action text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_sheet public.issue_sheet_versions; v_shift public.shifts;
begin
  select * into v_sheet from public.issue_sheet_versions where id=p_sheet;
  if not found then raise exception 'Fișă inaccesibilă' using errcode='42501'; end if;
  if p_action is null or p_action not in ('dispute','withdraw') then raise exception 'Acțiune nevalidă' using errcode='22023'; end if;
  v_shift:=app_private.lock_shift_actor(v_sheet.shift_id,p_action='withdraw',p_reason);
  select * into strict v_sheet from public.issue_sheet_versions where id=p_sheet;
  if p_action='dispute' and (not app_private.owns_shift(v_shift.id) or v_sheet.state<>'sent') then raise exception 'Semnalare refuzată' using errcode='42501'; end if;
  if v_sheet.state not in ('draft','sent','disputed') then raise exception 'Fișa nu mai poate fi modificată' using errcode='23514'; end if;
  update public.issue_sheet_versions set state=case when p_action='dispute' then 'disputed' else 'withdrawn' end,note=btrim(p_reason) where id=p_sheet;
  if v_shift.started_at is null then update public.shifts set state='awaiting_issue' where id=v_shift.id; end if;
  return p_sheet;
end
$$;
create function public.cancel_shift(p_shift uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_shift public.shifts;
begin
  v_shift:=app_private.lock_shift_actor(p_shift,false,p_reason);
  if not app_private.owns_shift(p_shift) and not app_private.can_operate_stock(v_shift.substation_id) then raise exception 'Anulare refuzată' using errcode='42501'; end if;
  if v_shift.state='cancelled' then return p_shift; end if;
  if v_shift.state not in ('awaiting_issue','awaiting_acceptance') then raise exception 'Tura pornită se închide, nu se anulează' using errcode='23514'; end if;
  update public.issue_sheet_versions set state='withdrawn',note=btrim(p_reason) where shift_id=p_shift and state in ('draft','sent','disputed');
  update public.shifts set state='cancelled' where id=p_shift;
  return p_shift;
end
$$;

do $$ declare v_table text; begin
  foreach v_table in array array['shifts','issue_sheet_versions','issue_sheet_lines','issue_sheet_acceptances'] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all on public.%I from anon,authenticated',v_table);
    execute format('grant select on public.%I to authenticated',v_table);
    execute format('grant all on public.%I to service_role',v_table);
  end loop;
end $$;
create policy read_shifts on public.shifts for select to authenticated using(app_private.read_shift(id));
create policy read_sheets on public.issue_sheet_versions for select to authenticated using(app_private.read_sheet(id));
create policy read_sheet_lines on public.issue_sheet_lines for select to authenticated using(app_private.read_sheet(sheet_id));
create policy read_acceptances on public.issue_sheet_acceptances for select to authenticated using(app_private.read_sheet(sheet_id));
create policy read_own_locations on public.inventory_locations for select to authenticated using(app_private.owns_shift(shift_id));
create policy read_own_balances on public.stock_balances for select to authenticated using(app_private.owns_location(location_id));
create policy read_own_movements on public.inventory_movements for select to authenticated using(app_private.owns_location(source_id) or app_private.owns_location(destination_id));
create policy read_own_operations on public.inventory_operations for select to authenticated using(exists(select 1 from public.issue_sheet_acceptances a where a.operation_id=inventory_operations.id and app_private.read_sheet(a.sheet_id)));
create trigger audit_shifts after insert or update on public.shifts for each row execute function app_private.write_audit();
create trigger audit_sheets after insert or update on public.issue_sheet_versions for each row execute function app_private.write_audit();
create trigger audit_acceptances after insert on public.issue_sheet_acceptances for each row execute function app_private.write_audit();
revoke execute on function app_private.owns_shift(uuid),app_private.read_shift(uuid),app_private.read_sheet(uuid),app_private.owns_location(uuid),app_private.lock_shift_actor(uuid,boolean,text) from public,anon,authenticated;
grant execute on function app_private.owns_shift(uuid),app_private.read_shift(uuid),app_private.read_sheet(uuid),app_private.owns_location(uuid) to authenticated,service_role;
revoke execute on function public.list_available_vehicles(uuid),public.request_shift(uuid,uuid,uuid,timestamp,timestamp),public.save_issue_sheet(uuid,uuid,uuid,boolean,jsonb,text),public.accept_issue_sheet(uuid,uuid),public.change_issue_sheet(uuid,text,text),public.cancel_shift(uuid,text) from public,anon,authenticated;
grant execute on function public.list_available_vehicles(uuid),public.request_shift(uuid,uuid,uuid,timestamp,timestamp),public.save_issue_sheet(uuid,uuid,uuid,boolean,jsonb,text),public.accept_issue_sheet(uuid,uuid),public.change_issue_sheet(uuid,text,text),public.cancel_shift(uuid,text) to authenticated;
commit;
