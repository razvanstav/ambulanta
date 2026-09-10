-- M07: immutable closeout drafts and private, server-validated evidence.
begin;
alter table public.substations add column evidence_policy text not null default 'at_least_one'
  check(evidence_policy in ('optional','at_least_one'));

create table public.closeout_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  shift_id uuid not null,
  version integer not null check(version>0),
  author_id uuid not null references public.profiles(id),
  request_key uuid not null,
  request_payload jsonb not null,
  content jsonb not null,
  content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
  allocations jsonb not null,
  created_at timestamptz not null default now(),
  unique(shift_id,version), unique(shift_id,request_key), unique(id,substation_id),
  foreign key(shift_id,substation_id) references public.shifts(id,substation_id),
  foreign key(substation_id,institution_id) references public.substations(id,institution_id)
);
create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  substation_id uuid not null,
  shift_id uuid not null,
  version_id uuid not null,
  content_hash text not null,
  collector_id uuid not null references public.profiles(id),
  collector_name text not null,
  signer_name text,
  confirmation text,
  kind text not null check(kind in ('document','signature')),
  filename text not null check(length(filename) between 1 and 150),
  mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
  byte_size integer not null check(byte_size between 1 and 10485760),
  file_hash text not null check(file_hash ~ '^[a-f0-9]{64}$'),
  object_path text not null unique,
  request_key uuid not null,
  state text not null default 'pending' check(state in ('pending','validated','removed')),
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  removed_at timestamptz,
  unique(version_id,request_key),
  foreign key(version_id,substation_id) references public.closeout_versions(id,substation_id),
  foreign key(shift_id,substation_id) references public.shifts(id,substation_id),
  foreign key(substation_id,institution_id) references public.substations(id,institution_id),
  check(kind<>'signature' or (mime_type='image/png' and signer_name is not null and length(btrim(signer_name)) between 2 and 120 and confirmation is not null))
);
create index evidence_version on public.evidence_files(version_id);
create function app_private.closeout_allocations(p_shift uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('allocation_id',l.id,'lot_id',l.lot_id,
    'product_code',l.product_code,'product_name',l.product_name,'base_unit',l.base_unit,
    'quantity_precision',l.quantity_precision,'lot_code',l.lot_code,'expires_on',l.expires_on,
    'issued',l.quantity) order by l.id),'[]'::jsonb)
  from public.issue_sheet_lines l join public.issue_sheet_versions s on s.id=l.sheet_id
  where s.shift_id=p_shift and s.state='accepted'
$$;
create function app_private.current_closeout(p_version uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.closeout_versions v join public.shifts s on s.id=v.shift_id
    where v.id=p_version and s.state='open'
    and not exists(select 1 from public.closeout_versions newer where newer.shift_id=v.shift_id and newer.version>v.version)
    and v.allocations=app_private.closeout_allocations(v.shift_id))
$$;
create function app_private.lock_closeout(p_version uuid,p_reason text) returns public.closeout_versions
language plpgsql security definer set search_path='' as $$
declare v public.closeout_versions; s public.shifts;
begin
  select * into v from public.closeout_versions where id=p_version;
  if not found then raise exception 'Ciornă inaccesibilă' using errcode='42501'; end if;
  s:=app_private.lock_shift_actor(v.shift_id,false,p_reason);
  if not app_private.owns_shift(s.id) and not app_private.can_operate_stock(s.substation_id) then
    raise exception 'Colectare refuzată' using errcode='42501'; end if;
  if not app_private.current_closeout(v.id) then raise exception 'Versiune schimbată sau suplimentare nouă; salvează o ciornă nouă' using errcode='23514'; end if;
  return v;
end
$$;
create function public.save_closeout_draft(p_shift uuid,p_expected_version uuid,p_request_key uuid,p_lines jsonb) returns uuid
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
    lines:=lines||jsonb_build_array(a||jsonb_build_object('consumed',consumed,'returned',returned));
  end loop;
  select coalesce(max(version),0)+1 into v_number from public.closeout_versions where shift_id=p_shift;
  content:=jsonb_build_object('id',v_id,'version',v_number,'shift_id',s.id,'substation_id',s.substation_id,
    'holder_name',s.holder_name,'owner_id',s.owner_id,'vehicle',s.vehicle_identifier,'started_at',s.started_at,
    'operational_date',s.operational_date,'lines',lines);
  insert into public.closeout_versions(id,institution_id,substation_id,shift_id,version,author_id,request_key,request_payload,content,content_hash,allocations)
    values(v_id,s.institution_id,s.substation_id,s.id,v_number,auth.uid(),p_request_key,payload,content,
      encode(sha256(convert_to(content::text,'UTF8')),'hex'),allocations);
  return v_id;
