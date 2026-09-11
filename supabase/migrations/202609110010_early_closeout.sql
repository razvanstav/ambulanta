-- Explicit owner-authorized early closeout; preserve the original planned interval.
begin;

create function app_private.finalize_vehicle_closeout(p_version uuid,p_key uuid,p_early boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.closeout_versions; s public.shifts; op uuid; loc uuid; wh uuid; l jsonb;
begin
 select * into strict v from public.closeout_versions where id=p_version;
 select * into strict s from public.shifts where id=v.shift_id;
 if s.planned_end is null or (not p_early and clock_timestamp()<s.planned_end) then raise exception 'Tura nu a ajuns la finalul programat' using errcode='23514'; end if;
 if not coalesce((public.closeout_readiness(v.id)->>'ready')::boolean,false) then raise exception 'Declarația sau dovezile nu sunt pregătite' using errcode='23514'; end if;
 loc:=app_private.vehicle_location(s.vehicle_id); wh:=app_private.warehouse_location(s.substation_id);
 insert into public.inventory_operations(institution_id,substation_id,kind,request_key,request_payload,actor_id)
 values(s.institution_id,s.substation_id,'closeout',p_key,
   case when p_early then jsonb_build_object('closeout',v.id,'early',true,'reason',current_setting('app.audit_reason',true)) else jsonb_build_object('closeout',v.id) end,
   auth.uid()) returning id into op;
 for l in select value from jsonb_array_elements(v.content->'lines') order by value->>'lot_id',value->>'allocation_id' loop
  if (l->>'consumed')::numeric>0 then perform app_private.move_stock(op,(l->>'lot_id')::uuid,loc,null,(l->>'consumed')::numeric); end if;
  if (l->>'returned')::numeric>0 then perform app_private.move_stock(op,(l->>'lot_id')::uuid,loc,wh,(l->>'returned')::numeric); end if;
 end loop;
 update public.issue_sheet_versions set state='withdrawn',note='Închidere tură înainte de acceptarea suplimentării' where shift_id=s.id and state in ('draft','sent','disputed');
 update public.shifts set state='closed',closed_at=clock_timestamp(),final_closeout_id=v.id where id=s.id;
 return s.id;
end
$$;

create or replace function app_private.finalize_vehicle_closeout(p_version uuid,p_key uuid) returns uuid
language sql security definer set search_path='' as $$
 select app_private.finalize_vehicle_closeout(p_version,p_key,false)
$$;

create function public.close_shift_early(p_shift uuid,p_expected_version uuid,p_request_key uuid,p_lines jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.shifts; v uuid; reason text;
begin
 reason:=btrim(p_reason);
 if reason is null or length(reason)<5 or length(reason)>500 or p_request_key is null then
  raise exception 'Completează motivul închiderii anticipate (5–500 caractere)' using errcode='22023'; end if;
 s:=app_private.lock_shift_actor(p_shift,false,reason);
 if not app_private.owns_shift(s.id) then raise exception 'Numai titularul închide anticipat' using errcode='42501'; end if;
 if exists(select 1 from jsonb_array_elements(p_lines) l where (l->>'returned')::numeric<>0) then
  raise exception 'Închiderea anticipată păstrează restul în mașină' using errcode='23514'; end if;
 v:=public.save_closeout_draft(p_shift,p_expected_version,p_request_key,p_lines);
 if s.state='closed' and s.final_closeout_id=v then
  if not exists(select 1 from public.inventory_operations o where o.institution_id=s.institution_id and o.request_key=p_request_key
   and o.actor_id=auth.uid() and o.request_payload=jsonb_build_object('closeout',v,'early',true,'reason',reason)) then
   raise exception 'Cheie reutilizată cu alt conținut' using errcode='22023'; end if;
  return s.id;
 end if;
 if s.state<>'open' then raise exception 'Tura nu este activă' using errcode='23514'; end if;
 perform set_config('app.audit_reason',reason,true);
 return app_private.finalize_vehicle_closeout(v,p_request_key,true);
end
$$;

revoke all on function app_private.finalize_vehicle_closeout(uuid,uuid,boolean),app_private.finalize_vehicle_closeout(uuid,uuid) from public,anon,authenticated;
revoke all on function public.close_shift_early(uuid,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.close_shift_early(uuid,uuid,uuid,jsonb,text) to authenticated;
commit;
