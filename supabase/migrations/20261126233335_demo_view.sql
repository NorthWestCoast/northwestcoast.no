-- Demovisning: demodataene kan ligge i produksjon uten å blande seg med de ekte.
--
-- Radene fra supabase/seed/demo.sql er merket demo = true. En restriktiv
-- policy på hver tabell med demodata skiller dem fra resten:
--
--  - Ansatte ser bare ekte rader, slik at lister, tellinger og kalendere i
--    admin og produksjon er som før.
--  - I demovisningen ser en administrator bare demoradene. Den slås på i
--    /admin/demo, og nettlaget sender da hodet x-nwc-demo med hvert kall.
--    Hodet virker bare for administratorer: for alle andre er
--    app.demo_view() falsk.
--  - Kunder ser det medlemskapet deres gir, som før. Ingen i produksjon er
--    medlem av demoselskapet. Lokalt er testbrukeren Kari eier av det
--    (supabase/local/users.sql), så Min side kan testes med demodataene.
--
-- Demovisningen er bare til å se på. Policyen slipper ikke gjennom nye eller
-- endrede rader der, og middleware stopper skjemaene før de når en funksjon i
-- databasen (lib/supabase/middleware.ts). Ansatte kan heller ikke lage
-- demorader utenfor den. Bare seed-skriptet lager dem: det setter
-- nwc.demo_seed og kjører som postgres, og da blir også radene som
-- triggerne lager (produksjonssteg, faste kontroller, varsler), merket.

-- ── 1. Er dette demovisningen? ──────────────────────────────────────────────
create or replace function app.demo_view()
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(app.request_header('x-nwc-demo') = '1', false)
     and coalesce(app.staff_role() = 'admin', false);
$$;

comment on function app.demo_view() is
  'Sann når en administrator har slått på demovisningen (hodet x-nwc-demo). Da vises bare demodataene.';

revoke all on function app.demo_view() from public;
grant execute on function app.demo_view() to anon, authenticated, service_role;

-- ── 2. Standardverdien for nye rader ────────────────────────────────────────
-- Usann for alt nettlaget gjør. Seed-skriptet setter nwc.demo_seed i sin egen
-- transaksjon, og bare der blir nye rader demorader.
create or replace function app.demo_seeding()
returns boolean
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select coalesce(current_setting('nwc.demo_seed', true), '') = 'on';
$$;

comment on function app.demo_seeding() is
  'Standardverdien for demo-kolonnene: sann bare mens supabase/seed/demo.sql kjører.';

revoke all on function app.demo_seeding() from public;
grant execute on function app.demo_seeding() to anon, authenticated, service_role;

-- ── 3. Kolonnen og policyen ─────────────────────────────────────────────────
-- Tabellene demodataene ligger i, også de triggerne fyller. Lageret er ikke
-- med: delelista og lagervarene henger på de ekte produktene, så demodata
-- der ville blitt trukket av ekte produksjonsjobber. Den delen er bare lokal
-- (supabase/seed/demo-lager.sql).
do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'vessels', 'projects', 'ladders', 'cabinets',
    'service_reports', 'maintenance_logs', 'ladder_tasks', 'service_bookings', 'service_agreements',
    'orders', 'order_lines', 'production_jobs', 'production_job_steps', 'deliveries',
    'support_tickets', 'ticket_messages', 'contact_requests', 'notifications'
  ] loop
    execute format(
      'alter table public.%I add column demo boolean not null default app.demo_seeding()', t);
    execute format(
      'comment on column public.%I.demo is %L', t,
      'Demodata fra supabase/seed/demo.sql. Ansatte ser dem bare i demovisningen (app.demo_view()).');
    execute format($policy$
      create policy demo_split on public.%I
        as restrictive
        for all
        to public
        using (
          case when (select app.demo_view()) then demo
               else not demo or (select app.staff_role()) is null
          end)
        with check (
          not (select app.demo_view())
          and (not demo or (select app.staff_role()) is null))
    $policy$, t);
  end loop;
end $$;

-- ── 4. Ulest-tallet i menyen følger samme skille ────────────────────────────
-- portal_bootstrap() kjører med eierens rettigheter og ser derfor forbi
-- policyen. Den sier også fra om demovisningen er på, så portalen kan vise
-- stripa øverst.
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
  v_demo      boolean := app.demo_view();
  v_staff     boolean := app.staff_role() is not null;
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

  -- Invitasjoner løses ikke lenger inn av seg selv: de vises for brukeren, som
  -- selv godtar eller avslår (accept_invitation, decline_invitation).
  return jsonb_build_object(
    'user_id', v_uid,
    'email', v_email,
    'full_name', (select p.full_name from public.profiles p where p.user_id = v_uid),
    'staff_role', app.staff_role(),
    'demo', v_demo,
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
        and case when v_demo then n.demo else not n.demo or not v_staff end
    ),
    'invitations', case when v_confirmed is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', i.id, 'scope', i.scope, 'role', i.role,
          'invited_by_name', i.invited_by_name, 'expires_at', i.expires_at,
          'target', case i.scope
            when 'company' then (select c.name from public.companies c where c.id = i.company_id)
            when 'vessel'  then (select v.name from public.vessels v where v.id = i.vessel_id)
            else (select l.serial_number from public.ladders l where l.id = i.ladder_id)
          end) order by i.created_at), '[]'::jsonb)
      from public.access_invitations i
      where lower(i.email::text) = lower(v_email)
        and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    ) end,
    'redeemed', 0
  );
end;
$$;
