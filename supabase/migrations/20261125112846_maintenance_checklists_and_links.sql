-- ============================================================================
-- Vedlikehold med sjekkpunkter, papirskjema og lenker uten innlogging
-- ============================================================================
-- 1. En registrering kan følge en av sjekklistene i brukermanualen (før bruk,
--    etter bruk, kvartalsvis). Punktene lagres slik de ble vist, med om de ble
--    huket av. Mangler ett, er registreringen «ufullstendig».
-- 2. En registrering kan i stedet være et bilde av et utfylt papirskjema.
--    Da er bildet selve dokumentasjonen, og ingen punkter lagres.
-- 3. maintenance_links: lenker som den som forvalter leideren (eller
--    NorthWestCoast) lager, så folk uten innlogging kan registrere
--    vedlikehold på akkurat den leideren. Bare hashen av lenken lagres.
-- 4. Det åpne skjemaet på nettsiden stenges. Registrering skjer nå i Min side
--    eller via en slik lenke.
--
-- MERK: tidsstempelet i filnavnet er selvvalgt. Når migrasjonen kjøres i
-- produksjon med apply_migration, skal filen få versjonen derfra.

-- ── 1 og 2. Sjekkpunkter og papirskjema ─────────────────────────────────────
create type public.maintenance_checklist as enum ('before_use', 'after_use', 'quarterly');

alter table public.maintenance_logs
  add column checklist       public.maintenance_checklist,
  add column checklist_items jsonb not null default '[]'::jsonb,
  add column incomplete      boolean not null default false,
  add column paper_form      boolean not null default false,
  add column link_id         uuid;

comment on column public.maintenance_logs.checklist_items is
  'Punktene slik de ble vist i skjemaet: [{ "label": tekst, "checked": true/false }].';
comment on column public.maintenance_logs.incomplete is
  'Sendt inn med punkter som ikke er huket av. Settes av databasen, ikke klienten.';
comment on column public.maintenance_logs.paper_form is
  'Registrert som bilde av et utfylt papirskjema. Bildet er dokumentasjonen.';

-- Formen på punktene sjekkes her, så et kall rett mot API-et ikke kan lagre
-- noe annet enn det skjemaet gjør. «Ufullstendig» regnes ut fra punktene.
create or replace function app.maintenance_logs_checklist()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  if new.paper_form then
    new.checklist_items := '[]'::jsonb;
  end if;

  if jsonb_typeof(new.checklist_items) <> 'array'
     or jsonb_array_length(new.checklist_items) > 20
     or exists (
       select 1 from jsonb_array_elements(new.checklist_items) item
       where jsonb_typeof(item) <> 'object'
          or jsonb_typeof(item -> 'label') is distinct from 'string'
          or length(btrim(item ->> 'label')) not between 1 and 400
          or jsonb_typeof(item -> 'checked') is distinct from 'boolean'
     ) then
    raise exception 'Sjekklisten har feil format.' using errcode = 'P0001';
  end if;

  if new.checklist is null and jsonb_array_length(new.checklist_items) > 0 then
    raise exception 'Sjekkpunkter krever en sjekkliste.' using errcode = 'P0001';
  end if;

  new.incomplete := exists (
    select 1 from jsonb_array_elements(new.checklist_items) item
    where (item ->> 'checked')::boolean is false
  );
  return new;
end;
$$;

revoke all on function app.maintenance_logs_checklist() from public, anon, authenticated;

create trigger maintenance_logs_checklist
  before insert or update of checklist, checklist_items, paper_form
  on public.maintenance_logs
  for each row execute function app.maintenance_logs_checklist();

-- ── 3. Lenker for registrering uten innlogging ──────────────────────────────
create table public.maintenance_links (
  id              uuid primary key default gen_random_uuid(),
  ladder_id       uuid not null references public.ladders(id) on delete cascade,
  token_hash      text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  recipient       text check (recipient is null or length(recipient) <= 160),
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_by_name text,
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  revoked_by      uuid references auth.users(id) on delete set null,
  use_count       integer not null default 0,
  last_used_at    timestamptz,
  created_at      timestamptz not null default now(),
  constraint maintenance_links_expiry
    check (expires_at > created_at and expires_at <= created_at + interval '366 days')
);

create index maintenance_links_ladder_idx on public.maintenance_links (ladder_id, created_at desc);

comment on table public.maintenance_links is
  'Lenker som lar folk uten innlogging registrere vedlikehold på én leider. Bare hashen av lenken lagres.';

