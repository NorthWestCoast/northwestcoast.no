-- Sikkerhetsgjennomgang 19.11.2026: rettelser i tilgangsreglene, del 3 av 3.
--
-- Nettlaget har ingen servicenøkkel, så RLS og funksjonene her er den eneste
-- virkelige grensen. Alt under er ting en innlogget bruker (eller en anonym
-- med den offentlige nøkkelen) kunne gjøre rett mot API-et, uavhengig av hva
-- sidene i portalen tilbyr.

-- ── 12. Meldinger fra det åpne vedlikeholdsskjemaet må bekreftes ────────────
-- Skjemaet krever ikke innlogging, og et riktig serienummer var nok til at
-- meldingen havnet i leiderens historikk, ble «siste vedlikehold» og ble vist
-- for los. Nå lagres den som før, men teller ikke og vises ikke i
-- losrapporten før NorthWest Coast har bekreftet den i admin.
alter table public.maintenance_logs
  add column verified_at timestamptz,
  add column verified_by uuid references auth.users(id) on delete set null;

comment on column public.maintenance_logs.verified_at is
  'Når NorthWest Coast bekreftet en melding fra det åpne skjemaet (source = web). Andre kilder trenger ikke bekreftelse.';

create or replace function public.submit_maintenance_report(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_name   text := left(btrim(coalesce(payload ->> 'name', '')), 120);
  v_boat   text := left(btrim(coalesce(payload ->> 'boat', '')), 160);
  v_serial text := left(btrim(coalesce(payload ->> 'serial', '')), 60);
  v_email  text := nullif(lower(left(btrim(coalesce(payload ->> 'email', '')), 160)), '');
  v_ladder record;
  v_id     uuid;
begin
  if v_name = '' or v_boat = '' or v_serial = '' then
    raise exception 'Navn, fartøy og serienummer er påkrevd.' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'E-postadressen ser ikke gyldig ut.' using errcode = 'P0001';
  end if;
  if not app.form_throttle('maintenance', 8, 20, 60)
     -- Kvitteringen går til adressen i skjemaet: høyst fire per adresse per døgn.
     or (v_email is not null and not app.throttle('maintenance:email:' || v_email, 4, interval '1 day')) then
    raise exception 'For mange rapporter på kort tid. Prøv igjen senere.' using errcode = 'P0001';
  end if;

  -- En rapport skal aldri gå tapt fordi oppslaget bommet; da lagres råteksten.
  select l.id, l.vessel_id into v_ladder
  from public.ladders l where upper(l.serial_number) = upper(v_serial);

  insert into public.maintenance_logs
    (ladder_id, vessel_id, serial_number_raw, vessel_name_raw, imo_raw,
     reporter_name, reporter_email, notes, source, reported_by_user_id)
  values
    (v_ladder.id, v_ladder.vessel_id, v_serial, v_boat,
     nullif(left(btrim(coalesce(payload ->> 'imo', '')), 20), ''),
     v_name, v_email,
     nullif(left(btrim(coalesce(payload ->> 'notes', '')), 4000), ''),
     'web', auth.uid())
  returning id into v_id;

  return jsonb_build_object('log_id', v_id, 'matched', v_ladder.id is not null);
end;
$$;

create or replace view public.ladder_status
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
    l.company_id,
    v.name           as vessel_name,
    v.imo,
    p.product_number,
    p.name           as product_name,
    coalesce(l.custom_length_m, p.length_m)::numeric(4,1) as length_m,
    p.steps,
    sr.performed_at  as last_service_at,
    sr.result        as last_service_result,
    coalesce(
      sr.next_service_due,
      (l.installed_at + make_interval(months => l.service_interval_months))::date
    )                as next_service_due,
    ml.performed_at  as last_maintenance_at,
    l.service_interval_months,
    c.name           as company_name,
    tk.next_task_due,
    tk.open_tasks,
    bk.scheduled_date as booked_service_date,
    l.project_id,
    pr.name          as project_name,
    ct.certificate_number,
    ct.valid_until   as certificate_valid_until
  from public.ladders l
  join public.products p on p.id = l.product_id
  left join public.vessels v on v.id = l.vessel_id
  left join public.companies c on c.id = l.company_id
  left join public.projects pr on pr.id = l.project_id
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
      and (m.source <> 'web' or m.verified_at is not null)
    order by m.performed_at desc
    limit 1
  ) ml on true
  left join lateral (
    select min(t.due_date) as next_task_due, count(*)::integer as open_tasks
    from public.ladder_tasks t
    where t.ladder_id = l.id and t.status = 'open'
  ) tk on true
  left join lateral (
    select b.scheduled_date
    from public.service_bookings b
    where b.ladder_id = l.id and b.status = 'scheduled'
    order by b.scheduled_date
    limit 1
  ) bk on true
  left join lateral (
    select lc.certificate_number, lc.valid_until
    from public.ladder_certificates lc
    where lc.ladder_id = l.id and lc.revoked_at is null and lc.replaced_by is null
    order by lc.issued_on desc, lc.created_at desc
    limit 1
  ) ct on true
) base;

