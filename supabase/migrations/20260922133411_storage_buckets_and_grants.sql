insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('maintenance-photos',  'maintenance-photos',  false, 10485760,
   array['image/jpeg','image/png','image/webp','image/heic']),
  ('ladder-state-photos', 'ladder-state-photos', false, 10485760,
   array['image/jpeg','image/png','image/webp','image/heic']),
  ('service-reports',     'service-reports',     false, 20971520,
   array['application/pdf'])
on conflict (id) do nothing;

revoke all on all tables in schema public from anon, authenticated;

grant select on public.products to anon;

grant select on
  public.companies,
  public.company_members,
  public.company_invitations,
  public.vessels,
  public.vessel_members,
  public.products,
  public.ladders,
  public.orders,
  public.order_lines,
  public.deliveries,
  public.service_reports,
  public.maintenance_logs,
  public.maintenance_photos,
  public.ladder_state_shares,
  public.ladder_state_photos,
  public.ladder_status
to authenticated;

grant insert on public.maintenance_logs    to authenticated;
grant insert on public.ladder_state_shares to authenticated;
grant update on public.ladder_state_shares to authenticated;
grant insert on public.ladder_state_photos to authenticated;

grant update on public.companies to authenticated;
grant insert, update, delete on public.company_members     to authenticated;
grant insert, update, delete on public.company_invitations to authenticated;
grant insert, update, delete on public.vessels             to authenticated;
grant insert, update, delete on public.vessel_members      to authenticated;

grant insert, update, delete on
  public.ladders, public.products, public.orders, public.order_lines,
  public.deliveries, public.service_reports
to authenticated;

grant usage, select on all sequences in schema public to authenticated;