alter table public.maintenance_logs
  add constraint maintenance_logs_link_id_fkey
  foreign key (link_id) references public.maintenance_links(id) on delete set null;

alter table public.maintenance_links enable row level security;

create policy maintenance_links_select on public.maintenance_links
  for select to authenticated
  using (app.can_manage_ladder(ladder_id) or app.is_staff());

create policy maintenance_links_insert on public.maintenance_links
  for insert to authenticated
  with check (
    (app.can_manage_ladder(ladder_id) or app.is_staff())
    and created_by = auth.uid()
    and revoked_at is null and revoked_by is null
    and use_count = 0 and last_used_at is null
  );

-- Ingen oppdatering eller sletting direkte: en lenke trekkes tilbake med
-- revoke_maintenance_link(), og kan ikke åpnes igjen.
grant select, insert on public.maintenance_links to authenticated;

-- Tidspunktet og navnet på den som laget lenken settes her, ikke av
-- klienten. Ellers kunne opprettet-tidspunktet flyttes fram for å få en
-- lenke som varer lenger enn et år.
create or replace function app.maintenance_links_stamp()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_name text;
begin
  new.created_at := now();
  new.recipient := nullif(btrim(coalesce(new.recipient, '')), '');
  if auth.uid() is not null then
    select coalesce(nullif(btrim(p.full_name), ''), p.email::text) into v_name
    from public.profiles p where p.user_id = auth.uid();
    new.created_by_name := left(v_name, 120);
  end if;
  return new;
end;
$$;

revoke all on function app.maintenance_links_stamp() from public, anon, authenticated;

create trigger maintenance_links_stamp
  before insert on public.maintenance_links
  for each row execute function app.maintenance_links_stamp();

