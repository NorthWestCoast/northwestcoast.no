-- ============================================================================
-- Row Level Security.
--
-- Prinsipp: RLS er autorisasjonslaget. Server-komponenter leser gjennom
-- brukerens egen sesjon, slik at et glemt WHERE-ledd ikke kan lekke data
-- mellom rederier.
--
-- Hjelpefunksjonene er SECURITY DEFINER med vilje. Uten det ville et policy
-- på company_members som slår opp i company_members gi uendelig rekursjon –
-- den klassiske Supabase-fella. SECURITY DEFINER omgår RLS inne i funksjonen,
-- og `set search_path` hindrer search_path-injeksjon.
-- ============================================================================

-- ── Hjelpefunksjoner ────────────────────────────────────────────────────────

create or replace function public.auth_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.company_members where user_id = auth.uid();
$$;

create or replace function public.is_company_admin(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = target
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- NWC-ansatt. Settes som app_metadata.staff = true på brukeren; app_metadata
-- kan ikke endres av brukeren selv, i motsetning til user_metadata.
create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false);
$$;

create or replace function public.can_access_ladder(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ladders l
    join public.vessels v on v.id = l.vessel_id
    join public.company_members cm on cm.company_id = v.company_id
    where l.id = target and cm.user_id = auth.uid()
  );
$$;

revoke execute on function public.auth_company_ids()      from public, anon;
revoke execute on function public.is_company_admin(uuid)  from public, anon;
revoke execute on function public.can_access_ladder(uuid) from public, anon;
grant  execute on function public.auth_company_ids()      to authenticated;
grant  execute on function public.is_company_admin(uuid)  to authenticated;
grant  execute on function public.can_access_ladder(uuid) to authenticated;

-- ── Slå på RLS overalt ──────────────────────────────────────────────────────

alter table public.companies             enable row level security;
alter table public.company_members       enable row level security;
alter table public.company_invitations   enable row level security;
alter table public.vessels               enable row level security;
alter table public.vessel_members        enable row level security;
alter table public.products              enable row level security;
alter table public.ladders               enable row level security;
alter table public.orders                enable row level security;
alter table public.order_lines           enable row level security;
alter table public.deliveries            enable row level security;
alter table public.service_reports       enable row level security;
alter table public.maintenance_logs      enable row level security;
alter table public.maintenance_photos    enable row level security;
alter table public.ladder_state_shares   enable row level security;
alter table public.ladder_state_photos   enable row level security;
alter table public.contact_requests      enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.email_log             enable row level security;

-- ── Selskap og medlemmer ────────────────────────────────────────────────────

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

-- ── Fartøy ──────────────────────────────────────────────────────────────────

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

-- ── Produkter: prislista er allerede offentlig på nettsiden ─────────────────

create policy products_select_active on public.products
  for select to anon, authenticated
  using (active or public.is_staff());

create policy products_manage on public.products
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ── Leidere ─────────────────────────────────────────────────────────────────
-- Leidere uten fartøy er NWC-lager og synes kun for ansatte.

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

-- ── Bestillinger ────────────────────────────────────────────────────────────
-- Innsending fra nettsiden går via route handler med service-role, som
-- omgår RLS. Derfor finnes ingen insert-policy for anon her med vilje.

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

-- ── Service og vedlikehold ──────────────────────────────────────────────────

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

-- ── Los-deling ──────────────────────────────────────────────────────────────
-- INGEN anon-policy. Den offentlige siden går via route handler med
-- service-role etter at tokenet er verifisert på serveren.

create policy ladder_state_shares_select on public.ladder_state_shares
  for select to authenticated
  using (public.can_access_ladder(ladder_id) or public.is_staff());

create policy ladder_state_shares_insert on public.ladder_state_shares
  for insert to authenticated
  with check (public.can_access_ladder(ladder_id) or public.is_staff());

-- Tilbaketrekking er en update; selve raden skal ikke kunne omskrives fritt.
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

-- ── Interne tabeller: kun ansatte ───────────────────────────────────────────

create policy contact_requests_staff on public.contact_requests
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy newsletter_subscribers_staff on public.newsletter_subscribers
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy email_log_staff on public.email_log
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
