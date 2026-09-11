-- M09: read-only reporting. STABLE keeps every query on the caller's snapshot.
begin;
create function public.read_reports(
  p_station uuid, p_from date, p_until date, p_own boolean default false,
  p_group text default 'day', p_holder uuid default null,
  p_vehicle uuid default null, p_shift uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or app_private.current_institution() is null then
    raise exception 'Acces refuzat' using errcode='42501';
  end if;
  if p_own is null or p_from is null or p_until is null or p_until<=p_from
    or p_until-p_from>366 or p_from<date '1900-01-01' or p_until>date '9999-12-31'
    or p_group is null or p_group not in ('day','week','shift','holder','vehicle','station','product') then
    raise exception 'Filtre invalide: intervalul trebuie să aibă 1–366 zile' using errcode='22023';
  end if;
  if p_station is not null and not app_private.can_access_station(p_station) then
    raise exception 'Substație inaccesibilă' using errcode='42501';
  end if;
  if not p_own and not exists(select 1 from public.substations t
    where (p_station is null or t.id=p_station) and app_private.can_view_logistics(t.id)) then
    raise exception 'Acces logistic refuzat' using errcode='42501';
  end if;
  with scope as materialized (
    select id,name from public.substations t where (p_station is null or t.id=p_station)
      and case when p_own then app_private.can_access_station(t.id)
        else app_private.can_view_logistics(t.id) end
  ), selected as materialized (
    select s.*,t.name station from public.shifts s join scope t on t.id=s.substation_id
    where (not p_own or s.owner_id=auth.uid())
      and (p_holder is null or s.employee_id=p_holder)
      and (p_vehicle is null or s.vehicle_id=p_vehicle)
      and (p_shift is null or s.id=p_shift)
  ), finished as materialized (
    select s.*,v.content,v.version,v.content_hash from selected s
    join public.closeout_versions v on v.id=s.final_closeout_id and v.shift_id=s.id
    where s.state='closed' and s.operational_date>=p_from and s.operational_date<p_until
  ), consumption as (
    select s.substation_id,s.station,
      case p_group when 'day' then s.operational_date::text
        when 'week' then date_trunc('week',s.operational_date::timestamp)::date::text
        when 'shift' then s.id::text when 'holder' then s.employee_id::text
        when 'vehicle' then s.vehicle_id::text when 'station' then s.substation_id::text
        else 'Total perioadă' end bucket,
      case p_group when 'holder' then s.content->>'holder_name'
        when 'vehicle' then s.content->>'vehicle' else null end label,
      a.product_id, line->>'product_name' product, line->>'base_unit' unit,
      sum((line->>'consumed')::numeric)::text consumed
    from finished s cross join lateral jsonb_array_elements(s.content->'lines') line
    join public.shift_stock_allocations a on a.id=(line->>'allocation_id')::uuid and a.shift_id=s.id
    group by s.substation_id,s.station,bucket,label,a.product_id,product,unit
  ), journal as materialized (
    select m.*,o.kind,o.occurred_at,src.kind source_kind,dst.kind destination_kind
    from public.inventory_movements m join scope t on t.id=m.substation_id
    join public.inventory_operations o on o.id=m.operation_id
    left join public.inventory_locations src on src.id=m.source_id
    left join public.inventory_locations dst on dst.id=m.destination_id
    where not p_own and o.occurred_at < (p_until::timestamp at time zone 'Europe/Bucharest')
      and (src.kind='warehouse' or dst.kind='warehouse')
  ), warehouse as (
    select j.substation_id,t.name station,j.product_id,p.name product,p.base_unit unit,
      coalesce(sum(case when j.destination_kind='warehouse' then j.quantity else -j.quantity end)
        filter(where j.occurred_at<(p_from::timestamp at time zone 'Europe/Bucharest')),0)::text opening,
      coalesce(sum(j.quantity) filter(where j.source_id is null and j.destination_kind='warehouse'
        and j.occurred_at>=(p_from::timestamp at time zone 'Europe/Bucharest')),0)::text received,
      coalesce(sum(j.quantity) filter(where j.source_kind='warehouse'
        and j.occurred_at>=(p_from::timestamp at time zone 'Europe/Bucharest')),0)::text issued,
      coalesce(sum(j.quantity) filter(where j.source_id is not null and j.destination_kind='warehouse'
        and j.occurred_at>=(p_from::timestamp at time zone 'Europe/Bucharest')),0)::text returned,
      sum(case when j.destination_kind='warehouse' then j.quantity else -j.quantity end)::text closing
    from journal j join scope t on t.id=j.substation_id join public.products p on p.id=j.product_id
    group by j.substation_id,t.name,j.product_id,p.name,p.base_unit
  ), stock as (
    select b.substation_id,t.name station,b.product_id,p.name product,p.base_unit unit,
      l.id location_id,case when l.kind='warehouse' then 'Magazie' else coalesce(v.identifier,'Stoc istoric') end location,
      l.kind,sum(b.quantity)::text quantity
    from public.stock_balances b join scope t on t.id=b.substation_id
    join public.inventory_locations l on l.id=b.location_id
    join public.products p on p.id=b.product_id left join public.vehicles v on v.id=l.vehicle_id
    where not p_own group by b.substation_id,t.name,b.product_id,p.name,p.base_unit,l.id,l.kind,v.identifier
  )
  select jsonb_build_object(
    'generated_at',statement_timestamp(),'from',p_from,'until',p_until,'own',p_own,'group',p_group,
    'stations',coalesce((select jsonb_agg(to_jsonb(t) order by name,id) from scope t),'[]'::jsonb),
    'consumption',coalesce((select jsonb_agg(to_jsonb(c) order by station,bucket,product,product_id) from consumption c),'[]'::jsonb),
    'warehouse',coalesce((select jsonb_agg(to_jsonb(w) order by station,product,product_id) from warehouse w),'[]'::jsonb),
    'stock',coalesce((select jsonb_agg(to_jsonb(b) order by station,location,product,product_id) from stock b),'[]'::jsonb),
    'closed',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'station',s.station,'holder',s.content->>'holder_name',
      'vehicle',s.content->>'vehicle','operational_date',s.operational_date,'closed_at',s.closed_at,
      'version',s.version,'content_hash',s.content_hash) order by s.operational_date,s.id) from finished s),'[]'::jsonb),
    'pending',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'station',s.station,'holder',s.holder_name,
      'vehicle',s.vehicle_identifier,'state',s.state,'operational_date',s.operational_date,'planned_end',s.planned_end)
      order by s.requested_at,s.id) from selected s where s.state in ('awaiting_issue','awaiting_acceptance','open','pending_close')),'[]'::jsonb),
    'holders',coalesce((select jsonb_agg(x order by x->>'name',x->>'id') from
      (select distinct jsonb_build_object('id',s.employee_id,'name',s.holder_name) x from public.shifts s join scope t on t.id=s.substation_id where not p_own or s.owner_id=auth.uid()) h),'[]'::jsonb),
    'vehicles',coalesce((select jsonb_agg(x order by x->>'name',x->>'id') from
      (select distinct jsonb_build_object('id',s.vehicle_id,'name',s.vehicle_identifier) x from public.shifts s join scope t on t.id=s.substation_id where not p_own or s.owner_id=auth.uid()) v),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.read_reports(uuid,date,date,boolean,text,uuid,uuid,uuid) from public,anon;
grant execute on function public.read_reports(uuid,date,date,boolean,text,uuid,uuid,uuid) to authenticated;
commit;
