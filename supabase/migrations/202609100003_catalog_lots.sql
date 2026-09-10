-- M04: shared catalog, exact local thresholds and immutable lot identity. No balances.
begin;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  code text not null check (length(btrim(code)) between 2 and 30),
  name text not null check (length(btrim(name)) between 2 and 150),
  category text not null check (category in ('medication','consumable','accessory')),
  base_unit text not null check (base_unit in ('buc','fiola','comprimat','pereche','ml','l','m')),
  quantity_precision integer not null check (quantity_precision between 0 and 3),
  track_lots boolean not null,
  track_expiry boolean not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, institution_id),
  check (base_unit not in ('buc','fiola','comprimat','pereche') or quantity_precision = 0),
  check (not track_expiry or track_lots),
  check (category <> 'medication' or (track_lots and track_expiry))
);
create unique index products_code_unique on public.products(institution_id, upper(btrim(code)));

create table public.station_product_settings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  product_id uuid not null,
  minimum_quantity numeric not null check (minimum_quantity >= 0 and minimum_quantity <= 999999999.999),
  active boolean not null default true,
  unique (product_id, substation_id),
  foreign key (product_id, institution_id) references public.products(id, institution_id),
  foreign key (substation_id, institution_id) references public.substations(id, institution_id)
);
create table public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  product_id uuid not null,
  lot_code text not null check (length(btrim(lot_code)) between 1 and 80),
  expires_on date check (expires_on between date '1900-01-01' and date '9999-12-31'),
  is_internal boolean not null,
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, substation_id, product_id),
  foreign key (product_id, institution_id) references public.products(id, institution_id),
  foreign key (substation_id, institution_id) references public.substations(id, institution_id)
);
create unique index stock_lots_code_unique on public.stock_lots(substation_id, product_id, upper(btrim(lot_code)));
create unique index stock_lots_one_internal on public.stock_lots(substation_id, product_id) where is_internal;
create index stock_lots_station_expiry on public.stock_lots(substation_id, expires_on);

create function app_private.can_manage_catalog() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.role_assignments r where r.user_id = auth.uid()
    and r.institution_id = app_private.current_institution() and r.role in ('administrator','logistics'))