create or replace function public.get_ladder_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash  text := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  v_share record;
begin
  if length(coalesce(p_token, '')) < 20 then
    return null;
  end if;

  select s.* into v_share
  from public.ladder_state_shares s
  where s.token_hash = v_hash;

  if v_share.id is null then
    return null;
  end if;
  if v_share.revoked_at is not null then
    return jsonb_build_object('state', 'revoked');
  end if;
  if v_share.expires_at <= now() then
    return jsonb_build_object('state', 'expired');
  end if;

  update public.ladder_state_shares
     set view_count = view_count + 1, last_viewed_at = now()
   where id = v_share.id;

  return (
    select jsonb_build_object(
      'state', 'active',
      'share_id', v_share.id,
      'title', v_share.title,
      'note', v_share.note,
      'recipient', v_share.recipient,
      'checklist', v_share.checklist,
      'created_at', v_share.created_at,
      'created_by_name', v_share.created_by_name,
      'expires_at', v_share.expires_at,
      'ladder', jsonb_build_object(
        'serial_number', l.serial_number,
        'product_name', p.name,
        'product_number', p.product_number,
        'length_m', coalesce(l.custom_length_m, p.length_m),
        'steps', case when l.custom_length_m is null then p.steps end,
        'produced_at', l.produced_at,
        'installed_at', l.installed_at
      ),
      'vessel', case when v.id is not null then jsonb_build_object(
        'name', v.name, 'imo', v.imo, 'call_sign', v.call_sign
      ) end,
      'project', case when pr.id is not null then jsonb_build_object(
        'name', pr.name, 'kind', pr.kind, 'location', pr.location
      ) end,
      'certificate', (
        select jsonb_build_object(
          'certificate_number', lc.certificate_number,
          'issued_on', lc.issued_on,
          'valid_until', lc.valid_until,
          'expired', lc.valid_until < current_date,
          'verify_token', lc.verify_token)
        from public.ladder_certificates lc
        where lc.ladder_id = l.id and lc.revoked_at is null and lc.replaced_by is null
        order by lc.issued_on desc, lc.created_at desc limit 1
      ),
      'last_service', (
        select jsonb_build_object(
          'performed_at', sr.performed_at, 'result', sr.result,
          'next_service_due', sr.next_service_due, 'performed_by', sr.performed_by)
        from public.service_reports sr
        where sr.ladder_id = l.id
        order by sr.performed_at desc, sr.created_at desc limit 1
      ),
      'recent_logs', (
        select coalesce(jsonb_agg(x order by x ->> 'performed_at' desc), '[]'::jsonb)
        from (
          select jsonb_build_object(
            'performed_at', m.performed_at, 'kind', m.kind,
            'title', m.title, 'reporter_name', m.reporter_name) as x
          from public.maintenance_logs m
          where m.ladder_id = l.id
            and (m.source <> 'web' or m.verified_at is not null)
          order by m.performed_at desc limit 5
        ) recent
      ),
      'photos', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'path', ph.storage_path, 'kind', ph.kind,
          'captured_at', ph.captured_at, 'caption', ph.caption)
          order by ph.captured_at), '[]'::jsonb)
        from public.ladder_state_photos ph where ph.share_id = v_share.id
      )
    )
    from public.ladders l
    join public.products p on p.id = l.product_id
    left join public.vessels v on v.id = l.vessel_id
    left join public.projects pr on pr.id = l.project_id
    where l.id = v_share.ladder_id
  );
