-- ============================================================================
-- Portal v2 – del 1: roller, profiler, tilgang, invitasjoner, varsler
--
-- Hele portalen kjører på brukerens egen sesjon. Det som krever mer enn
-- brukeren selv har lov til (løse inn en invitasjon, be om tilgang til en
-- leider man ikke ser, ta imot en bestilling fra en uinnlogget besøkende),
-- gjøres av SECURITY DEFINER-funksjoner som autoriserer selv. Nettlaget
-- trenger dermed ingen service-role-nøkkel.
-- ============================================================================

-- ── 0. Standardrettigheter ──────────────────────────────────────────────────
-- Supabase gir nye objekter i public alle rettigheter for anon og
-- authenticated. Det har allerede gitt to hull. Fra nå av får nye tabeller,
-- sekvenser og funksjoner ingenting før migrasjonen selv deler ut noe.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
alter default privileges for role postgres
  revoke execute on functions from public;

-- ── 1. Ansatte ──────────────────────────────────────────────────────────────
-- Ansatt-rollen følger en verifisert e-postadresse, ikke et flagg som må
-- settes med SQL per bruker. Da kan en administrator legge til en kollega
-- fra admin-siden før kollegaen har logget inn første gang.
create type public.staff_role as enum ('admin', 'production');

create table public.staff_members (
  email      citext primary key,
  role       public.staff_role not null default 'admin',
  full_name  text,
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.staff_members enable row level security;

create or replace function app.staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(
    (select s.role
       from auth.users u
       join public.staff_members s on lower(s.email::text) = lower(u.email::text)
      where u.id = auth.uid()
        -- Uverifisert adresse gir ingenting: ellers kunne hvem som helst
        -- registrert seg med en ansatts e-post og blitt administrator.
        and u.email_confirmed_at is not null),
    case
      when coalesce((auth.jwt() -> 'app_metadata' ->> 'staff')::boolean, false)
      then 'admin'::public.staff_role
    end
  );
$$;

-- Samme funksjon som alle eksisterende policyer bruker; bare innholdet byttes.
create or replace function app.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(app.staff_role() = 'admin'::public.staff_role, false);
$$;

-- Administrator eller produksjon.
create or replace function app.is_production()
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.staff_role() is not null;
$$;

grant execute on function app.staff_role()    to anon, authenticated, service_role;
grant execute on function app.is_staff()      to anon, authenticated, service_role;
grant execute on function app.is_production() to anon, authenticated, service_role;

create policy staff_members_select on public.staff_members
  for select to authenticated
  using (app.is_production());

create policy staff_members_manage on public.staff_members
  for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

grant select, insert, update, delete on public.staff_members to authenticated;

-- Den siste administratoren kan ikke fjernes eller nedgraderes. Uten denne
-- kan ett feilklikk låse alle ute av admin.
create or replace function public.staff_members_keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.email <> old.email)
     and not exists (
       select 1 from public.staff_members s
       where s.role = 'admin' and s.email <> old.email
     ) then
    raise exception 'Den siste administratoren kan ikke fjernes.' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger staff_members_keep_one_admin
  before update or delete on public.staff_members
  for each row execute function public.staff_members_keep_one_admin();

-- ── 2. Profiler ─────────────────────────────────────────────────────────────
create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        citext not null,
  full_name    text,
  phone        text,
  title        text,
  notify_email boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

create index profiles_email_idx on public.profiles (email);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- ── 3. Selskap: kontaktopplysninger ─────────────────────────────────────────
alter table public.companies
  add column contact_name  text,
  add column contact_email citext,
  add column contact_phone text;

-- ── 4. Leidere: eierselskap og egen tilgang ─────────────────────────────────
-- En leider kan tilhøre en kunde før den er montert på et fartøy (i
-- produksjon, eller levert men ikke installert).
alter table public.ladders
  add column company_id uuid references public.companies(id) on delete set null;

create index ladders_company_idx on public.ladders (company_id);