create or replace function public.revoke_maintenance_link(p_link uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_link record;
begin
  select k.* into v_link from public.maintenance_links k where k.id = p_link for update;
  if v_link.id is null then
    raise exception 'Fant ikke lenken.' using errcode = 'P0001';
  end if;
  if not (app.can_manage_ladder(v_link.ladder_id) or app.is_staff()) then
    raise exception 'Du kan ikke endre lenkene på denne leideren.' using errcode = '42501';
  end if;
  if v_link.revoked_at is null then
    update public.maintenance_links
       set revoked_at = now(), revoked_by = auth.uid()
     where id = p_link;
  end if;
end;
$$;

revoke all on function public.revoke_maintenance_link(uuid) from public, anon;
grant execute on function public.revoke_maintenance_link(uuid) to authenticated;

-- Slår opp en lenke på tokenet. Gir bare det skjemaet trenger å vise.
create or replace function public.get_maintenance_link(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  v_link record;
begin
  if length(coalesce(p_token, '')) < 20 then
    return null;
  end if;

  select k.id, k.expires_at, k.revoked_at, k.recipient, k.created_by_name,
         l.serial_number, p.name as product_name,
         coalesce(l.custom_length_m, p.length_m) as length_m,
         v.name as vessel_name
    into v_link
    from public.maintenance_links k
    join public.ladders l on l.id = k.ladder_id
    join public.products p on p.id = l.product_id
    left join public.vessels v on v.id = l.vessel_id
   where k.token_hash = v_hash;

  if v_link.id is null then
    return null;
  end if;
  if v_link.revoked_at is not null then
    return jsonb_build_object('state', 'revoked');
  end if;
  if v_link.expires_at <= now() then
    return jsonb_build_object('state', 'expired');
  end if;

  return jsonb_build_object(
    'state', 'active',
    'serial', v_link.serial_number,
    'product', v_link.product_name,
    'length_m', v_link.length_m,
    'vessel', v_link.vessel_name,
    'recipient', v_link.recipient,
    'created_by_name', v_link.created_by_name,
    'expires_at', v_link.expires_at
  );
end;
$$;

revoke all on function public.get_maintenance_link(text) from public;
grant execute on function public.get_maintenance_link(text) to anon, authenticated;

-- Registrering via lenke. Leideren og fartøyet hentes fra lenken, aldri fra
-- skjemaet. Høyst 30 registreringer per lenke per døgn.
create or replace function public.submit_maintenance_via_link(p_token text, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash      text := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  v_link      record;
  v_name      text := left(btrim(coalesce(payload ->> 'name', '')), 120);
  v_email     text := nullif(lower(left(btrim(coalesce(payload ->> 'email', '')), 160)), '');
  v_notes     text := nullif(left(btrim(coalesce(payload ->> 'notes', '')), 4000), '');
  v_title     text := nullif(left(btrim(coalesce(payload ->> 'title', '')), 160), '');
  v_paper     boolean := coalesce((payload ->> 'paper_form')::boolean, false);
  v_items     jsonb := coalesce(payload -> 'items', '[]'::jsonb);
  v_list      public.maintenance_checklist;
  v_when      date;
  v_id        uuid;
begin
  if length(coalesce(p_token, '')) < 20 then
    raise exception 'Lenken er ikke gyldig.' using errcode = 'P0001';
  end if;

  select k.*, l.serial_number, l.vessel_id, v.name as vessel_name
    into v_link
    from public.maintenance_links k
    join public.ladders l on l.id = k.ladder_id
    left join public.vessels v on v.id = l.vessel_id
   where k.token_hash = v_hash
   for update of k;

  if v_link.id is null or v_link.revoked_at is not null or v_link.expires_at <= now() then
    raise exception 'Lenken er ikke gyldig lenger. Be om en ny lenke.' using errcode = 'P0001';
  end if;

  begin
    v_list := nullif(payload ->> 'checklist', '')::public.maintenance_checklist;
  exception when invalid_text_representation then
    raise exception 'Ukjent sjekkliste.' using errcode = 'P0001';
  end;

  begin
    v_when := coalesce(nullif(payload ->> 'performed_at', '')::date, current_date);
  exception when others then
    raise exception 'Datoen er ikke gyldig.' using errcode = 'P0001';
  end;

  if v_name = '' then
    raise exception 'Skriv navnet ditt.' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'E-postadressen ser ikke gyldig ut.' using errcode = 'P0001';
  end if;
  if v_when > current_date or v_when < current_date - 366 then
    raise exception 'Datoen må være i løpet av det siste året.' using errcode = 'P0001';
  end if;
  if v_list is null and not v_paper and v_title is null and v_notes is null then
    raise exception 'Skriv hva som ble gjort.' using errcode = 'P0001';
  end if;
  if not app.throttle('maintenance-link:' || v_link.id, 30, interval '1 day') then
    raise exception 'For mange registreringer på kort tid. Prøv igjen senere.' using errcode = 'P0001';
  end if;

  insert into public.maintenance_logs
    (ladder_id, vessel_id, serial_number_raw, vessel_name_raw, reporter_name, reporter_email,
     performed_at, notes, source, kind, title, checklist, checklist_items, paper_form, link_id)
  values
    (v_link.ladder_id, v_link.vessel_id, v_link.serial_number, v_link.vessel_name, v_name, v_email,
     v_when, v_notes, 'link',
     case when v_list is null then 'maintenance' else 'inspection' end::public.log_kind,
     coalesce(case v_list
                when 'before_use' then 'Kontroll før bruk'
                when 'after_use'  then 'Kontroll etter bruk'
                when 'quarterly'  then 'Kvartalsvis kontroll'
              end, v_title, 'Vedlikehold'),
     v_list, case when jsonb_typeof(v_items) = 'array' then v_items else 'null'::jsonb end,
     v_paper, v_link.id)
  returning id into v_id;

  update public.maintenance_links
     set use_count = use_count + 1, last_used_at = now()
   where id = v_link.id;

  return jsonb_build_object('log_id', v_id);
end;
$$;

revoke all on function public.submit_maintenance_via_link(text, jsonb) from public;
grant execute on function public.submit_maintenance_via_link(text, jsonb) to anon, authenticated;

-- ── Bilder til registreringer via lenke ─────────────────────────────────────
-- Som for det åpne skjemaet: mappen er åpen en halvtime, til registreringen
-- er avsluttet, og høyst 10 filer. Ellers uendret fra
-- security_hardening_followup.
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
        or (m.source = 'link' and m.notified_at is null
            and m.created_at > now() - interval '30 minutes')
        or (m.source = 'web' and m.notified_at is null
            and m.created_at > now() - interval '30 minutes'
            and (select coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 10485760)), 0)
                   from storage.objects o
                   join public.maintenance_logs w
                     on w.id = app.uuid_or_null(split_part(o.name, '/', 1))
                  where o.bucket_id = 'maintenance-photos'
                    and w.source = 'web'
                    and o.created_at > now() - interval '1 day') < 209715200)
      )
  )
  and (
    app.is_staff()
    or (select count(*) from storage.objects o
         where o.bucket_id = 'maintenance-photos'
           and o.name like p_folder || '/%') < 10
  );
$$;