end;
$$;

-- ── 13. En invitasjon gir ikke tilgang før den er godtatt ───────────────────
-- Før ble alle ventende invitasjoner løst inn ved innlogging, uten at
-- brukeren ble spurt. Hvem som helst kunne dermed gjøre en annen bruker til
-- medlem i sitt eget selskap ved å invitere e-postadressen hennes, og så se
-- profilen hennes og det hun la inn uten å velge selskap.
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

create or replace function public.accept_invitation(p_invitation uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text := app.my_verified_email();
  inv      public.access_invitations%rowtype;
  v_target text;
  v_link   text;
begin
  if v_uid is null or v_email is null then
    raise exception 'Du må være logget inn med en bekreftet e-postadresse.' using errcode = '42501';
  end if;

  select i.* into inv
  from public.access_invitations i
  where i.id = p_invitation
    and lower(i.email::text) = v_email
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  for update;

  if inv.id is null then
    raise exception 'Invitasjonen finnes ikke eller er ikke lenger gyldig.' using errcode = 'P0001';
  end if;

  if inv.scope = 'company' then
    insert into public.company_members (company_id, user_id, role)
    values (inv.company_id, v_uid, inv.role::public.company_role)
    on conflict (company_id, user_id) do nothing;
    select c.name into v_target from public.companies c where c.id = inv.company_id;
    v_link := '/minside';
  elsif inv.scope = 'vessel' then
    insert into public.vessel_members (vessel_id, user_id, role)
    values (inv.vessel_id, v_uid, inv.role::public.vessel_role)
    on conflict (vessel_id, user_id) do nothing;
    select v.name into v_target from public.vessels v where v.id = inv.vessel_id;
    v_link := '/minside/fartoy/' || inv.vessel_id;
  else
    insert into public.ladder_members (ladder_id, user_id, role, granted_by)
    values (inv.ladder_id, v_uid, inv.role, inv.invited_by)
    on conflict (ladder_id, user_id) do nothing;
    select l.serial_number into v_target from public.ladders l where l.id = inv.ladder_id;
    v_link := '/minside/leider/' || inv.ladder_id;
  end if;

  update public.access_invitations
     set accepted_at = now(), accepted_by = v_uid
   where id = inv.id;

  perform app.notify_user(
    inv.invited_by, 'invitation_accepted',
    v_email || ' har godtatt invitasjonen',
    'Gjelder ' || coalesce(v_target, 'tilgang') || '.',
    '/minside/personer'
  );

  return v_link;
end;
$$;

create or replace function public.decline_invitation(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_email text := app.my_verified_email();
  inv     public.access_invitations%rowtype;
begin
  if auth.uid() is null or v_email is null then
    raise exception 'Du må være logget inn med en bekreftet e-postadresse.' using errcode = '42501';
  end if;

  select i.* into inv
  from public.access_invitations i
  where i.id = p_invitation
    and lower(i.email::text) = v_email
    and i.accepted_at is null and i.revoked_at is null
  for update;

  if inv.id is null then
    raise exception 'Invitasjonen finnes ikke eller er ikke lenger gyldig.' using errcode = 'P0001';
  end if;

  update public.access_invitations set revoked_at = now() where id = inv.id;

  perform app.notify_user(
    inv.invited_by, 'invitation_declined',
    v_email || ' har takket nei til invitasjonen',
    null,
    '/minside/personer'
  );
end;
$$;

revoke all on function public.accept_invitation(uuid), public.decline_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid), public.decline_invitation(uuid) to authenticated;

-- ── 14. Nyhetsbrev: påmelding gjelder først når adressen er bekreftet ───────
-- Hvem som helst kunne melde på en hvilken som helst adresse, og en ny
-- innsending slettet en avmelding. Nå er en påmelding ventende til
-- mottakeren har bekreftet den med lenken i e-posten, og en avmeldt adresse
-- kan bare meldes på igjen på samme måte. Nøkkelen til lenken gis bare til
-- nettstedet (se seksjon 11), så den kan ikke hentes rett fra API-et.
alter table public.newsletter_subscribers
  add column confirmed_at       timestamptz,
  add column confirm_token_hash text,
  add column confirm_sent_at    timestamptz,
  add column unsubscribe_token  text not null default encode(extensions.gen_random_bytes(18), 'hex');

create unique index newsletter_subscribers_unsubscribe_key
  on public.newsletter_subscribers (unsubscribe_token);

-- De som alt står på lista, meldte seg på før bekreftelse fantes.
update public.newsletter_subscribers
   set confirmed_at = created_at
 where confirmed_at is null and unsubscribed_at is null;

drop function public.subscribe_newsletter(text);

create function public.subscribe_newsletter(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_email text := lower(left(btrim(coalesce(p_email, '')), 160));
  v_row   public.newsletter_subscribers%rowtype;
  v_token text;
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'E-postadressen ser ikke gyldig ut.' using errcode = 'P0001';
  end if;
  if not app.form_throttle('newsletter', 5, 20, 120) then
    raise exception 'For mange påmeldinger på kort tid. Prøv igjen senere.' using errcode = 'P0001';
  end if;

  select s.* into v_row from public.newsletter_subscribers s where s.email = v_email for update;
  if v_row.id is not null and v_row.confirmed_at is not null and v_row.unsubscribed_at is null then
    return jsonb_build_object('status', 'active');
  end if;

  -- Høyst tre bekreftelses-e-poster per adresse per døgn. Over det svarer vi
  -- som vanlig, men uten ny nøkkel, så ingen ny e-post sendes.
  if not app.throttle('newsletter:email:' || v_email, 3, interval '1 day') then
    return jsonb_build_object('status', 'pending');
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.newsletter_subscribers (email, source, confirm_token_hash, confirm_sent_at)
  values (v_email, 'web', encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), now())
  on conflict (email) do update
    set confirm_token_hash = excluded.confirm_token_hash,
        confirm_sent_at = excluded.confirm_sent_at;

  return jsonb_build_object('status', 'pending')
      || case when app.via_site() or not app.gate_configured()
              then jsonb_build_object('token', v_token) else '{}'::jsonb end;
end;
$$;

create or replace function public.confirm_newsletter(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_done boolean;
begin
  update public.newsletter_subscribers
     set confirmed_at = now(), unsubscribed_at = null, confirm_token_hash = null
   where length(coalesce(p_token, '')) >= 32
     and confirm_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     and confirm_sent_at > now() - interval '7 days'
  returning true into v_done;
  return coalesce(v_done, false);
end;
$$;

create or replace function public.unsubscribe_newsletter(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_done boolean;
begin
  update public.newsletter_subscribers
     set unsubscribed_at = coalesce(unsubscribed_at, now()), confirm_token_hash = null
   where length(coalesce(p_token, '')) >= 32
     and unsubscribe_token = p_token
  returning true into v_done;
  return coalesce(v_done, false);
end;
$$;

revoke all on function public.subscribe_newsletter(text), public.confirm_newsletter(text),
  public.unsubscribe_newsletter(text) from public;
grant execute on function public.subscribe_newsletter(text), public.confirm_newsletter(text),
  public.unsubscribe_newsletter(text) to anon, authenticated;

-- ── 15. Ingen passord på kontoene ───────────────────────────────────────────
-- Innloggingen er lenke eller kode på e-post. Auth-tjenesten tar likevel imot
-- registrering med passord rett mot API-et, og et passord satt på en adresse
-- før eieren logger inn første gang, ville blitt stående på kontoen hennes.
-- Passordfeltet tømmes derfor alltid, så innlogging med passord aldri virker.
create or replace function app.auth_users_no_password()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.encrypted_password := null;
  return new;
end;
$$;

create trigger nwc_no_password
  before insert or update of encrypted_password on auth.users
  for each row execute function app.auth_users_no_password();