end
$$;

-- Only the trusted server may attest validation. It supplies an Auth-verified actor.
create function public.reserve_validated_evidence(p_actor uuid,p_version uuid,p_key uuid,p_kind text,p_filename text,p_mime text,p_size integer,p_hash text,p_signer text,p_confirm boolean) returns public.evidence_files
language plpgsql security definer set search_path='' as $$
declare v public.closeout_versions; e public.evidence_files; eid uuid:=gen_random_uuid(); old_sub text:=current_setting('request.jwt.claim.sub',true); cname text;
begin
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  v:=app_private.lock_closeout(p_version,'Colectare dovadă pentru versiunea exactă');
  if p_actor is null or p_key is null or p_kind is null or p_kind not in ('document','signature') then raise exception 'Dovadă nevalidă' using errcode='22023'; end if;
  if p_kind='signature' and (p_confirm is distinct from true or p_signer is null or length(btrim(p_signer)) not between 2 and 120) then
    raise exception 'Confirmarea și numele semnatarului sunt obligatorii' using errcode='22023'; end if;
  select * into e from public.evidence_files where version_id=p_version and request_key=p_key;
  if found then
    if e.collector_id<>p_actor or e.kind<>p_kind or e.file_hash<>p_hash or e.byte_size<>p_size or e.mime_type<>p_mime
      or e.filename<>p_filename or e.signer_name is distinct from (case when p_kind='signature' then btrim(p_signer) end) or e.state='removed' then
      raise exception 'Cheie reutilizată' using errcode='22023'; end if;
  else
    if (select count(*) from public.evidence_files where version_id=p_version and kind=p_kind and state<>'removed') >= (case when p_kind='signature' then 1 else 5 end) then
      raise exception 'Limita dovezilor a fost atinsă' using errcode='23514'; end if;
    select display_name into strict cname from public.profiles where id=p_actor;
    insert into public.evidence_files(id,institution_id,substation_id,shift_id,version_id,content_hash,collector_id,collector_name,signer_name,confirmation,
      kind,filename,mime_type,byte_size,file_hash,object_path,request_key)
      values(eid,v.institution_id,v.substation_id,v.shift_id,v.id,v.content_hash,p_actor,cname,
        case when p_kind='signature' then btrim(p_signer) end,
        case when p_kind='signature' then 'Confirm cantitățile afișate în această versiune a ciornei declarației de închidere.' end,
        p_kind,p_filename,p_mime,p_size,p_hash,v.substation_id||'/'||v.id||'/'||eid,p_key) returning * into e;
  end if;
  perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
  return e;