-- Avslutter en registrering fra lenken (eller det gamle åpne skjemaet):
-- knytter bildene til den og stempler den som avsluttet. Lenkeregistreringer
-- varsles allerede ved innsetting (maintenance_logs_notify), så her varsles
-- bare administratorene om det åpne skjemaet.
create or replace function public.finish_maintenance_report(p_log uuid, p_paths text[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_log   record;
  v_path  text;
  v_count integer := 0;
begin
  select m.* into v_log from public.maintenance_logs m where m.id = p_log for update;

  if v_log.id is null or v_log.source not in ('web', 'link')
     or v_log.created_at < now() - interval '2 hours' then
    raise exception 'Fant ikke rapporten.' using errcode = 'P0001';
  end if;
  if v_log.notified_at is not null then
    return jsonb_build_object('ok', true, 'photos', 0, 'already', true, 'source', v_log.source);
  end if;

  foreach v_path in array (coalesce(p_paths, '{}'::text[]))[1:10]
  loop
    if v_path like p_log::text || '/%'
       and exists (select 1 from storage.objects o
                   where o.bucket_id = 'maintenance-photos' and o.name = v_path) then
      insert into public.maintenance_photos (maintenance_log_id, storage_path)
      values (p_log, v_path);
      v_count := v_count + 1;
    end if;
  end loop;

  update public.maintenance_logs set notified_at = now() where id = p_log;

  if v_log.source = 'web' then
    perform app.notify_staff(
      'admin', 'maintenance_report',
      'Vedlikehold registrert på ' || coalesce(v_log.serial_number_raw, 'ukjent leider'),
      coalesce(v_log.reporter_name, '') || coalesce(' – ' || v_log.vessel_name_raw, '') ||
        case when v_log.ladder_id is null then ' (serienummeret er ikke koblet til en leider)' else '' end,
      '/admin/vedlikehold'
    );
  end if;

  return jsonb_build_object(
    'ok', true, 'photos', v_count, 'source', v_log.source,
    'serial', v_log.serial_number_raw, 'vessel', v_log.vessel_name_raw,
    'imo', v_log.imo_raw, 'reporter', v_log.reporter_name,
    'reporter_email', v_log.reporter_email, 'notes', v_log.notes,
    'matched', v_log.ladder_id is not null
  );
end;
$$;

-- Varsling: registreringer via lenke varsles til dem som forvalter leideren,
-- som loggføringer fra Min side. Ellers uendret fra certificate_followups.
create or replace function public.maintenance_logs_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_serial text;
begin
  if new.ladder_id is null or new.kind in ('usage', 'note')
     or new.source not in ('portal', 'admin', 'link') then
    return new;
  end if;

  select l.serial_number into v_serial from public.ladders l where l.id = new.ladder_id;

  if new.source = 'admin' then
    perform app.notify_ladder_users(
      new.ladder_id, 'log_entry',
      'NorthWest Coast har loggført arbeid på leider ' || v_serial,
      coalesce(new.title, 'Vedlikehold'),
      '/minside/leider/' || new.ladder_id || '?fane=historikk'
    );
  else
    perform app.notify_ladder_managers(
      new.ladder_id, 'log_entry',
      case when new.source = 'link' then 'Registrert via lenke på leider ' else 'Ny loggføring på leider ' end
        || v_serial,
      coalesce(new.title, 'Vedlikehold') ||
        case when new.reporter_name is not null then ' – ' || new.reporter_name else '' end ||
        case when new.incomplete then ' (ufullstendig)' else '' end,
      '/minside/leider/' || new.ladder_id || '?fane=historikk'
    );
  end if;
  return new;
end;
$$;

-- Fra Min side skrives loggføringen rett i tabellen. Policyen er den samme
-- som før (security_hardening_access), pluss at en innlogget ikke kan knytte
-- sin egen loggføring til en lenke.
drop policy maintenance_logs_insert on public.maintenance_logs;
create policy maintenance_logs_insert on public.maintenance_logs
  for insert to authenticated
  with check (
    (
      ladder_id is not null
      and app.can_access_ladder(ladder_id)
      and reported_by_user_id = auth.uid()
      and source = 'portal'
      and link_id is null
      and (performed_at is null or performed_at <= current_date)
      and notified_at is null
      and (vessel_id is null or vessel_id = (
        select l.vessel_id from public.ladders l where l.id = maintenance_logs.ladder_id
      ))
    )
    or app.is_staff()
  );

-- ── 4. Det åpne skjemaet stenges ────────────────────────────────────────────
-- Funksjonen blir liggende for rapportene som allerede finnes, men kan ikke
-- lenger kalles via API-et.
revoke execute on function public.submit_maintenance_report(jsonb) from anon, authenticated;
