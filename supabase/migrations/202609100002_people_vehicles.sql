-- M03: personnel, station membership, individual identity and fleet.
begin;

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  code text not null check (length(btrim(code)) between 2 and 30),
  display_name text not null check (length(btrim(display_name)) between 2 and 120),
  user_id uuid,
  created_at timestamptz not null default now(),
  unique (id, institution_id),
  unique (user_id),
  foreign key (user_id, institution_id) references public.profiles(id, institution_id)
);
create unique index employees_code_unique on public.employees(institution_id, upper(btrim(code)));
create table public.employee_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  employee_id uuid not null,
  substation_id uuid not null,
  job_title text not null check (length(btrim(job_title)) between 2 and 100),
  active boolean not null default true,
  is_titular boolean not null default false,
  created_at timestamptz not null default now(),
  unique (employee_id, substation_id),
  foreign key (employee_id, institution_id) references public.employees(id, institution_id),
  foreign key (substation_id, institution_id) references public.substations(id, institution_id)
);
create index employee_assignments_station on public.employee_assignments(substation_id, employee_id);
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  identifier text not null check (length(btrim(identifier)) between 2 and 30),
  description text not null check (length(btrim(description)) between 2 and 120),
  active boolean not null default true,
  operational boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (substation_id, institution_id) references public.substations(id, institution_id)
);
create unique index vehicles_identifier_unique on public.vehicles(institution_id, upper(btrim(identifier)));
create index vehicles_station on public.vehicles(substation_id);