create or replace function public.ladders_sync_company()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  if new.vessel_id is not null then
    select v.company_id into new.company_id
    from public.vessels v where v.id = new.vessel_id;
  end if;
  return new;
end;
$$;

create trigger ladders_sync_company
  before insert or update of vessel_id on public.ladders
  for each row execute function public.ladders_sync_company();

create table public.ladder_members (
  ladder_id  uuid not null references public.ladders(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'viewer' check (role in ('manager', 'viewer')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (ladder_id, user_id)
);

create index ladder_members_user_idx on public.ladder_members (user_id);

alter table public.ladder_members enable row level security;

-- ── 5. Tilgangsfunksjoner ───────────────────────────────────────────────────
-- Tilgang til en leider kan komme tre veier: medlem av eierselskapet,
-- medlem av fartøyet, eller direkte tilgang til akkurat den leideren.
create or replace function app.can_access_ladder(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.ladders l
    where l.id = target
      and (
        exists (select 1 from public.company_members cm
                where cm.company_id = l.company_id and cm.user_id = auth.uid())
        or exists (select 1 from public.vessel_members vm
                   where vm.vessel_id = l.vessel_id and vm.user_id = auth.uid())
        or exists (select 1 from public.ladder_members lm
                   where lm.ladder_id = l.id and lm.user_id = auth.uid())
      )
  );
$$;

create or replace function app.can_manage_ladder(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.ladders l
    where l.id = target
      and (
        exists (select 1 from public.company_members cm
                where cm.company_id = l.company_id and cm.user_id = auth.uid()
                  and cm.role in ('owner', 'admin'))
        or exists (select 1 from public.vessel_members vm
                   where vm.vessel_id = l.vessel_id and vm.user_id = auth.uid()
                     and vm.role = 'master')
        or exists (select 1 from public.ladder_members lm
                   where lm.ladder_id = l.id and lm.user_id = auth.uid()
                     and lm.role = 'manager')
      )
  );
$$;

create or replace function app.can_access_vessel(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.vessels v
    where v.id = target
      and (
        exists (select 1 from public.company_members cm
                where cm.company_id = v.company_id and cm.user_id = auth.uid())
        or exists (select 1 from public.vessel_members vm
                   where vm.vessel_id = v.id and vm.user_id = auth.uid())
        or exists (select 1 from public.ladders l
                   join public.ladder_members lm on lm.ladder_id = l.id
                   where l.vessel_id = v.id and lm.user_id = auth.uid())
      )
  );
$$;

create or replace function app.can_manage_vessel(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.vessels v
    where v.id = target
      and (
        exists (select 1 from public.company_members cm
                where cm.company_id = v.company_id and cm.user_id = auth.uid()
                  and cm.role in ('owner', 'admin'))
        or exists (select 1 from public.vessel_members vm
                   where vm.vessel_id = v.id and vm.user_id = auth.uid()
                     and vm.role = 'master')
      )
  );
$$;

-- Hvem får se hvem sin profil: en selv, kolleger i samme selskap, og de man
-- har gitt tilgang til egne fartøy og leidere.
create or replace function app.can_see_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select target = auth.uid()
    or exists (
      select 1
      from public.company_members mine
      join public.company_members theirs on theirs.company_id = mine.company_id
      where mine.user_id = auth.uid() and theirs.user_id = target
    )
    or exists (
      select 1 from public.vessel_members vm
      where vm.user_id = target and app.can_manage_vessel(vm.vessel_id)
    )
    or exists (
      select 1 from public.ladder_members lm
      where lm.user_id = target and app.can_manage_ladder(lm.ladder_id)
    );
$$;

revoke execute on function app.can_access_ladder(uuid) from public, anon;
grant execute on function app.can_access_ladder(uuid)  to authenticated, service_role;
grant execute on function app.can_manage_ladder(uuid)  to authenticated, service_role;
grant execute on function app.can_access_vessel(uuid)  to authenticated, service_role;
grant execute on function app.can_manage_vessel(uuid)  to authenticated, service_role;
grant execute on function app.can_see_profile(uuid)    to authenticated, service_role;

-- Profiler
create policy profiles_select on public.profiles
  for select to authenticated
  using (app.can_see_profile(user_id) or app.is_staff());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.profiles to authenticated;
-- Bare disse feltene kan brukeren endre selv; e-posten følger auth.users.
grant update (full_name, phone, title, notify_email) on public.profiles to authenticated;

-- Leidermedlemmer
create policy ladder_members_select on public.ladder_members
  for select to authenticated
  using (user_id = auth.uid() or app.can_manage_ladder(ladder_id) or app.is_staff());

create policy ladder_members_insert on public.ladder_members
  for insert to authenticated
  with check (app.can_manage_ladder(ladder_id) or app.is_staff());

create policy ladder_members_update on public.ladder_members
  for update to authenticated
  using (app.can_manage_ladder(ladder_id) or app.is_staff())
  with check (app.can_manage_ladder(ladder_id) or app.is_staff());

-- Man kan alltid fjerne sin egen tilgang.
create policy ladder_members_delete on public.ladder_members
  for delete to authenticated
  using (user_id = auth.uid() or app.can_manage_ladder(ladder_id) or app.is_staff());

grant select, insert, update, delete on public.ladder_members to authenticated;

-- Fartøy og leidere: bytt ut de gamle select-policyene, som bare kjente
-- selskapsmedlemskap.
drop policy vessels_select on public.vessels;
create policy vessels_select on public.vessels
  for select to authenticated
  using (app.can_access_vessel(id) or app.is_staff());

drop policy ladders_select on public.ladders;
create policy ladders_select on public.ladders
  for select to authenticated
  using (app.can_access_ladder(id) or app.is_staff());

drop policy vessel_members_select on public.vessel_members;
create policy vessel_members_select on public.vessel_members
  for select to authenticated
  using (user_id = auth.uid() or app.can_manage_vessel(vessel_id) or app.is_staff()
         or exists (select 1 from public.vessels v
                    where v.id = vessel_id
                      and v.company_id in (select app.auth_company_ids())));

-- Egenrapportering: avsenderen kan ikke utgi seg for å være en annen.
drop policy maintenance_logs_insert on public.maintenance_logs;
create policy maintenance_logs_insert on public.maintenance_logs
  for insert to authenticated
  with check (
    (
      ladder_id is not null
      and app.can_access_ladder(ladder_id)
      and reported_by_user_id = auth.uid()
    )
    or app.is_staff()
  );

-- Bilder til egne loggføringer.
create policy maintenance_photos_insert on public.maintenance_photos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.maintenance_logs m
      where m.id = maintenance_log_id
        and (m.reported_by_user_id = auth.uid() or app.is_staff())
    )
  );

