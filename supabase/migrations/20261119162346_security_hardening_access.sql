-- Sikkerhetsgjennomgang 19.11.2026: rettelser i tilgangsreglene, del 1 av 3.
--
-- Nettlaget har ingen servicenøkkel, så RLS og funksjonene her er den eneste
-- virkelige grensen. Alt under er ting en innlogget bruker (eller en anonym
-- med den offentlige nøkkelen) kunne gjøre rett mot API-et, uavhengig av hva
-- sidene i portalen tilbyr.

-- (Punkt 1, USAGE på skjemaet app for anon, ligger i migrasjonen anon_app_usage.)

-- ── 2. Ansattrollen kommer bare fra staff_members ───────────────────────────
-- Den gamle veien (app_metadata.staff = true i JWT-en) ga administrator uten
-- at brukeren sto i staff_members, og kunne dermed ikke ses eller fjernes fra
-- admin. Ingen brukere har flagget.
create or replace function app.staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select s.role
    from auth.users u
    join public.staff_members s on lower(s.email::text) = lower(u.email::text)
   where u.id = auth.uid()
     -- Uverifisert adresse gir ingenting: ellers kunne hvem som helst
     -- registrert seg med en ansatts e-post og blitt administrator.
     and u.email_confirmed_at is not null;
$$;

-- ── 3. Medlemmer i et selskap ───────────────────────────────────────────────
-- Den gamle policyen (FOR ALL) lot en selskapsadministrator sette inn en
-- hvilken som helst bruker som medlem, og gjøre seg selv til eier. Nå:
--  - ingen setter inn medlemmer direkte: det skjer når selskapet opprettes
--    (create_my_company) eller en invitasjon godtas (accept_invitation)
--  - bare rollen kan endres, av en administrator i selskapet
--  - en bruker kan selv forlate et selskap
--  - eierrollen kan bare gis og tas av en eier, og den siste eieren blir stående
drop policy company_members_manage on public.company_members;
revoke insert, update on public.company_members from authenticated;
grant update (role) on public.company_members to authenticated;

create policy company_members_update on public.company_members
  for update to authenticated
  using (app.is_company_admin(company_id) or app.is_staff())
  with check (app.is_company_admin(company_id) or app.is_staff());

create policy company_members_delete on public.company_members
  for delete to authenticated
  using (user_id = auth.uid() or app.is_company_admin(company_id) or app.is_staff());

create or replace function app.company_members_guard()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_touches_owner boolean;
  v_removes_owner boolean;
begin
  -- Ansatte, og endringer som ikke kommer fra en innlogget bruker (opprydding
  -- når en konto eller et selskap slettes), styres ikke av disse reglene.
  if auth.uid() is null or app.is_staff() then
    return coalesce(new, old);
  end if;

  v_touches_owner := old.role = 'owner' or (tg_op = 'UPDATE' and new.role = 'owner');
  v_removes_owner := old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner');

  if v_touches_owner and not exists (
    select 1 from public.company_members cm
    where cm.company_id = old.company_id and cm.user_id = auth.uid() and cm.role = 'owner'
  ) then
    raise exception 'Bare en eier kan endre eller fjerne en eier.' using errcode = '42501';
  end if;

  if v_removes_owner and not exists (
    select 1 from public.company_members cm
    where cm.company_id = old.company_id and cm.role = 'owner' and cm.user_id <> old.user_id
  ) then
    raise exception 'Selskapet må ha minst én eier.' using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function app.company_members_guard() from public, anon, authenticated;

create trigger company_members_guard
  before update or delete on public.company_members
  for each row execute function app.company_members_guard();

-- ── 4. Invitasjoner ─────────────────────────────────────────────────────────
-- En invitasjon sender en e-post til en adresse brukeren selv velger, og gir
-- mottakeren tilgang når hun godtar den. Derfor:
--  - eier kan bare inviteres av en eier
--  - navnet på den som inviterer hentes fra profilen, ikke fra klienten
--  - det er et tak på hvor mange en bruker kan sende, og hvor mange én
--    adresse kan få
drop policy access_invitations_insert on public.access_invitations;
create policy access_invitations_insert on public.access_invitations
  for insert to authenticated
  with check (
    (app.can_manage_invitation(scope, company_id, vessel_id, ladder_id) or app.is_staff())
    and invited_by = auth.uid()
    and accepted_at is null
    and accepted_by is null
    and (
      scope <> 'company' or role <> 'owner' or app.is_staff()
      or exists (
        select 1 from public.company_members cm
        where cm.company_id = access_invitations.company_id
          and cm.user_id = auth.uid() and cm.role = 'owner'
      )
    )
  );