create function app_private.can_manage_station(p_station uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.can_access_station(p_station) and exists (
    select 1 from public.role_assignments r where r.user_id = auth.uid()
    and r.institution_id = app_private.current_institution()
    and (r.role = 'administrator' or (r.substation_id = p_station and r.role = 'station_manager'))
  )
$$;
create function app_private.lock_station_manager(p_station uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid := app_private.current_institution();
begin
  if not app_private.can_manage_station(p_station) then raise exception 'Administrare locală refuzată' using errcode = '42501'; end if;
  perform 1 from public.institutions where id = v_institution for update;
  if not app_private.can_manage_station(p_station) then raise exception 'Drepturi revocate sau substație inactivă' using errcode = '42501'; end if;
  return v_institution;
end
$$;
create function app_private.can_read_employee(p_employee uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.employees e join public.employee_assignments a on a.employee_id = e.id
    where e.id = p_employee and e.institution_id = app_private.current_institution()
    and (app_private.can_view_logistics(a.substation_id)
      or (e.user_id = auth.uid() and app_private.can_access_station(a.substation_id)))
  )
$$;

alter table public.employees enable row level security;
alter table public.employee_assignments enable row level security;
alter table public.vehicles enable row level security;
revoke all on public.employees, public.employee_assignments, public.vehicles from anon, authenticated;
grant select on public.employees, public.employee_assignments, public.vehicles to authenticated;
grant all on public.employees, public.employee_assignments, public.vehicles to service_role;
create policy read_employees on public.employees for select to authenticated using (app_private.can_read_employee(id));
create policy read_assignments on public.employee_assignments for select to authenticated using (
  app_private.can_view_logistics(substation_id) or
  (app_private.can_access_station(substation_id) and exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()))
);
create policy read_vehicles on public.vehicles for select to authenticated using (
  app_private.can_view_logistics(substation_id) or
  (active and operational and app_private.can_access_station(substation_id))
);
create trigger audit_employees after insert or update or delete on public.employees for each row execute function app_private.write_audit();
create trigger audit_employee_assignments after insert or update or delete on public.employee_assignments for each row execute function app_private.write_audit();
create trigger audit_vehicles after insert or update or delete on public.vehicles for each row execute function app_private.write_audit();

create function public.save_employee(p_substation uuid, p_employee uuid, p_code text, p_name text,
  p_job_title text, p_active boolean, p_is_titular boolean, p_account uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid; v_id uuid; v_old public.employees; v_admin boolean;
begin
  v_institution := app_private.lock_station_manager(p_substation);
  v_admin := app_private.is_admin(v_institution);
  if p_reason is null or length(btrim(p_reason)) < 5 or length(p_reason) > 500 then raise exception 'Motiv obligatoriu' using errcode = '22023'; end if;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  if p_employee is null then
    if p_account is not null and not v_admin then raise exception 'Asocierea conturilor este rezervată administratorului' using errcode = '42501'; end if;
    insert into public.employees(institution_id, code, display_name, user_id)
      values(v_institution, upper(btrim(p_code)), btrim(p_name), p_account) returning id into v_id;
    insert into public.employee_assignments(institution_id, employee_id, substation_id, job_title, active, is_titular)
      values(v_institution, v_id, p_substation, btrim(p_job_title), p_active, p_is_titular);
  else
    select e.* into v_old from public.employees e join public.employee_assignments a on a.employee_id = e.id
      where e.id = p_employee and a.substation_id = p_substation and e.institution_id = v_institution;
    if not found then raise exception 'Angajat inaccesibil' using errcode = '42501'; end if;
    if not v_admin and p_account is distinct from v_old.user_id then raise exception 'Asocierea conturilor este rezervată administratorului' using errcode = '42501'; end if;
    if not v_admin and (v_old.display_name is distinct from btrim(p_name) or v_old.code is distinct from upper(btrim(p_code)))
      and exists (select 1 from public.employee_assignments where employee_id = p_employee and substation_id <> p_substation) then
      raise exception 'Identitatea comună se modifică de administrator' using errcode = '42501';
    end if;
    update public.employees set code = upper(btrim(p_code)), display_name = btrim(p_name), user_id = p_account where id = p_employee;
    update public.employee_assignments set job_title = btrim(p_job_title), active = p_active, is_titular = p_is_titular
      where employee_id = p_employee and substation_id = p_substation;
    v_id := p_employee;
  end if;
  return v_id;
end
$$;

create function public.save_vehicle(p_substation uuid, p_vehicle uuid, p_identifier text,
  p_description text, p_active boolean, p_operational boolean, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid; v_id uuid;
begin
  v_institution := app_private.lock_station_manager(p_substation);
  if p_reason is null or length(btrim(p_reason)) < 5 or length(p_reason) > 500 then raise exception 'Motiv obligatoriu' using errcode = '22023'; end if;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  if p_vehicle is null then
    insert into public.vehicles(institution_id, substation_id, identifier, description, active, operational)
      values(v_institution, p_substation, upper(btrim(p_identifier)), btrim(p_description), p_active, p_operational) returning id into v_id;
  else
    update public.vehicles set identifier = upper(btrim(p_identifier)), description = btrim(p_description), active = p_active, operational = p_operational
      where id = p_vehicle and substation_id = p_substation and institution_id = v_institution returning id into v_id;
    if v_id is null then raise exception 'Mașină inaccesibilă' using errcode = '42501'; end if;
  end if;
  return v_id;
end
$$;

-- Read-only candidate list. Future handovers MUST recheck inside their stock/shift transaction.
create function public.list_eligible_holders(p_substation uuid)
returns table(employee_id uuid, display_name text, user_id uuid)
language sql stable security definer set search_path = '' as $$
  select e.id, e.display_name, e.user_id from public.employees e
  join public.employee_assignments a on a.employee_id = e.id
  join public.profiles p on p.id = e.user_id and p.institution_id = e.institution_id
  where a.substation_id = p_substation and a.active and a.is_titular and p.active
  and app_private.can_access_station(p_substation)
  and (app_private.can_view_logistics(p_substation) or e.user_id = auth.uid())
  and exists (select 1 from public.role_assignments r where r.user_id = e.user_id and r.substation_id = p_substation and r.role = 'shift_leader')
  order by e.display_name
$$;
create function public.resolve_my_holder(p_substation uuid)
returns table(employee_id uuid, display_name text, user_id uuid)
language sql stable security definer set search_path = '' as $$
  select h.* from public.list_eligible_holders(p_substation) h where h.user_id = auth.uid()
$$;
revoke execute on function app_private.can_manage_station(uuid), app_private.lock_station_manager(uuid), app_private.can_read_employee(uuid) from public, anon, authenticated;
grant execute on function app_private.can_read_employee(uuid) to authenticated, service_role;
revoke execute on function public.save_employee(uuid,uuid,text,text,text,boolean,boolean,uuid,text),
  public.save_vehicle(uuid,uuid,text,text,boolean,boolean,text), public.list_eligible_holders(uuid), public.resolve_my_holder(uuid)
  from public, anon, authenticated;
grant execute on function public.save_employee(uuid,uuid,text,text,text,boolean,boolean,uuid,text),
  public.save_vehicle(uuid,uuid,text,text,boolean,boolean,text), public.list_eligible_holders(uuid), public.resolve_my_holder(uuid)
  to authenticated;
commit;
