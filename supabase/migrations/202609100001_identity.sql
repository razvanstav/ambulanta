-- M02: identity, substations, explicit grants and immutable audit.
begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;

create type public.app_role as enum ('administrator', 'logistics', 'station_manager', 'warehouse', 'shift_leader');

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id),
  institution_id uuid not null references public.institutions(id),
  display_name text not null check (length(btrim(display_name)) between 2 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, institution_id)
);
create table public.substations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  name text not null check (length(btrim(name)) between 2 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, institution_id)
);
create unique index substations_name_unique on public.substations (institution_id, lower(btrim(name)));
create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  user_id uuid not null,
  substation_id uuid,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  foreign key (user_id, institution_id) references public.profiles(id, institution_id),
  foreign key (substation_id, institution_id) references public.substations(id, institution_id),
  check ((role in ('administrator', 'logistics') and substation_id is null)
    or (role in ('station_manager', 'warehouse', 'shift_leader') and substation_id is not null)),
  unique nulls not distinct (user_id, role, substation_id)
);
create index role_assignments_station on public.role_assignments(substation_id, user_id);
create table public.audit_events (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id),
  actor_id uuid references auth.users(id),
  entity_table text not null,
  entity_id uuid not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  reason text not null,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);
create index audit_events_institution_time on public.audit_events(institution_id, occurred_at desc);

create function app_private.current_institution() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.institution_id from public.profiles p join public.institutions i on i.id = p.institution_id
  where p.id = auth.uid() and p.active and i.active
$$;