grant insert on public.maintenance_photos to authenticated;

-- Selskapsmedlemmer: man ser alltid sitt eget medlemskap.
drop policy company_members_select on public.company_members;
create policy company_members_select on public.company_members
  for select to authenticated
  using (user_id = auth.uid()
         or company_id in (select app.auth_company_ids())
         or app.is_staff());

-- ── 6. Invitasjoner ─────────────────────────────────────────────────────────
-- Én tabell for alle tre nivåer (selskap, fartøy, leider). Den gamle
-- company_invitations var tom og dekket bare selskap.
drop table public.company_invitations;

create table public.access_invitations (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null check (email::text ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  scope           text not null check (scope in ('company', 'vessel', 'ladder')),
  company_id      uuid references public.companies(id) on delete cascade,
  vessel_id       uuid references public.vessels(id) on delete cascade,
  ladder_id       uuid references public.ladders(id) on delete cascade,
  role            text not null,
  message         text,
  invited_by      uuid references auth.users(id) on delete set null default auth.uid(),
  invited_by_name text,
  expires_at      timestamptz not null default (now() + interval '30 days'),
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users(id) on delete set null,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  constraint access_invitations_target check (
    (scope = 'company' and company_id is not null and vessel_id is null and ladder_id is null
       and role in ('owner', 'admin', 'member'))
    or (scope = 'vessel' and vessel_id is not null and company_id is null and ladder_id is null
       and role in ('master', 'crew', 'viewer'))
    or (scope = 'ladder' and ladder_id is not null and company_id is null and vessel_id is null
       and role in ('manager', 'viewer'))
  )
);

create unique index access_invitations_open_key
  on public.access_invitations (email, scope, (coalesce(company_id, vessel_id, ladder_id)))
  where accepted_at is null and revoked_at is null;

create index access_invitations_email_idx
  on public.access_invitations (email)
  where accepted_at is null and revoked_at is null;

alter table public.access_invitations enable row level security;

create or replace function app.can_manage_invitation(
  p_scope text, p_company uuid, p_vessel uuid, p_ladder uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select case p_scope
    when 'company' then app.is_company_admin(p_company)
    when 'vessel'  then app.can_manage_vessel(p_vessel)
    when 'ladder'  then app.can_manage_ladder(p_ladder)
    else false
  end;
$$;

grant execute on function app.can_manage_invitation(text, uuid, uuid, uuid)
  to authenticated, service_role;

create policy access_invitations_select on public.access_invitations
  for select to authenticated
  using (app.can_manage_invitation(scope, company_id, vessel_id, ladder_id) or app.is_staff());

create policy access_invitations_insert on public.access_invitations
  for insert to authenticated
  with check (
    (app.can_manage_invitation(scope, company_id, vessel_id, ladder_id) or app.is_staff())
    and invited_by = auth.uid()
    and accepted_at is null
    and accepted_by is null
  );

create policy access_invitations_update on public.access_invitations
  for update to authenticated
  using (app.can_manage_invitation(scope, company_id, vessel_id, ladder_id) or app.is_staff())
  with check (app.can_manage_invitation(scope, company_id, vessel_id, ladder_id) or app.is_staff());

create policy access_invitations_delete on public.access_invitations
  for delete to authenticated
  using (app.can_manage_invitation(scope, company_id, vessel_id, ladder_id) or app.is_staff());

grant select, insert, delete on public.access_invitations to authenticated;
-- Trekke tilbake er det eneste man kan endre. accepted_at settes bare av
-- innløsningen, ellers kunne en administrator «akseptere» på andres vegne.
grant update (revoked_at) on public.access_invitations to authenticated;

-- ── 7. Varsler ──────────────────────────────────────────────────────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_delete on public.notifications
  for delete to authenticated using (user_id = auth.uid());

grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Hjelpere. De kalles bare fra SECURITY DEFINER-funksjoner og triggere, og
-- varsler aldri den som selv utførte handlingen.
create or replace function app.notify_user(
  p_user uuid, p_kind text, p_title text, p_body text, p_link text
)
returns void
language sql
set search_path = public, extensions, pg_temp
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select p_user, p_kind, p_title, p_body, p_link
  where p_user is not null and p_user is distinct from auth.uid();
$$;

-- 'admin' varsler administratorene. 'production' varsler også produksjon.
create or replace function app.notify_staff(
  p_role public.staff_role, p_kind text, p_title text, p_body text, p_link text
)
returns void
language sql
set search_path = public, extensions, pg_temp
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select u.id, p_kind, p_title, p_body, p_link
  from public.staff_members s
  join auth.users u on lower(u.email::text) = lower(s.email::text)
  where u.email_confirmed_at is not null
    and (s.role = 'admin' or s.role = p_role)
    and u.id is distinct from auth.uid();
$$;

create or replace function app.notify_company_admins(
  p_company uuid, p_kind text, p_title text, p_body text, p_link text
)
returns void
language sql
set search_path = public, extensions, pg_temp
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select cm.user_id, p_kind, p_title, p_body, p_link
  from public.company_members cm
  where cm.company_id = p_company
    and cm.role in ('owner', 'admin')
    and cm.user_id is distinct from auth.uid();
$$;

-- De som styrer tilgangen til en leider. Returnerer hvor mange som ble varslet,
-- så kalleren kan falle tilbake på NorthWest Coast når leideren ikke har eier.
create or replace function app.notify_ladder_managers(
  p_ladder uuid, p_kind text, p_title text, p_body text, p_link text
)
returns integer
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  with recipients as (
    select cm.user_id
    from public.ladders l
    join public.company_members cm on cm.company_id = l.company_id
    where l.id = p_ladder and cm.role in ('owner', 'admin')
    union
    select vm.user_id
    from public.ladders l
    join public.vessel_members vm on vm.vessel_id = l.vessel_id
    where l.id = p_ladder and vm.role = 'master'
    union
    select lm.user_id
    from public.ladder_members lm
    where lm.ladder_id = p_ladder and lm.role = 'manager'
  ),
  inserted as (
    insert into public.notifications (user_id, kind, title, body, link)
    select r.user_id, p_kind, p_title, p_body, p_link
    from recipients r
    where r.user_id is distinct from auth.uid()
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;

-- Alle som har tilgang til leideren (for «service er avtalt» o.l.).
create or replace function app.notify_ladder_users(
  p_ladder uuid, p_kind text, p_title text, p_body text, p_link text
)
returns void
language sql
set search_path = public, extensions, pg_temp
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select r.user_id, p_kind, p_title, p_body, p_link
  from (
    select cm.user_id
    from public.ladders l
    join public.company_members cm on cm.company_id = l.company_id
    where l.id = p_ladder
    union
    select vm.user_id
    from public.ladders l
    join public.vessel_members vm on vm.vessel_id = l.vessel_id
    where l.id = p_ladder
    union
    select lm.user_id from public.ladder_members lm where lm.ladder_id = p_ladder
  ) r
  where r.user_id is distinct from auth.uid();
$$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  update public.notifications n
     set read_at = now()
   where n.user_id = auth.uid()
     and n.read_at is null
     and (p_ids is null or n.id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ── 8. Enkel strupeventil for funksjoner som kan kalles uten innlogging ─────
create table app.rate_events (
  bucket text not null,
  at     timestamptz not null default now()
);
create index rate_events_bucket_idx on app.rate_events (bucket, at desc);

-- Registrerer et forsøk og sier om det var innenfor grensen.
create or replace function app.throttle(p_bucket text, p_max integer, p_window interval)
returns boolean
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  delete from app.rate_events where at < now() - interval '1 day';

  select count(*) into v_count
  from app.rate_events
  where bucket = p_bucket and at > now() - p_window;

  if v_count >= p_max then
    return false;
  end if;

  insert into app.rate_events (bucket) values (p_bucket);
  return true;
end;
$$;

-- ── 9. Oppstart: profil, invitasjoner og kontekst i ett kall ────────────────
create or replace function public.portal_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_confirmed timestamptz;
  v_redeemed  integer := 0;
  v_target    text;
  inv         record;
begin
  if v_uid is null then
    return null;
  end if;

  select u.email, u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = v_uid;

  if v_email is null then
    return null;
  end if;

  insert into public.profiles (user_id, email, last_seen_at)
  values (v_uid, v_email, now())
  on conflict (user_id) do update
    set email = excluded.email,
        last_seen_at = now()
  where public.profiles.email is distinct from excluded.email
     or public.profiles.last_seen_at is null
     or public.profiles.last_seen_at < now() - interval '10 minutes';

  -- Invitasjoner løses bare inn mot en verifisert adresse.
  if v_confirmed is not null then
    for inv in
      select i.*
      from public.access_invitations i
      where lower(i.email::text) = lower(v_email)
        and i.accepted_at is null
        and i.revoked_at is null
        and i.expires_at > now()
    loop
      if inv.scope = 'company' then
        insert into public.company_members (company_id, user_id, role)
        values (inv.company_id, v_uid, inv.role::public.company_role)
        on conflict (company_id, user_id) do nothing;
        select c.name into v_target from public.companies c where c.id = inv.company_id;
      elsif inv.scope = 'vessel' then
        insert into public.vessel_members (vessel_id, user_id, role)
        values (inv.vessel_id, v_uid, inv.role::public.vessel_role)
        on conflict (vessel_id, user_id) do nothing;
        select v.name into v_target from public.vessels v where v.id = inv.vessel_id;
      else
        insert into public.ladder_members (ladder_id, user_id, role, granted_by)
        values (inv.ladder_id, v_uid, inv.role, inv.invited_by)
        on conflict (ladder_id, user_id) do nothing;
        select l.serial_number into v_target from public.ladders l where l.id = inv.ladder_id;
      end if;

      update public.access_invitations
         set accepted_at = now(), accepted_by = v_uid
       where id = inv.id;

      insert into public.notifications (user_id, kind, title, body, link)
      values (
        v_uid, 'access_granted',
        'Du har fått tilgang til ' || coalesce(v_target, 'en ny ressurs'),
        case when inv.invited_by_name is not null
             then 'Invitert av ' || inv.invited_by_name || '.' end,
        case inv.scope
          when 'vessel' then '/minside/fartoy/' || inv.vessel_id
          when 'ladder' then '/minside/leider/' || inv.ladder_id
          else '/minside'
        end
      );

      -- Den som inviterte får vite at invitasjonen er tatt i bruk.
      perform app.notify_user(
        inv.invited_by, 'invitation_accepted',
        v_email || ' har tatt i bruk invitasjonen',
        'Gjelder ' || coalesce(v_target, 'tilgang') || '.',
        '/minside/personer'
      );

      v_redeemed := v_redeemed + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'user_id', v_uid,
    'email', v_email,
    'full_name', (select p.full_name from public.profiles p where p.user_id = v_uid),
    'staff_role', app.staff_role(),
    'companies', (
      select coalesce(
        jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'role', cm.role) order by c.name),
        '[]'::jsonb)
      from public.company_members cm
      join public.companies c on c.id = cm.company_id
      where cm.user_id = v_uid
    ),
    'has_access', (
      exists (select 1 from public.company_members cm where cm.user_id = v_uid)
      or exists (select 1 from public.vessel_members vm where vm.user_id = v_uid)
      or exists (select 1 from public.ladder_members lm where lm.user_id = v_uid)
    ),
    'unread', (
      select count(*) from public.notifications n
      where n.user_id = v_uid and n.read_at is null
    ),
    'redeemed', v_redeemed
  );
end;
$$;

grant execute on function public.portal_bootstrap() to authenticated;

-- ── 10. Opprett eget selskap ────────────────────────────────────────────────
create or replace function public.create_my_company(
  p_name text,
  p_org_number text default null,
  p_address text default null,
  p_postal_code text default null,
  p_city text default null,
  p_contact_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_org   text := nullif(regexp_replace(coalesce(p_org_number, ''), '\D', '', 'g'), '');
  v_name  text := btrim(coalesce(p_name, ''));
  v_id    uuid;
  v_email text;
  v_full  text;
begin
  if v_uid is null then
    raise exception 'Du må være logget inn.' using errcode = 'P0001';
  end if;
  if length(v_name) < 2 then
    raise exception 'Navn på selskapet er påkrevd.' using errcode = 'P0001';
  end if;
  if v_org is not null and not public.is_valid_org_number(v_org) then
    raise exception 'Organisasjonsnummeret er ikke gyldig.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.company_members cm
      where cm.user_id = v_uid and cm.role = 'owner') >= 5 then
    raise exception 'Du kan ikke opprette flere selskap. Ta kontakt med NorthWest Coast.'
      using errcode = 'P0001';
  end if;
  if v_org is not null and exists (select 1 from public.companies c where c.org_number = v_org) then
    raise exception 'Dette selskapet er allerede registrert. Be en administrator der om å invitere deg.'
      using errcode = 'P0001';
  end if;

  select p.email::text, p.full_name into v_email, v_full
  from public.profiles p where p.user_id = v_uid;

  insert into public.companies
    (name, org_number, address, postal_code, city, contact_name, contact_email, contact_phone)
  values
    (left(v_name, 160), v_org,
     nullif(btrim(coalesce(p_address, '')), ''),
     nullif(btrim(coalesce(p_postal_code, '')), ''),
     nullif(btrim(coalesce(p_city, '')), ''),
     v_full, v_email,
     nullif(btrim(coalesce(p_contact_phone, '')), ''))
  returning id into v_id;

  insert into public.company_members (company_id, user_id, role)
  values (v_id, v_uid, 'owner');

  perform app.notify_staff(
    'admin', 'company_created',
    'Nytt selskap registrert: ' || left(v_name, 160),
    coalesce(v_full, v_email) || ' opprettet selskapet selv.',
    '/admin/selskap/' || v_id
  );

  return v_id;
end;
$$;

grant execute on function public.create_my_company(text, text, text, text, text, text)
  to authenticated;

-- ── 11. Tilgang til en leider via produksjonsnummer ─────────────────────────
create table public.ladder_access_requests (
  id              uuid primary key default gen_random_uuid(),
  ladder_id       uuid not null references public.ladders(id) on delete cascade,
  requester_id    uuid not null references auth.users(id) on delete cascade,
  requester_name  text,
  requester_email citext,
  message         text,
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  granted_role    text check (granted_role in ('manager', 'viewer')),
  decided_by      uuid references auth.users(id) on delete set null,
  decided_at      timestamptz,
  decision_note   text,
  created_at      timestamptz not null default now()
);

create unique index ladder_access_requests_pending_key
  on public.ladder_access_requests (ladder_id, requester_id)
  where status = 'pending';

create index ladder_access_requests_ladder_idx
  on public.ladder_access_requests (ladder_id, created_at desc);

alter table public.ladder_access_requests enable row level security;

create policy ladder_access_requests_select on public.ladder_access_requests
  for select to authenticated
  using (requester_id = auth.uid() or app.can_manage_ladder(ladder_id) or app.is_staff());

grant select on public.ladder_access_requests to authenticated;

-- Slår opp produksjonsnummeret og ber om tilgang. Svaret sier bare om
-- nummeret finnes – aldri hvem som eier leideren eller hvor den er.
create or replace function public.request_ladder_access(p_serial text, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_serial  text := upper(btrim(coalesce(p_serial, '')));
  v_ladder  record;
  v_name    text;
  v_email   text;
  v_request uuid;
  v_count   integer;
begin
  if v_uid is null then
    raise exception 'Du må være logget inn.' using errcode = 'P0001';
  end if;
  if length(v_serial) < 3 then
    raise exception 'Skriv inn produksjonsnummeret som står på leideren.' using errcode = 'P0001';
  end if;
  -- Hindrer at noen prøver seg gjennom nummerserien.
  if not app.throttle('ladder_lookup:' || v_uid, 15, interval '1 hour') then
    raise exception 'For mange forsøk. Prøv igjen om en time.' using errcode = 'P0001';
  end if;

  select l.id, l.serial_number into v_ladder
  from public.ladders l
  where upper(l.serial_number) = v_serial;

  if v_ladder.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if app.can_access_ladder(v_ladder.id) then
    return jsonb_build_object('status', 'already', 'ladder_id', v_ladder.id);
  end if;

  if exists (select 1 from public.ladder_access_requests r
             where r.ladder_id = v_ladder.id and r.requester_id = v_uid and r.status = 'pending') then
    return jsonb_build_object('status', 'pending');
  end if;

  select p.full_name, p.email::text into v_name, v_email
  from public.profiles p where p.user_id = v_uid;
  if v_email is null then
    select u.email into v_email from auth.users u where u.id = v_uid;
  end if;

  insert into public.ladder_access_requests
    (ladder_id, requester_id, requester_name, requester_email, message)
  values
    (v_ladder.id, v_uid, v_name, v_email, nullif(left(btrim(coalesce(p_message, '')), 1000), ''))
  returning id into v_request;

  v_count := app.notify_ladder_managers(
    v_ladder.id, 'access_request',
    coalesce(v_name, v_email) || ' ber om tilgang til leider ' || v_ladder.serial_number,
    nullif(left(btrim(coalesce(p_message, '')), 300), ''),
    '/minside/tilgang'
  );

  -- Ingen eier ennå (eller ingen som kan svare): NorthWest Coast tar den.
  if v_count = 0 then
    perform app.notify_staff(
      'admin', 'access_request',
      coalesce(v_name, v_email) || ' ber om tilgang til leider ' || v_ladder.serial_number,
      'Leideren har ingen eier som kan svare. Forespørselen må behandles av NorthWest Coast.',
      '/admin/tilgang'
    );
  end if;

  return jsonb_build_object('status', 'requested', 'request_id', v_request,
                            'handled_by', case when v_count = 0 then 'nwc' else 'owner' end);
end;
$$;

grant execute on function public.request_ladder_access(text, text) to authenticated;

create or replace function public.decide_ladder_access(
  p_request uuid,
  p_approve boolean,
  p_role text default 'viewer',
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_req    record;
  v_serial text;
begin
  select r.* into v_req
  from public.ladder_access_requests r
  where r.id = p_request
  for update;

  if v_req.id is null then
    raise exception 'Fant ikke forespørselen.' using errcode = 'P0001';
  end if;
  if not (app.can_manage_ladder(v_req.ladder_id) or app.is_staff()) then
    raise exception 'Du kan ikke behandle denne forespørselen.' using errcode = '42501';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Forespørselen er allerede behandlet.' using errcode = 'P0001';
  end if;
  if p_role not in ('manager', 'viewer') then
    raise exception 'Ugyldig rolle.' using errcode = 'P0001';
  end if;

  select l.serial_number into v_serial from public.ladders l where l.id = v_req.ladder_id;

  if p_approve then
    insert into public.ladder_members (ladder_id, user_id, role, granted_by)
    values (v_req.ladder_id, v_req.requester_id, p_role, auth.uid())
    on conflict (ladder_id, user_id) do update set role = excluded.role;
  end if;

  update public.ladder_access_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         granted_role = case when p_approve then p_role end,
         decided_by = auth.uid(),
         decided_at = now(),
         decision_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
   where id = p_request;

  perform app.notify_user(
    v_req.requester_id,
    case when p_approve then 'access_granted' else 'access_rejected' end,
    case when p_approve
         then 'Du har fått tilgang til leider ' || v_serial
         else 'Forespørselen om tilgang til leider ' || v_serial || ' ble avslått' end,
    nullif(left(btrim(coalesce(p_note, '')), 300), ''),
    case when p_approve then '/minside/leider/' || v_req.ladder_id else '/minside/leidere' end
  );
end;
$$;

grant execute on function public.decide_ladder_access(uuid, boolean, text, text) to authenticated;

-- Monter en leider på et fartøy (eller ta den av). Krever at man styrer
-- både leideren og fartøyet.
create or replace function public.install_ladder(
  p_ladder uuid,
  p_vessel uuid,
  p_installed_at date default current_date
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not (app.can_manage_ladder(p_ladder) or app.is_staff()) then
    raise exception 'Du kan ikke endre denne leideren.' using errcode = '42501';
  end if;

  if p_vessel is null then
    update public.ladders
       set vessel_id = null,
           status = case when status = 'installed' then 'delivered' else status end
     where id = p_ladder;
    return;
  end if;

  if not (app.can_manage_vessel(p_vessel) or app.is_staff()) then
    raise exception 'Du kan ikke legge leidere til dette fartøyet.' using errcode = '42501';
  end if;

  update public.ladders
     set vessel_id = p_vessel,
         installed_at = coalesce(p_installed_at, current_date),
         status = 'installed'
   where id = p_ladder;
end;
$$;

grant execute on function public.install_ladder(uuid, uuid, date) to authenticated;
