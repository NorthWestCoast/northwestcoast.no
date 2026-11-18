create policy companies_select on public.companies
  for select to authenticated
  using (id in (select public.auth_company_ids()) or public.is_staff());

create policy companies_update on public.companies
  for update to authenticated
  using (public.is_company_admin(id) or public.is_staff())
  with check (public.is_company_admin(id) or public.is_staff());

create policy company_members_select on public.company_members
  for select to authenticated
  using (company_id in (select public.auth_company_ids()) or public.is_staff());

create policy company_members_manage on public.company_members
  for all to authenticated
  using (public.is_company_admin(company_id) or public.is_staff())
  with check (public.is_company_admin(company_id) or public.is_staff());

create policy company_invitations_manage on public.company_invitations
  for all to authenticated
  using (public.is_company_admin(company_id) or public.is_staff())
  with check (public.is_company_admin(company_id) or public.is_staff());

create policy vessels_select on public.vessels
  for select to authenticated
  using (company_id in (select public.auth_company_ids()) or public.is_staff());

create policy vessels_manage on public.vessels
  for all to authenticated
  using (public.is_company_admin(company_id) or public.is_staff())
  with check (public.is_company_admin(company_id) or public.is_staff());

create policy vessel_members_select on public.vessel_members
  for select to authenticated
  using (
    exists (
      select 1 from public.vessels v
      where v.id = vessel_id
        and v.company_id in (select public.auth_company_ids())
    )
    or public.is_staff()
  );

create policy vessel_members_manage on public.vessel_members
  for all to authenticated
  using (
    exists (
      select 1 from public.vessels v
      where v.id = vessel_id and public.is_company_admin(v.company_id)
    )
    or public.is_staff()
  )
  with check (
    exists (
      select 1 from public.vessels v
      where v.id = vessel_id and public.is_company_admin(v.company_id)
    )
    or public.is_staff()
  );

create policy products_select_active on public.products
  for select to anon, authenticated
  using (active or public.is_staff());

create policy products_manage on public.products
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy ladders_select on public.ladders
  for select to authenticated
  using (
    (vessel_id is not null and exists (
      select 1 from public.vessels v
      where v.id = vessel_id
        and v.company_id in (select public.auth_company_ids())
    ))
    or public.is_staff()
  );

create policy ladders_manage on public.ladders
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy orders_select on public.orders
  for select to authenticated
  using (company_id in (select public.auth_company_ids()) or public.is_staff());

create policy orders_manage on public.orders
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy order_lines_select on public.order_lines
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.company_id in (select public.auth_company_ids()) or public.is_staff())
    )
  );

create policy order_lines_manage on public.order_lines
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy deliveries_select on public.deliveries
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.company_id in (select public.auth_company_ids()) or public.is_staff())
    )
  );

create policy deliveries_manage on public.deliveries
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy service_reports_select on public.service_reports
  for select to authenticated
  using (public.can_access_ladder(ladder_id) or public.is_staff());

create policy service_reports_manage on public.service_reports
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy maintenance_logs_select on public.maintenance_logs
  for select to authenticated
  using (
    (ladder_id is not null and public.can_access_ladder(ladder_id))
    or (vessel_id is not null and exists (
      select 1 from public.vessels v
      where v.id = vessel_id
        and v.company_id in (select public.auth_company_ids())
    ))
    or public.is_staff()
  );

create policy maintenance_logs_insert on public.maintenance_logs
  for insert to authenticated
  with check (
    (ladder_id is not null and public.can_access_ladder(ladder_id))
    or public.is_staff()
  );

create policy maintenance_photos_select on public.maintenance_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.maintenance_logs m
      where m.id = maintenance_log_id
        and (
          (m.ladder_id is not null and public.can_access_ladder(m.ladder_id))
          or public.is_staff()
        )
    )
  );

create policy ladder_state_shares_select on public.ladder_state_shares
  for select to authenticated
  using (public.can_access_ladder(ladder_id) or public.is_staff());

create policy ladder_state_shares_insert on public.ladder_state_shares
  for insert to authenticated
  with check (public.can_access_ladder(ladder_id) or public.is_staff());

create policy ladder_state_shares_revoke on public.ladder_state_shares
  for update to authenticated
  using (public.can_access_ladder(ladder_id) or public.is_staff())
  with check (public.can_access_ladder(ladder_id) or public.is_staff());

create policy ladder_state_photos_select on public.ladder_state_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.ladder_state_shares s
      where s.id = share_id
        and (public.can_access_ladder(s.ladder_id) or public.is_staff())
    )
  );

create policy ladder_state_photos_insert on public.ladder_state_photos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.ladder_state_shares s
      where s.id = share_id and public.can_access_ladder(s.ladder_id)
    )
  );

create policy contact_requests_staff on public.contact_requests
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy newsletter_subscribers_staff on public.newsletter_subscribers
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy email_log_staff on public.email_log
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