create or replace function app.access_invitations_guard()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), p.email::text) into v_name
  from public.profiles p where p.user_id = auth.uid();
  new.invited_by_name := left(coalesce(v_name, 'En bruker'), 120);
  new.message := nullif(left(btrim(coalesce(new.message, '')), 600), '');

  if not app.is_staff() then
    if not app.throttle('invite:user:' || auth.uid(), 20, interval '1 hour') then
      raise exception 'For mange invitasjoner på kort tid. Prøv igjen senere.' using errcode = 'P0001';
    end if;
    if not app.throttle('invite:to:' || lower(new.email::text), 5, interval '1 day') then
      raise exception 'Denne adressen har fått flere invitasjoner i dag. Prøv igjen i morgen.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app.access_invitations_guard() from public, anon, authenticated;

create trigger access_invitations_guard
  before insert on public.access_invitations
  for each row execute function app.access_invitations_guard();

-- ── 5. Saker havner ikke i et selskap brukeren ikke har valgt ───────────────
create or replace function public.create_ticket(
  p_subject text,
  p_body text,
  p_category text default 'support',
  p_ladder uuid default null,
  p_company uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_name    text;
  v_email   text;
  v_company uuid := p_company;
  v_ticket  record;
begin
  if v_uid is null then
    raise exception 'Du må være logget inn.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_subject, ''))) < 3 then
    raise exception 'Skriv en kort overskrift.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_body, ''))) < 1 then
    raise exception 'Beskriv hva saken gjelder.' using errcode = 'P0001';
  end if;
  if p_category not in ('support', 'service', 'spare_parts', 'warranty', 'other') then
    raise exception 'Ugyldig kategori.' using errcode = 'P0001';
  end if;
  if p_ladder is not null and not (app.can_access_ladder(p_ladder) or app.is_staff()) then
    raise exception 'Du har ikke tilgang til denne leideren.' using errcode = '42501';
  end if;
  if not app.throttle('ticket:' || v_uid, 20, interval '1 hour') then
    raise exception 'For mange saker på kort tid. Prøv igjen senere.' using errcode = 'P0001';
  end if;

  -- Selskapet følger leideren hvis den er oppgitt, ellers brukerens eget.
  if p_ladder is not null then
    select l.company_id into v_company from public.ladders l where l.id = p_ladder;
  end if;
  if v_company is not null and not exists (
    select 1 from public.company_members cm
    where cm.company_id = v_company and cm.user_id = v_uid
  ) then
    v_company := null;
  end if;
  -- Uten oppgitt selskap brukes brukerens eget bare når hun har nøyaktig ett.
  -- Er hun medlem av flere, gjettes det ikke: saken blir da hennes egen.
  if v_company is null then
    select case when count(*) = 1 then (array_agg(cm.company_id))[1] end into v_company
    from public.company_members cm where cm.user_id = v_uid;
  end if;

  select p.full_name, p.email::text into v_name, v_email
  from public.profiles p where p.user_id = v_uid;

  insert into public.support_tickets
    (company_id, ladder_id, created_by, contact_name, contact_email, category, subject)
  values
    (v_company, p_ladder, v_uid, v_name, v_email, p_category, left(btrim(p_subject), 200))
  returning * into v_ticket;

  insert into public.ticket_messages (ticket_id, author_id, author_name, from_staff, body)
  values (v_ticket.id, v_uid, coalesce(v_name, v_email), false, left(btrim(p_body), 5000));

  perform app.notify_staff(
    'admin', 'ticket',
    'Ny sak ' || v_ticket.ticket_number || ': ' || v_ticket.subject,
    coalesce(v_name, v_email),
    '/admin/saker/' || v_ticket.id
  );

  return v_ticket.id;
end;
$$;

-- ── 6. Loggføringer fra Min side ────────────────────────────────────────────
-- Policyen sjekket bare hvem som skrev. Kilden («admin» betyr lagt inn av
-- NorthWest Coast), fartøyet og datoen var fritt valg, så en bruker med
-- lesetilgang kunne lage en oppføring som så ut til å komme fra produsenten.
drop policy maintenance_logs_insert on public.maintenance_logs;
create policy maintenance_logs_insert on public.maintenance_logs
  for insert to authenticated
  with check (
    (
      ladder_id is not null
      and app.can_access_ladder(ladder_id)
      and reported_by_user_id = auth.uid()
      and source = 'portal'
      and (performed_at is null or performed_at <= current_date)
      and notified_at is null
      and (vessel_id is null or vessel_id = (
        select l.vessel_id from public.ladders l where l.id = maintenance_logs.ladder_id
      ))
    )
    or app.is_staff()
  );

-- ── 7. Delte tilstandsrapporter ─────────────────────────────────────────────
-- a) Lenkene: alle med tilgang til leideren kunne skrive om andres lenker
--    (åpne en som var trukket tilbake, forlenge den, bytte nøkkelen). Nå kan
--    bare «trukket tilbake» settes, av den som laget lenken eller en som
--    forvalter leideren, og en ny lenke varer høyst 15 dager.
revoke update on public.ladder_state_shares from authenticated;
grant update (revoked_at) on public.ladder_state_shares to authenticated;