end
$$;
create function public.finalize_validated_evidence(p_actor uuid,p_evidence uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.evidence_files; old_sub text:=current_setting('request.jwt.claim.sub',true);
begin
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  select * into e from public.evidence_files where id=p_evidence and collector_id=p_actor;
  if not found then raise exception 'Dovadă inaccesibilă' using errcode='42501'; end if;
  perform app_private.lock_closeout(e.version_id,'Validare fișier privat verificat pe server');
  select * into strict e from public.evidence_files where id=p_evidence for update;
  if e.state='removed' or not exists(select 1 from storage.objects o where o.bucket_id='shift-evidence' and o.name=e.object_path
    and (o.metadata->>'size')::bigint=e.byte_size and o.metadata->>'mimetype'=e.mime_type) then
    raise exception 'Obiectul privat nu este disponibil sau nu corespunde' using errcode='23514'; end if;
  if e.state='pending' then update public.evidence_files set state='validated',validated_at=now() where id=e.id; end if;
  perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
  return e.id;
end
$$;
create function public.remove_draft_evidence(p_evidence uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.evidence_files;
begin
  select * into e from public.evidence_files where id=p_evidence;
  if not found then raise exception 'Dovadă inaccesibilă' using errcode='42501'; end if;
  perform app_private.lock_closeout(e.version_id,'Eliminare dovadă din ciornă');
  update public.evidence_files set state='removed',removed_at=now() where id=e.id and state<>'removed';
  return e.id;
end
$$;
create function public.set_evidence_policy(p_substation uuid,p_policy text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare inst uuid:=app_private.current_institution();
begin
  perform 1 from public.institutions where id=inst for update;
  if not app_private.can_access_station(p_substation) or not (app_private.is_admin(inst) or exists(select 1 from public.role_assignments where user_id=auth.uid() and substation_id=p_substation and role='station_manager')) then
    raise exception 'Politica se configurează de administrator sau șeful substației' using errcode='42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 5 and 500 or p_policy is null or p_policy not in ('optional','at_least_one') then raise exception 'Politică nevalidă' using errcode='22023'; end if;
  perform set_config('app.audit_reason',btrim(p_reason),true);
  update public.substations set evidence_policy=p_policy where id=p_substation;
  return p_substation;
end
$$;
-- M08 must call this contract again under the institution/shift lock before any stock operation.
create function public.closeout_readiness(p_version uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v public.closeout_versions; policy text; count_valid integer; balanced boolean; current_version boolean;
begin
  select * into v from public.closeout_versions where id=p_version;
  if not found or not app_private.read_shift(v.shift_id) then raise exception 'Ciornă inaccesibilă' using errcode='42501'; end if;
  select evidence_policy into policy from public.substations where id=v.substation_id;
  select count(*) into count_valid from public.evidence_files e where e.version_id=v.id and e.state='validated' and e.content_hash=v.content_hash
    and exists(select 1 from storage.objects o where o.bucket_id='shift-evidence' and o.name=e.object_path and (o.metadata->>'size')::bigint=e.byte_size and o.metadata->>'mimetype'=e.mime_type);
  select bool_and((value->>'consumed')::numeric+(value->>'returned')::numeric=(value->>'issued')::numeric) into balanced from jsonb_array_elements(v.content->'lines');
  current_version:=app_private.current_closeout(v.id);
  return jsonb_build_object('current',current_version,'balanced',balanced,'policy',policy,'evidence_count',count_valid,
    'ready',current_version and balanced and (policy='optional' or count_valid>0));
end
$$;
alter table public.closeout_versions enable row level security;
alter table public.evidence_files enable row level security;
revoke all on public.closeout_versions,public.evidence_files from anon,authenticated;
grant select on public.closeout_versions,public.evidence_files to authenticated;
grant all on public.closeout_versions,public.evidence_files to service_role;
create policy read_closeout_versions on public.closeout_versions for select to authenticated using(app_private.read_shift(shift_id));
create policy read_evidence on public.evidence_files for select to authenticated using(app_private.read_shift(shift_id));
create trigger audit_closeouts after insert on public.closeout_versions for each row execute function app_private.write_audit();
create trigger audit_evidence after insert or update on public.evidence_files for each row execute function app_private.write_audit();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('shift-evidence','shift-evidence',false,10485760,array['application/pdf','image/jpeg','image/png']);
create policy read_private_evidence on storage.objects for select to authenticated using(bucket_id='shift-evidence' and exists(
  select 1 from public.evidence_files e where e.object_path=name and e.state='validated' and app_private.read_shift(e.shift_id)));
-- No browser writes, upserts or deletes in Storage. Metadata alone cannot attest file validation.
revoke execute on function app_private.closeout_allocations(uuid),app_private.current_closeout(uuid),app_private.lock_closeout(uuid,text) from public,anon,authenticated;
revoke execute on function public.reserve_validated_evidence(uuid,uuid,uuid,text,text,text,integer,text,text,boolean),public.finalize_validated_evidence(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_validated_evidence(uuid,uuid,uuid,text,text,text,integer,text,text,boolean),public.finalize_validated_evidence(uuid,uuid) to service_role;
revoke execute on function public.save_closeout_draft(uuid,uuid,uuid,jsonb),public.remove_draft_evidence(uuid),public.set_evidence_policy(uuid,text,text),public.closeout_readiness(uuid) from public,anon,authenticated;
grant execute on function public.save_closeout_draft(uuid,uuid,uuid,jsonb),public.remove_draft_evidence(uuid),public.set_evidence_policy(uuid,text,text),public.closeout_readiness(uuid) to authenticated;
commit;
