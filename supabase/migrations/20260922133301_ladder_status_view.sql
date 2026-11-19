-- Enumen beskriver livslopet (produsert -> levert -> installert -> utrangert),
-- ikke servicestatus. Viewet 'ladder_status' er det dashboardet leser.
-- To ulike begreper, to ulike navn.
alter type public.ladder_status rename to ladder_lifecycle_status;

create view public.ladder_status
with (security_invoker = true)
as
select
  base.*,
  (base.next_service_due - current_date) as days_until_service,
  case
    when base.next_service_due is null              then 'unknown'
    when base.next_service_due < current_date       then 'overdue'
    when base.next_service_due <= current_date + 30 then 'due_soon'
    else 'ok'
  end as service_state
from (
  select
    l.id             as ladder_id,
    l.serial_number,
    l.public_code,
    l.status,
    l.produced_at,
    l.installed_at,
    l.vessel_id,
    v.company_id,
    v.name           as vessel_name,
    v.imo,
    p.product_number,
    p.name           as product_name,
    p.length_m,
    p.steps,
    sr.performed_at  as last_service_at,
    sr.result        as last_service_result,
    coalesce(
      sr.next_service_due,
      (l.installed_at + make_interval(months => l.service_interval_months))::date
    )                as next_service_due,
    ml.performed_at  as last_maintenance_at
  from public.ladders l
  join public.products p on p.id = l.product_id
  left join public.vessels v on v.id = l.vessel_id
  left join lateral (
    select s.performed_at, s.result, s.next_service_due
    from public.service_reports s
    where s.ladder_id = l.id
    order by s.performed_at desc
    limit 1
  ) sr on true
  left join lateral (
    select m.performed_at
    from public.maintenance_logs m
    where m.ladder_id = l.id
    order by m.performed_at desc
    limit 1
  ) ml on true
) base;

comment on view public.ladder_status is
  'Beregnet status per leider. Kilden til neste service for dashboard, PDF og paminnelser.';