drop policy ladder_state_shares_insert on public.ladder_state_shares;
create policy ladder_state_shares_insert on public.ladder_state_shares
  for insert to authenticated
  with check (
    (app.can_access_ladder(ladder_id) or app.is_staff())
    and created_by = auth.uid()
    and revoked_at is null
    and expires_at <= now() + interval '15 days'
  );

drop policy ladder_state_shares_revoke on public.ladder_state_shares;
create policy ladder_state_shares_revoke on public.ladder_state_shares
  for update to authenticated
  using (created_by = auth.uid() or app.can_manage_ladder(ladder_id) or app.is_staff())
  with check (revoked_at is not null);

create or replace function app.ladder_state_shares_stamp()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_name text;
begin
  -- Navnet på den som deler vises i rapporten, og skal være det som står i
  -- profilen, ikke noe klienten har sendt.
  if auth.uid() is not null then
    select coalesce(nullif(btrim(p.full_name), ''), p.email::text) into v_name
    from public.profiles p where p.user_id = auth.uid();
    new.created_by_name := left(coalesce(v_name, new.created_by_name), 120);
  end if;
  return new;
end;
$$;

revoke all on function app.ladder_state_shares_stamp() from public, anon, authenticated;

create trigger ladder_state_shares_stamp
  before insert on public.ladder_state_shares
  for each row execute function app.ladder_state_shares_stamp();

-- b) Bildene: regelen var «den som kjenner delings-id-en ser bildene», men
--    den slo til for alle aktive delinger, så hvem som helst med den
--    offentlige nøkkelen kunne liste og hente bildene uten lenken. Nå må den
--    som ikke er innlogget med tilgang, sende selve nøkkelen fra lenken i
--    hodet x-share-token. Sidene på /los gjør det når de signerer bildene.
--    Mangler hodet, vises ingen bilder.
create or replace function app.can_read_share_photo(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.ladder_state_shares s
    where s.id = app.uuid_or_null(p_folder)
      and (
        app.can_access_ladder(s.ladder_id)
        or app.is_staff()
        or (
          s.revoked_at is null and s.expires_at > now()
          -- Samme utregning som i get_ladder_share().
          and s.token_hash = encode(sha256(convert_to(coalesce(
                nullif(current_setting('request.headers', true), '')::json ->> 'x-share-token', ''), 'UTF8')), 'hex')
        )
      )
  );
$$;

