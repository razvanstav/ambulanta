-- One-step shift closeout: consumed material is posted and the balance stays in the vehicle.
begin;

alter table public.substations alter column evidence_policy set default 'optional';
update public.substations set evidence_policy = 'optional' where evidence_policy <> 'optional';

create function public.close_shift_simple(
  p_shift uuid,
  p_expected_version uuid,
  p_request_key uuid,
  p_lines jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_version uuid;
begin
  if p_request_key is null then
    raise exception 'Cheie obligatorie' using errcode = '22023';
  end if;

  v_version := public.save_closeout_draft(
    p_shift,
    p_expected_version,
    p_request_key,
    p_lines
  );
  return public.submit_vehicle_closeout(v_version, p_request_key);
end
$$;

revoke all on function public.close_shift_simple(uuid,uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.close_shift_simple(uuid,uuid,uuid,jsonb)
  to authenticated;

commit;