$$;
create function app_private.can_read_catalog(p_institution uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(p_institution = app_private.current_institution(), false) and
    (app_private.can_manage_catalog() or exists (select 1 from public.substations s
      where s.institution_id = p_institution and app_private.can_view_logistics(s.id)))
$$;
create function app_private.lock_catalog_station(p_station uuid, p_common boolean, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid := app_private.current_institution();
begin
  if not app_private.can_view_logistics(p_station) or (p_common and not app_private.can_manage_catalog()) then
    raise exception 'Acces catalog refuzat' using errcode = '42501'; end if;
  perform 1 from public.institutions where id = v_institution for update;
  if not app_private.can_view_logistics(p_station) or (p_common and not app_private.can_manage_catalog()) then
    raise exception 'Drepturi revocate sau substație inactivă' using errcode = '42501'; end if;
  if p_reason is null or length(btrim(p_reason)) < 5 or length(p_reason) > 500 then
    raise exception 'Motiv obligatoriu (5–500 caractere)' using errcode = '22023'; end if;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  return v_institution;
end
$$;

-- Every future movement must reference a stock_lot. Locking measurement semantics
-- from the first lot therefore also protects every product already used in movements.
create function app_private.guard_product_measurement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.institution_id <> old.institution_id or new.id <> old.id then
    raise exception 'Identitatea produsului este fixă' using errcode = '23514'; end if;
  if row(new.base_unit,new.quantity_precision,new.track_lots,new.track_expiry)
    is distinct from row(old.base_unit,old.quantity_precision,old.track_lots,old.track_expiry) then
    if exists (select 1 from public.stock_lots where product_id = old.id) then
      raise exception 'Unitatea, precizia și urmărirea sunt fixe după primul lot' using errcode = '23514'; end if;
    if exists (select 1 from public.station_product_settings where product_id = old.id
      and minimum_quantity <> trunc(minimum_quantity,new.quantity_precision)) then
      raise exception 'Pragurile existente nu respectă noua precizie' using errcode = '23514'; end if;
  end if;
  return new;
end
$$;
create trigger guard_product_measurement before update on public.products for each row execute function app_private.guard_product_measurement();

create function app_private.guard_catalog_local() returns trigger
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
    if new.is_internal = v_product.track_lots or (new.is_internal and new.lot_code <> 'INTERN')
      or (v_product.track_expiry and new.expires_on is null)
      or (not v_product.track_expiry and new.expires_on is not null) then
      raise exception 'Lotul și expirarea nu respectă produsul' using errcode = '23514'; end if;
  end if;
  return new;
end
$$;
create trigger guard_station_product before insert or update on public.station_product_settings for each row execute function app_private.guard_catalog_local();
create trigger guard_stock_lot before insert or update on public.stock_lots for each row execute function app_private.guard_catalog_local();

alter table public.products enable row level security;
alter table public.station_product_settings enable row level security;
alter table public.stock_lots enable row level security;
revoke all on public.products, public.station_product_settings, public.stock_lots from anon, authenticated;
grant select on public.products, public.station_product_settings, public.stock_lots to authenticated;
grant all on public.products, public.station_product_settings, public.stock_lots to service_role;
create policy read_products on public.products for select to authenticated using (app_private.can_read_catalog(institution_id));
create policy read_station_products on public.station_product_settings for select to authenticated using (app_private.can_view_logistics(substation_id));
create policy read_stock_lots on public.stock_lots for select to authenticated using (app_private.can_view_logistics(substation_id));
create trigger audit_products after insert or update or delete on public.products for each row execute function app_private.write_audit();
create trigger audit_station_products after insert or update or delete on public.station_product_settings for each row execute function app_private.write_audit();
create trigger audit_stock_lots after insert or update or delete on public.stock_lots for each row execute function app_private.write_audit();

create function public.save_product(p_substation uuid, p_product uuid, p_code text, p_name text,
  p_category text, p_base_unit text, p_precision integer, p_track_lots boolean, p_track_expiry boolean,
  p_active boolean, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid; v_id uuid;
begin
  v_institution := app_private.lock_catalog_station(p_substation,true,p_reason);
  if p_product is null then
    insert into public.products(institution_id,code,name,category,base_unit,quantity_precision,track_lots,track_expiry,active)
      values(v_institution,upper(btrim(p_code)),btrim(p_name),p_category,p_base_unit,p_precision,p_track_lots,p_track_expiry,p_active) returning id into v_id;
  else
    update public.products set code = upper(btrim(p_code)), name = btrim(p_name), category = p_category,
      base_unit = p_base_unit, quantity_precision = p_precision, track_lots = p_track_lots, track_expiry = p_track_expiry, active = p_active
      where id = p_product and institution_id = v_institution returning id into v_id;
    if v_id is null then raise exception 'Produs inaccesibil' using errcode = '42501'; end if;
  end if;
  return v_id;
end
$$;
create function public.save_station_product(p_substation uuid, p_product uuid, p_minimum numeric, p_active boolean, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid; v_id uuid;
begin
  v_institution := app_private.lock_catalog_station(p_substation,false,p_reason);
  if not exists (select 1 from public.products where id = p_product and institution_id = v_institution) then
    raise exception 'Produs inaccesibil' using errcode = '42501'; end if;
  insert into public.station_product_settings(institution_id,substation_id,product_id,minimum_quantity,active)
    values(v_institution,p_substation,p_product,p_minimum,p_active)
    on conflict (product_id,substation_id) do update set minimum_quantity = excluded.minimum_quantity, active = excluded.active
    returning id into v_id;
  return v_id;
end
$$;
create function public.create_stock_lot(p_substation uuid, p_product uuid, p_lot_code text, p_expires_on date, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid; v_product public.products; v_id uuid;
begin
  v_institution := app_private.lock_catalog_station(p_substation,false,p_reason);
  select * into v_product from public.products where id = p_product and institution_id = v_institution and active;
  if not found or not exists (select 1 from public.station_product_settings where product_id = p_product and substation_id = p_substation and active) then
    raise exception 'Activează produsul în catalog și în substație înainte de lot' using errcode = '23514'; end if;
  if not v_product.track_lots and nullif(btrim(p_lot_code),'') is not null then
    raise exception 'Produsul folosește un lot intern automat' using errcode = '22023'; end if;
  insert into public.stock_lots(institution_id,substation_id,product_id,lot_code,expires_on,is_internal)
    values(v_institution,p_substation,p_product,case when v_product.track_lots then upper(btrim(p_lot_code)) else 'INTERN' end,p_expires_on,not v_product.track_lots)
    returning id into v_id;
  return v_id;
end
$$;
create function public.set_stock_lot_blocked(p_substation uuid, p_lot uuid, p_blocked boolean, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_institution uuid; v_id uuid;
begin
  v_institution := app_private.lock_catalog_station(p_substation,false,p_reason);
  update public.stock_lots set blocked = p_blocked where id = p_lot and substation_id = p_substation and institution_id = v_institution returning id into v_id;
  if v_id is null then raise exception 'Lot inaccesibil' using errcode = '42501'; end if;
  return v_id;
end
$$;

revoke execute on function app_private.can_manage_catalog(), app_private.can_read_catalog(uuid), app_private.lock_catalog_station(uuid,boolean,text), app_private.guard_product_measurement(), app_private.guard_catalog_local() from public, anon, authenticated;
grant execute on function app_private.can_manage_catalog(), app_private.can_read_catalog(uuid) to authenticated, service_role;
revoke execute on function public.save_product(uuid,uuid,text,text,text,text,integer,boolean,boolean,boolean,text), public.save_station_product(uuid,uuid,numeric,boolean,text), public.create_stock_lot(uuid,uuid,text,date,text), public.set_stock_lot_blocked(uuid,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.save_product(uuid,uuid,text,text,text,text,integer,boolean,boolean,boolean,text), public.save_station_product(uuid,uuid,numeric,boolean,text), public.create_stock_lot(uuid,uuid,text,date,text), public.set_stock_lot_blocked(uuid,uuid,boolean,text) to authenticated;

commit;