-- ── 8. Montering av leider ──────────────────────────────────────────────────
create or replace function public.install_ladder(
  p_ladder uuid,
  p_vessel uuid,
  p_installed_at date default current_date,
  p_project uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_status public.ladder_lifecycle_status;
  v_owner  uuid;
  v_target uuid;
begin
  if not (app.can_manage_ladder(p_ladder) or app.is_staff()) then
    raise exception 'Du kan ikke endre denne leideren.' using errcode = '42501';
  end if;

  if p_vessel is null and p_project is null then
    update public.ladders
       set vessel_id = null,
           project_id = null,
           status = case when status = 'installed' then 'delivered' else status end
     where id = p_ladder;
    return;
  end if;

  select l.status into v_status from public.ladders l where l.id = p_ladder;
  if v_status not in ('delivered', 'installed') and not app.is_staff() then
    if v_status = 'in_production' then
      raise exception 'Leideren er ikke levert ennå.' using errcode = 'P0001';
    end if;
    raise exception 'Leideren er utrangert og kan ikke tas i bruk.' using errcode = 'P0001';
  end if;

  if p_vessel is not null and not (app.can_manage_vessel(p_vessel) or app.is_staff()) then
    raise exception 'Du kan ikke legge leidere til dette fartøyet.' using errcode = '42501';
  end if;
  if p_project is not null and not (app.can_manage_project(p_project) or app.is_staff()) then
    raise exception 'Du kan ikke legge leidere til dette prosjektet.' using errcode = '42501';
  end if;

  -- Datoen styrer neste servicefrist, så den kan ikke ligge fram i tid.
  if p_installed_at > current_date then
    raise exception 'Datoen kan ikke ligge fram i tid.' using errcode = 'P0001';
  end if;

  -- Leideren følger selskapet til fartøyet eller prosjektet den settes på
  -- (se ladders_sync_company). Å sette den på noe som tilhører et annet
  -- selskap flytter den altså dit, og det kan bare eierselskapet gjøre.
  select l.company_id into v_owner from public.ladders l where l.id = p_ladder;
  select coalesce(
    (select v.company_id from public.vessels v where v.id = p_vessel),
    (select p.company_id from public.projects p where p.id = p_project)
  ) into v_target;
  if v_owner is not null and v_target is distinct from v_owner
     and not (app.is_company_admin(v_owner) or app.is_staff()) then
    raise exception 'Bare eierselskapet kan flytte leideren til et annet selskap.' using errcode = '42501';
  end if;

  update public.ladders
     set vessel_id = p_vessel,
         project_id = p_project,
         installed_at = coalesce(p_installed_at, current_date),
         status = 'installed'
   where id = p_ladder;
end;
$$;

-- ── 9. Avbestilling av service ──────────────────────────────────────────────
-- Lesetilgang til leideren var nok til å avbestille andres bestilling.
create or replace function public.cancel_service_booking(p_booking uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_booking record;
begin
  select b.* into v_booking from public.service_bookings b where b.id = p_booking for update;

  if v_booking.id is null
     or not (v_booking.requested_by = auth.uid()
             or app.can_manage_ladder(v_booking.ladder_id)
             or app.is_staff()) then
    raise exception 'Fant ikke bestillingen.' using errcode = 'P0001';
  end if;
  if v_booking.status not in ('requested', 'scheduled') then
    raise exception 'Bestillingen kan ikke avbestilles.' using errcode = 'P0001';
  end if;

  update public.service_bookings set status = 'cancelled' where id = p_booking;

  perform app.notify_staff(
    'admin', 'service_cancelled', 'En servicebestilling er avbestilt',
    v_booking.requester_name, '/admin/service'
  );
end;
$$;

-- ── 10. Bilder til vedlikeholdsrapporter ────────────────────────────────────
create or replace function app.can_upload_log_photo(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.maintenance_logs m
    where m.id = app.uuid_or_null(p_folder)
      and (
        app.is_staff()
        or (auth.uid() is not null and m.reported_by_user_id = auth.uid()
            and m.created_at > now() - interval '1 day')
        -- Det åpne skjemaet: mappen er åpen en halvtime, til rapporten er avsluttet.
        or (m.source = 'web' and m.notified_at is null
            and m.created_at > now() - interval '30 minutes')
      )
  )
  -- Et tak på antall filer per loggføring, så en åpen mappe ikke kan fylles.
  and (
    app.is_staff()
    or (select count(*) from storage.objects o
         where o.bucket_id = 'maintenance-photos'
           and o.name like p_folder || '/%') < 12
  );
$$;