create function app_private.is_admin(p_institution uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(p_institution = app_private.current_institution(), false) and exists (
    select 1 from public.role_assignments r
    where r.user_id = auth.uid() and r.institution_id = p_institution and r.role = 'administrator'
  )
$$;

create function app_private.can_access_station(p_station uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.substations s join public.role_assignments r on r.institution_id = s.institution_id
    where s.id = p_station and s.active and s.institution_id = app_private.current_institution()
    and r.user_id = auth.uid() and (r.substation_id = s.id or r.role in ('administrator','logistics'))
  )
$$;

create function app_private.can_view_logistics(p_station uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.can_access_station(p_station) and exists (
    select 1 from public.role_assignments r where r.user_id = auth.uid()
    and r.institution_id = app_private.current_institution()
    and (r.role in ('administrator','logistics') or (r.substation_id = p_station and r.role in ('warehouse','station_manager')))
  )
$$;

-- Contract for future RLS on real shifts/evidence. Owner must be the row's owner,
-- resolved from the authenticated account; never an arbitrary client identity.
create function public.can_access_owned_record(p_substation uuid, p_owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.can_access_station(p_substation) and (
    app_private.can_view_logistics(p_substation) or (p_owner = auth.uid() and exists (
      select 1 from public.role_assignments r where r.user_id = auth.uid()
      and r.substation_id = p_substation and r.role = 'shift_leader'
    ))
  )
$$;

create function app_private.write_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb; v_row jsonb;
begin
  if tg_op <> 'INSERT' then v_before := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_after := to_jsonb(new); end if;
  v_row := coalesce(v_after, v_before);
  insert into public.audit_events(institution_id, actor_id, entity_table, entity_id, action, reason, before_data, after_data)
  values ((v_row->>'institution_id')::uuid, auth.uid(), tg_table_name, (v_row->>'id')::uuid, tg_op,
    coalesce(nullif(current_setting('app.audit_reason', true), ''), 'Administrare infrastructură'), v_before, v_after);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;
create trigger audit_profiles after insert or update or delete on public.profiles for each row execute function app_private.write_audit();
create trigger audit_substations after insert or update or delete on public.substations for each row execute function app_private.write_audit();
create trigger audit_roles after insert or update or delete on public.role_assignments for each row execute function app_private.write_audit();

alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.substations enable row level security;
alter table public.role_assignments enable row level security;
alter table public.audit_events enable row level security;
revoke all on public.institutions, public.profiles, public.substations, public.role_assignments, public.audit_events from anon, authenticated;
grant select on public.institutions, public.profiles, public.substations, public.role_assignments, public.audit_events to authenticated;
grant all on public.institutions, public.profiles, public.substations, public.role_assignments, public.audit_events to service_role;
grant usage, select on sequence public.audit_events_id_seq to service_role;
create policy read_institution on public.institutions for select to authenticated using (id = app_private.current_institution());
create policy read_profile on public.profiles for select to authenticated using (
  (id = auth.uid() and institution_id = app_private.current_institution()) or app_private.is_admin(institution_id)
);
create policy read_station on public.substations for select to authenticated using (
  app_private.can_access_station(id) or app_private.is_admin(institution_id)
);
create policy read_own_roles on public.role_assignments for select to authenticated using (
  (user_id = auth.uid() and institution_id = app_private.current_institution()) or app_private.is_admin(institution_id)
);
create policy read_audit_admin on public.audit_events for select to authenticated using (app_private.is_admin(institution_id));

create function app_private.lock_admin() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid := app_private.current_institution();
begin
  if not app_private.is_admin(v_institution) then raise exception 'Acces administrativ refuzat' using errcode = '42501'; end if;
  perform 1 from public.institutions where id = v_institution for update;
  -- Recheck after the lock: another administrator may have revoked this actor.
  if not app_private.is_admin(v_institution) then raise exception 'Acces administrativ revocat' using errcode = '42501'; end if;
  return v_institution;
end
$$;

create function public.save_substation(p_id uuid, p_name text, p_active boolean, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid; v_id uuid;
begin
  v_institution := app_private.lock_admin();
  if p_reason is null or length(btrim(p_reason)) < 5 or length(p_reason) > 500 then raise exception 'Motiv obligatoriu (5–500 caractere)' using errcode = '22023'; end if;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  if p_id is null then
    insert into public.substations(institution_id, name, active) values (v_institution, btrim(p_name), p_active) returning id into v_id;
  else
    update public.substations set name = btrim(p_name), active = p_active where id = p_id and institution_id = v_institution returning id into v_id;
    if v_id is null then raise exception 'Substație inaccesibilă' using errcode = '42501'; end if;
  end if;
  return v_id;
end
$$;

create function public.register_account(p_user uuid, p_name text, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid;
begin
  v_institution := app_private.lock_admin();
  if p_reason is null or length(btrim(p_reason)) < 5 or length(p_reason) > 500 then raise exception 'Motiv obligatoriu' using errcode = '22023'; end if;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  -- Accounts receive no role automatically, including via user metadata.
  insert into public.profiles(id, institution_id, display_name) values (p_user, v_institution, btrim(p_name));
  return p_user;
end
$$;

create function public.set_account_access(p_user uuid, p_active boolean, p_roles jsonb, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid; v_role jsonb; v_station uuid; v_kind public.app_role;
begin
  v_institution := app_private.lock_admin();
  if p_user = auth.uid() then raise exception 'Propriul acces se modifică de alt administrator' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_user and institution_id = v_institution) then raise exception 'Cont inaccesibil' using errcode = '42501'; end if;
  if p_reason is null or length(btrim(p_reason)) < 5 or length(p_reason) > 500 then raise exception 'Motiv obligatoriu' using errcode = '22023'; end if;
  if p_active is null or p_roles is null or jsonb_typeof(p_roles) <> 'array' then raise exception 'Date nevalide' using errcode = '22023'; end if;
  if jsonb_array_length(p_roles) > 100 then raise exception 'Prea multe roluri' using errcode = '22023'; end if;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  update public.profiles set active = p_active where id = p_user;
  delete from public.role_assignments where user_id = p_user;
  for v_role in select value from jsonb_array_elements(p_roles) loop
    v_kind := (v_role->>'role')::public.app_role;
    v_station := nullif(v_role->>'substation_id','')::uuid;
    if v_station is not null and not exists (select 1 from public.substations where id = v_station and institution_id = v_institution and active) then
      raise exception 'Substație inaccesibilă sau inactivă' using errcode = '42501';
    end if;
    insert into public.role_assignments(institution_id, user_id, substation_id, role) values (v_institution, p_user, v_station, v_kind);
  end loop;
end
$$;

-- Privileged one-time setup per administrator; never callable with a user JWT.
create function public.bootstrap_institution(p_admin uuid, p_name text, p_admin_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if exists (select 1 from public.profiles where id = p_admin) then raise exception 'Cont deja configurat' using errcode = '23505'; end if;
  perform set_config('app.audit_reason', 'Inițializarea instituției', true);
  insert into public.institutions(name) values (btrim(p_name)) returning id into v_id;
  insert into public.profiles(id, institution_id, display_name) values(p_admin, v_id, btrim(p_admin_name));
  insert into public.role_assignments(institution_id, user_id, role) values(v_id, p_admin, 'administrator');
  return v_id;
end
$$;

revoke execute on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.current_institution(), app_private.is_admin(uuid), app_private.can_access_station(uuid), app_private.can_view_logistics(uuid) to authenticated, service_role;
revoke execute on function public.can_access_owned_record(uuid,uuid), public.save_substation(uuid,text,boolean,text), public.register_account(uuid,text,text), public.set_account_access(uuid,boolean,jsonb,text), public.bootstrap_institution(uuid,text,text) from public, anon, authenticated;
grant execute on function public.can_access_owned_record(uuid,uuid), public.save_substation(uuid,text,boolean,text), public.register_account(uuid,text,text), public.set_account_access(uuid,boolean,jsonb,text) to authenticated;
grant execute on function public.bootstrap_institution(uuid,text,text) to service_role;

commit;
