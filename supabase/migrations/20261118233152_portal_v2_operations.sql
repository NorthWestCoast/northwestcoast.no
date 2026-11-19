-- ============================================================================
-- Portal v2 – del 2: logg og oppgaver, support, service, bestilling,
-- produksjon, nyheter, produkter, avtaler, offentlige skjema og lagring
-- ============================================================================

create or replace function app.my_verified_email()
returns text
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select lower(u.email::text)
  from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

grant execute on function app.my_verified_email() to authenticated, service_role;

-- ── 12. Logg: flere typer enn «vedlikehold» ─────────────────────────────────
create type public.log_kind as enum
  ('maintenance', 'inspection', 'test', 'usage', 'repair', 'note');

alter table public.maintenance_logs
  add column kind  public.log_kind not null default 'maintenance',
  add column title text;

-- ── 13. Planlagte oppgaver på en leider ─────────────────────────────────────
create table public.ladder_tasks (
  id                uuid primary key default gen_random_uuid(),
  ladder_id         uuid not null references public.ladders(id) on delete cascade,
  kind              public.log_kind not null default 'inspection',
  title             text not null check (length(btrim(title)) between 2 and 160),
  description       text,
  due_date          date not null,
  recurrence_months integer check (recurrence_months between 1 and 120),
  status            text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  completed_at      timestamptz,
  completed_by      uuid references auth.users(id) on delete set null,
  completed_log_id  uuid references public.maintenance_logs(id) on delete set null,
  created_by        uuid references auth.users(id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now()
);

create index ladder_tasks_ladder_idx on public.ladder_tasks (ladder_id, due_date);
create index ladder_tasks_open_idx on public.ladder_tasks (due_date) where status = 'open';

alter table public.ladder_tasks enable row level security;

create policy ladder_tasks_select on public.ladder_tasks
  for select to authenticated
  using (app.can_access_ladder(ladder_id) or app.is_staff());

create policy ladder_tasks_insert on public.ladder_tasks
  for insert to authenticated
  with check (
    (app.can_access_ladder(ladder_id) and created_by = auth.uid() and status = 'open')
    or app.is_staff()
  );

create policy ladder_tasks_update on public.ladder_tasks
  for update to authenticated
  using (app.can_manage_ladder(ladder_id) or created_by = auth.uid() or app.is_staff())
  with check (app.can_manage_ladder(ladder_id) or created_by = auth.uid() or app.is_staff());

create policy ladder_tasks_delete on public.ladder_tasks
  for delete to authenticated
  using (app.can_manage_ladder(ladder_id) or created_by = auth.uid() or app.is_staff());

grant select, insert, delete on public.ladder_tasks to authenticated;
-- Fullføring går gjennom complete_ladder_task(), som også skriver loggen.
grant update (title, description, due_date, recurrence_months, kind)
  on public.ladder_tasks to authenticated;

-- Fullfører en oppgave: skriver loggføringen som dokumenterer den, og legger
-- inn neste forekomst hvis oppgaven gjentar seg.
create or replace function public.complete_ladder_task(
  p_task uuid,
  p_notes text default null,
  p_performed_at date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_task record;
  v_name text;
  v_log  uuid;
  v_when date := coalesce(p_performed_at, current_date);
begin
  select t.* into v_task from public.ladder_tasks t where t.id = p_task for update;

  if v_task.id is null then
    raise exception 'Fant ikke oppgaven.' using errcode = 'P0001';
  end if;
  if not (app.can_access_ladder(v_task.ladder_id) or app.is_staff()) then
    raise exception 'Du har ikke tilgang til denne leideren.' using errcode = '42501';
  end if;
  if v_task.status <> 'open' then
    raise exception 'Oppgaven er allerede avsluttet.' using errcode = 'P0001';
  end if;
  if v_when > current_date then
    raise exception 'Datoen kan ikke ligge fram i tid.' using errcode = 'P0001';
  end if;

  select coalesce(p.full_name, p.email::text) into v_name
  from public.profiles p where p.user_id = auth.uid();

  insert into public.maintenance_logs
    (ladder_id, vessel_id, serial_number_raw, reported_by_user_id, reporter_name,
     performed_at, notes, source, kind, title)
  select l.id, l.vessel_id, l.serial_number, auth.uid(), v_name,
         v_when, nullif(left(btrim(coalesce(p_notes, '')), 4000), ''),
         'portal', v_task.kind, v_task.title
  from public.ladders l where l.id = v_task.ladder_id
  returning id into v_log;

  update public.ladder_tasks
     set status = 'done', completed_at = now(), completed_by = auth.uid(),
         completed_log_id = v_log
   where id = p_task;

  if v_task.recurrence_months is not null then
    insert into public.ladder_tasks
      (ladder_id, kind, title, description, due_date, recurrence_months, created_by)
    values
      (v_task.ladder_id, v_task.kind, v_task.title, v_task.description,
       (v_when + make_interval(months => v_task.recurrence_months))::date,
       v_task.recurrence_months, v_task.created_by);
  end if;

  return v_log;
end;
$$;

grant execute on function public.complete_ladder_task(uuid, text, date) to authenticated;

-- Varsle de som styrer leideren når mannskapet loggfører noe av betydning.
create or replace function public.maintenance_logs_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_serial text;
begin
  if new.ladder_id is null or new.source <> 'portal' or new.kind in ('usage', 'note') then
    return new;
  end if;

  select l.serial_number into v_serial from public.ladders l where l.id = new.ladder_id;

  perform app.notify_ladder_managers(
    new.ladder_id, 'log_entry',
    'Ny loggføring på leider ' || v_serial,
    coalesce(new.title, 'Vedlikehold') ||
      case when new.reporter_name is not null then ' – ' || new.reporter_name else '' end,
    '/minside/leider/' || new.ladder_id
  );
  return new;
end;
$$;

create trigger maintenance_logs_notify
  after insert on public.maintenance_logs
  for each row execute function public.maintenance_logs_notify();

-- ── 14. Support ─────────────────────────────────────────────────────────────
create sequence public.ticket_number_seq;

create table public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  ticket_number   text not null unique
                  default ('S-' || lpad(nextval('public.ticket_number_seq')::text, 5, '0')),
  company_id      uuid references public.companies(id) on delete set null,
  ladder_id       uuid references public.ladders(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  contact_name    text,
  contact_email   citext,
  category        text not null default 'support'
                  check (category in ('support', 'service', 'spare_parts', 'warranty', 'other')),
  subject         text not null check (length(btrim(subject)) between 3 and 200),
  status          text not null default 'open'
                  check (status in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  priority        text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  closed_at       timestamptz
);

create index support_tickets_company_idx on public.support_tickets (company_id);
create index support_tickets_creator_idx on public.support_tickets (created_by);
create index support_tickets_open_idx on public.support_tickets (last_message_at desc)
  where status not in ('resolved', 'closed');

create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table public.ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  author_name text,
  from_staff  boolean not null default false,
  body        text not null check (length(btrim(body)) between 1 and 5000),
  created_at  timestamptz not null default now()
);

create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;

create or replace function app.can_see_ticket(p_ticket uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.support_tickets t
    where t.id = p_ticket
      and (
        t.created_by = auth.uid()
        or exists (select 1 from public.company_members cm
                   where cm.company_id = t.company_id and cm.user_id = auth.uid())
      )
  );
$$;

grant execute on function app.can_see_ticket(uuid) to authenticated, service_role;

create policy support_tickets_select on public.support_tickets
  for select to authenticated
  using (app.can_see_ticket(id) or app.is_staff());

create policy support_tickets_staff_update on public.support_tickets
  for update to authenticated
  using (app.is_staff()) with check (app.is_staff());

create policy ticket_messages_select on public.ticket_messages
  for select to authenticated
  using (app.can_see_ticket(ticket_id) or app.is_staff());

grant select on public.support_tickets, public.ticket_messages to authenticated;
grant update (status, priority, category, company_id, ladder_id) on public.support_tickets to authenticated;

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
  if v_company is null then
    select cm.company_id into v_company
    from public.company_members cm where cm.user_id = v_uid
    order by cm.created_at limit 1;
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

create or replace function public.reply_ticket(p_ticket uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_staff  boolean := app.is_staff();
  v_ticket record;
  v_name   text;
begin
  select t.* into v_ticket from public.support_tickets t where t.id = p_ticket for update;

  if v_ticket.id is null or not (v_staff or app.can_see_ticket(p_ticket)) then
    raise exception 'Fant ikke saken.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_body, ''))) < 1 then
    raise exception 'Meldingen er tom.' using errcode = 'P0001';
  end if;

  select coalesce(p.full_name, p.email::text) into v_name
  from public.profiles p where p.user_id = v_uid;

  insert into public.ticket_messages (ticket_id, author_id, author_name, from_staff, body)
  values (p_ticket, v_uid,
          case when v_staff then coalesce(v_name, 'NorthWest Coast') else v_name end,
          v_staff, left(btrim(p_body), 5000));

  update public.support_tickets
     set status = case
                    when v_staff then 'waiting_customer'
                    when status in ('waiting_customer', 'resolved', 'closed') then 'open'
                    else status
                  end,
         closed_at = null,
         last_message_at = now()
   where id = p_ticket;

  if v_staff then
    perform app.notify_user(
      v_ticket.created_by, 'ticket_reply',
      'Svar på sak ' || v_ticket.ticket_number,
      v_ticket.subject,
      '/minside/support/' || p_ticket
    );
  else
    perform app.notify_staff(
      'admin', 'ticket_reply',
      'Nytt svar i sak ' || v_ticket.ticket_number,
      v_ticket.subject,
      '/admin/saker/' || p_ticket
    );
  end if;
end;
$$;

-- Kunden kan lukke og gjenåpne egne saker. Ansatte kan sette alle statuser.
create or replace function public.set_ticket_status(p_ticket uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_staff  boolean := app.is_staff();
  v_ticket record;
begin
  select t.* into v_ticket from public.support_tickets t where t.id = p_ticket for update;

  if v_ticket.id is null or not (v_staff or app.can_see_ticket(p_ticket)) then
    raise exception 'Fant ikke saken.' using errcode = 'P0001';
  end if;
  if p_status not in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed') then
    raise exception 'Ugyldig status.' using errcode = 'P0001';
  end if;
  if not v_staff and p_status not in ('open', 'closed') then
    raise exception 'Du kan bare lukke eller gjenåpne saken.' using errcode = '42501';
  end if;

  update public.support_tickets
     set status = p_status,
         closed_at = case when p_status in ('resolved', 'closed') then now() end
   where id = p_ticket;

  if v_staff and p_status in ('resolved', 'closed') then
    perform app.notify_user(
      v_ticket.created_by, 'ticket_closed',
      'Sak ' || v_ticket.ticket_number || ' er løst',
      v_ticket.subject,
      '/minside/support/' || p_ticket
    );
  end if;
end;
$$;

grant execute on function public.create_ticket(text, text, text, uuid, uuid) to authenticated;
grant execute on function public.reply_ticket(uuid, text) to authenticated;
grant execute on function public.set_ticket_status(uuid, text) to authenticated;

-- ── 15. Bestilling av service ───────────────────────────────────────────────
create table public.service_bookings (
  id                uuid primary key default gen_random_uuid(),
  ladder_id         uuid not null references public.ladders(id) on delete cascade,
  requested_by      uuid references auth.users(id) on delete set null,
  requester_name    text,
  preferred_date    date,
  location          text,
  notes             text,
  status            text not null default 'requested'
                    check (status in ('requested', 'scheduled', 'completed', 'cancelled')),
  scheduled_date    date,
  technician        text,
  staff_note        text,
  service_report_id uuid references public.service_reports(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index service_bookings_ladder_idx on public.service_bookings (ladder_id, created_at desc);
create index service_bookings_open_idx on public.service_bookings (created_at desc)
  where status in ('requested', 'scheduled');

create trigger service_bookings_set_updated_at
  before update on public.service_bookings
  for each row execute function public.set_updated_at();

alter table public.service_bookings enable row level security;

create policy service_bookings_select on public.service_bookings
  for select to authenticated
  using (app.can_access_ladder(ladder_id) or app.is_staff());

create policy service_bookings_staff on public.service_bookings
  for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

grant select, insert, update, delete on public.service_bookings to authenticated;

create or replace function public.request_service(
  p_ladder uuid,
  p_preferred_date date default null,
  p_location text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_name   text;
  v_serial text;
  v_id     uuid;
begin
  if v_uid is null or not app.can_access_ladder(p_ladder) then
    raise exception 'Du har ikke tilgang til denne leideren.' using errcode = '42501';
  end if;
  if p_preferred_date is not null and p_preferred_date < current_date then
    raise exception 'Ønsket dato kan ikke ligge bak i tid.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.service_bookings b
             where b.ladder_id = p_ladder and b.status = 'requested') then
    raise exception 'Det ligger allerede en ubehandlet servicebestilling på denne leideren.'
      using errcode = 'P0001';
  end if;

  select coalesce(p.full_name, p.email::text) into v_name
  from public.profiles p where p.user_id = v_uid;
  select l.serial_number into v_serial from public.ladders l where l.id = p_ladder;

  insert into public.service_bookings
    (ladder_id, requested_by, requester_name, preferred_date, location, notes)
  values
    (p_ladder, v_uid, v_name, p_preferred_date,
     nullif(left(btrim(coalesce(p_location, '')), 200), ''),
     nullif(left(btrim(coalesce(p_notes, '')), 2000), ''))
  returning id into v_id;

  perform app.notify_staff(
    'admin', 'service_request',
    'Service bestilt på leider ' || v_serial,
    coalesce(v_name, 'En kunde') ||
      case when p_preferred_date is not null
           then ' ønsker ' || to_char(p_preferred_date, 'DD.MM.YYYY') else '' end,
    '/admin/service'
  );

  return v_id;
end;
$$;

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
     or not (app.can_access_ladder(v_booking.ladder_id) or app.is_staff()) then
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

grant execute on function public.request_service(uuid, date, text, text) to authenticated;
grant execute on function public.cancel_service_booking(uuid) to authenticated;

-- Kunden får vite når service er avtalt eller avlyst av NorthWest Coast.
create or replace function public.service_bookings_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_serial text;
begin
  if new.status is not distinct from old.status
     and new.scheduled_date is not distinct from old.scheduled_date then
    return new;
  end if;

  select l.serial_number into v_serial from public.ladders l where l.id = new.ladder_id;

  if new.status = 'scheduled' then
    perform app.notify_ladder_users(
      new.ladder_id, 'service_scheduled',
      'Service på leider ' || v_serial || ' er avtalt',
      case when new.scheduled_date is not null
           then 'Dato: ' || to_char(new.scheduled_date, 'DD.MM.YYYY') end,
      '/minside/leider/' || new.ladder_id
    );
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    perform app.notify_user(
      new.requested_by, 'service_cancelled',
      'Servicebestillingen på leider ' || v_serial || ' er avlyst',
      new.staff_note, '/minside/leider/' || new.ladder_id
    );
  end if;
  return new;
end;
$$;

create trigger service_bookings_notify
  after update on public.service_bookings
  for each row execute function public.service_bookings_notify();

-- En registrert servicerapport avslutter åpne bestillinger og varsler kunden.
create or replace function public.service_reports_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_serial text;
begin
  update public.service_bookings
     set status = 'completed', service_report_id = new.id
   where ladder_id = new.ladder_id and status in ('requested', 'scheduled');

  select l.serial_number into v_serial from public.ladders l where l.id = new.ladder_id;

  perform app.notify_ladder_users(
    new.ladder_id, 'service_done',
    'Service registrert på leider ' || v_serial,
    case new.result
      when 'ok' then 'Godkjent.'
      when 'ok_with_remarks' then 'Godkjent med anmerkning.'
      else 'Ikke godkjent – se rapporten.'
    end,
    '/minside/leider/' || new.ladder_id
  );
  return new;
end;
$$;

create trigger service_reports_after_insert
  after insert on public.service_reports
  for each row execute function public.service_reports_after_insert();

-- ── 16. Serviceavtaler ──────────────────────────────────────────────────────
create table public.service_agreements (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  title           text not null default 'Serviceavtale',
  starts_on       date not null,
  ends_on         date,
  interval_months integer not null default 12 check (interval_months between 1 and 120),
  price_nok       integer check (price_nok is null or price_nok >= 0),
  covers          text,
  notes           text,
  status          text not null default 'active'
                  check (status in ('draft', 'active', 'expired', 'cancelled')),
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint service_agreements_period check (ends_on is null or ends_on >= starts_on)
);

create index service_agreements_company_idx on public.service_agreements (company_id);

create trigger service_agreements_set_updated_at
  before update on public.service_agreements
  for each row execute function public.set_updated_at();

alter table public.service_agreements enable row level security;

create policy service_agreements_select on public.service_agreements
  for select to authenticated
  using (company_id in (select app.auth_company_ids()) or app.is_staff());

create policy service_agreements_staff on public.service_agreements
  for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

grant select, insert, update, delete on public.service_agreements to authenticated;

-- ── 17. Produkter og bestillinger ───────────────────────────────────────────
alter table public.products
  add column description text,
  add column image_url   text,
  add column sort_order  integer not null default 0;

alter table public.order_lines
  add column on_request boolean not null default false;

alter table public.orders
  add column created_by        uuid references auth.users(id) on delete set null,
  add column imo               text,
  add column delivery_address  text,
  add column expected_delivery date,
  add column confirmed_at      timestamptz;

create index orders_created_by_idx on public.orders (created_by);

alter table public.deliveries
  add column job_id uuid;

-- Hvem ser en bestilling: den som la den inn, selskapet den tilhører, og den
-- som bestilte på nettsiden med samme (verifiserte) e-postadresse.
create or replace function app.can_see_order(p_order uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order
      and (
        o.created_by = auth.uid()
        or exists (select 1 from public.company_members cm
                   where cm.company_id = o.company_id and cm.user_id = auth.uid())
        or lower(o.contact_email::text) = app.my_verified_email()
      )
  );
$$;

grant execute on function app.can_see_order(uuid) to authenticated, service_role;

drop policy orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated
  using (app.can_see_order(id) or app.is_staff());

drop policy order_lines_select on public.order_lines;
create policy order_lines_select on public.order_lines
  for select to authenticated
  using (app.can_see_order(order_id) or app.is_staff());

drop policy deliveries_select on public.deliveries;
create policy deliveries_select on public.deliveries
  for select to authenticated
  using (app.can_see_order(order_id) or app.is_staff());

-- Tar imot en bestilling, fra nettsiden eller fra Min side. Prisene leses fra
-- katalogen her og nå; ingenting klienten sender om pris blir brukt.
create or replace function public.place_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_name     text := left(btrim(coalesce(payload ->> 'name', '')), 120);
  v_email    text := lower(left(btrim(coalesce(payload ->> 'email', '')), 160));
  v_phone    text := nullif(left(btrim(coalesce(payload ->> 'phone', '')), 40), '');
  v_vessel   text := nullif(left(btrim(coalesce(payload ->> 'vessel', '')), 160), '');
  v_imo      text := nullif(left(btrim(coalesce(payload ->> 'imo', '')), 20), '');
  v_notes    text := nullif(left(btrim(coalesce(payload ->> 'notes', '')), 4000), '');
  v_address  text := nullif(left(btrim(coalesce(payload ->> 'delivery_address', '')), 400), '');
  v_source   text := case when payload ->> 'source' in ('web', 'portal', 'calculator')
                          then payload ->> 'source' else 'web' end;
  v_company  uuid;
  v_order    record;
  v_item     jsonb;
  v_product  record;
  v_cab_id   uuid;
  v_cab_name text;
  v_cab_price integer;
  v_qty      integer;
  v_with     boolean;
  v_unit     integer;
  v_cab      integer;
  v_line     integer;
  v_total    integer := 0;
  v_units    integer := 0;
  v_lines    jsonb := '[]'::jsonb;
  v_rows     jsonb := '[]'::jsonb;
  r          jsonb;
begin
  if v_name = '' or v_email = '' then
    raise exception 'Navn og e-post er påkrevd.' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'E-postadressen ser ikke gyldig ut.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(payload -> 'items') is distinct from 'array'
     or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'Bestillingen er tom.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(payload -> 'items') > 30 then
    raise exception 'Bestillingen har for mange linjer.' using errcode = 'P0001';
  end if;

  -- Grenser for hvor mye som kan komme inn uten innlogging.
  if not app.throttle('order:email:' || v_email, 6, interval '1 hour')
     or (v_uid is null and not app.throttle('order:anon', 60, interval '1 hour')) then
    raise exception 'For mange bestillinger på kort tid. Prøv igjen senere eller ring oss.'
      using errcode = 'P0001';
  end if;

  if v_uid is not null and nullif(payload ->> 'company_id', '') is not null then
    select cm.company_id into v_company
    from public.company_members cm
    where cm.user_id = v_uid and cm.company_id = (payload ->> 'company_id')::uuid;
  end if;

  for v_item in select * from jsonb_array_elements(payload -> 'items')
  loop
    v_qty := least(greatest(coalesce((v_item ->> 'qty')::integer, 1), 1), 99);
    v_with := coalesce((v_item ->> 'with_cabinet')::boolean, false);

    select p.* into v_product
    from public.products p
    where p.id = (v_item ->> 'product_id')::uuid and p.active;

    if v_product.id is null then
      raise exception 'Et produkt i bestillingen finnes ikke lenger. Last siden på nytt.'
        using errcode = 'P0001';
    end if;

    v_cab_id := null; v_cab_name := null; v_cab_price := 0;
    if v_with and v_product.cabinet_product_id is not null and not v_product.price_on_request then
      select c.id, c.name, c.price_nok into v_cab_id, v_cab_name, v_cab_price
      from public.products c
      where c.id = v_product.cabinet_product_id and c.active;
    end if;
    v_with := v_cab_id is not null;

    v_unit := case when v_product.price_on_request then 0 else v_product.price_nok end;
    v_cab  := case when v_with then coalesce(v_cab_price, 0) else 0 end;
    v_line := v_qty * (v_unit + v_cab);
    v_total := v_total + v_line;
    v_units := v_units + v_qty;

    v_rows := v_rows || jsonb_build_object(
      'product_id', v_product.id, 'qty', v_qty, 'with_cabinet', v_with,
      'unit', v_unit, 'cab', v_cab, 'line', v_line,
      'on_request', v_product.price_on_request);

    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id,
      'product_number', v_product.product_number,
      'name', v_product.name,
      'kind', v_product.kind,
      'length_m', v_product.length_m,
      'steps', v_product.steps,
      'qty', v_qty,
      'unit_price_nok', v_unit,
      'with_cabinet', v_with,
      'cabinet_name', case when v_with then v_cab_name end,
      'cabinet_price_nok', v_cab,
      'line_total_nok', v_line,
      'on_request', v_product.price_on_request);
  end loop;

  insert into public.orders
    (company_id, created_by, contact_name, contact_email, contact_phone,
     vessel_name, imo, notes, delivery_address, total_nok, source)
  values
    (v_company, v_uid, v_name, v_email, v_phone,
     v_vessel, v_imo, v_notes, v_address, v_total, v_source)
  returning * into v_order;

  for r in select * from jsonb_array_elements(v_rows)
  loop
    insert into public.order_lines
      (order_id, product_id, qty, with_cabinet, unit_price_nok,
       cabinet_price_nok, line_total_nok, on_request)
    values
      (v_order.id, (r ->> 'product_id')::uuid, (r ->> 'qty')::integer,
       (r ->> 'with_cabinet')::boolean, (r ->> 'unit')::integer,
       (r ->> 'cab')::integer, (r ->> 'line')::integer, (r ->> 'on_request')::boolean);
  end loop;

  perform app.notify_staff(
    'admin', 'order',
    'Ny bestilling ' || v_order.order_number,
    v_name || ' – ' || v_units || ' enhet(er), ' ||
      to_char(v_total, 'FM999G999G999') || ' kr eks. mva.',
    '/admin/bestillinger/' || v_order.id
  );

  return jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'total_nok', v_total,
    'units', v_units,
    'lines', v_lines
  );
end;
$$;

grant execute on function public.place_order(jsonb) to anon, authenticated;
-- place_order kjører som eier, så verken anon eller authenticated trenger
-- ordrenummer-funksjonen selv.

-- ── 18. Produksjon ──────────────────────────────────────────────────────────
create sequence public.job_number_seq;

create table public.production_step_templates (
  id          uuid primary key default gen_random_uuid(),
  position    integer not null,
  title       text not null check (length(btrim(title)) between 2 and 160),
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.production_jobs (
  id             uuid primary key default gen_random_uuid(),
  job_number     text not null unique
                 default ('P-' || lpad(nextval('public.job_number_seq')::text, 5, '0')),
  order_id       uuid references public.orders(id) on delete set null,
  order_line_id  uuid references public.order_lines(id) on delete set null,
  product_id     uuid not null references public.products(id),
  ladder_id      uuid references public.ladders(id) on delete set null,
  serial_number  text unique,
  -- Spesifikasjonen kopieres hit, så den står fast selv om katalogen endres.
  product_name   text not null,
  product_number text not null,
  length_m       numeric(4,1),
  steps          integer,
  with_cabinet   boolean not null default false,
  cabinet_name   text,
  spec_notes     text,
  order_number   text,
  customer_label text,
  vessel_name    text,
  status         text not null default 'queued'
                 check (status in ('queued', 'in_progress', 'ready', 'shipped', 'delivered', 'cancelled')),
  due_date       date,
  started_at     timestamptz,
  completed_at   timestamptz,
  shipped_at     timestamptz,
  delivered_at   timestamptz,
  created_by     uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index production_jobs_order_idx on public.production_jobs (order_id);
create index production_jobs_status_idx on public.production_jobs (status, due_date);

create trigger production_jobs_set_updated_at
  before update on public.production_jobs
  for each row execute function public.set_updated_at();

alter table public.deliveries
  add constraint deliveries_job_id_fkey
  foreign key (job_id) references public.production_jobs(id) on delete set null;

create table public.production_job_steps (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.production_jobs(id) on delete cascade,
  position     integer not null,
  title        text not null,
  description  text,
  done_at      timestamptz,
  done_by      uuid references auth.users(id) on delete set null,
  done_by_name text,
  note         text,
  unique (job_id, position)
);

alter table public.production_step_templates enable row level security;
alter table public.production_jobs enable row level security;
alter table public.production_job_steps enable row level security;

create or replace function app.can_see_job(p_job uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.production_jobs j
    where j.id = p_job and j.order_id is not null and app.can_see_order(j.order_id)
  );
$$;

grant execute on function app.can_see_job(uuid) to authenticated, service_role;

create policy production_step_templates_select on public.production_step_templates
  for select to authenticated using (app.is_production());

create policy production_step_templates_manage on public.production_step_templates
  for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- Kunden ser produksjonen av sin egen bestilling, men ikke andres.
create policy production_jobs_select on public.production_jobs
  for select to authenticated
  using (app.is_production() or (order_id is not null and app.can_see_order(order_id)));

create policy production_jobs_manage on public.production_jobs
  for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

create policy production_job_steps_select on public.production_job_steps
  for select to authenticated
  using (app.is_production() or app.can_see_job(job_id));

create policy production_job_steps_manage on public.production_job_steps
  for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

grant select, insert, update, delete
  on public.production_step_templates, public.production_jobs, public.production_job_steps
  to authenticated;

-- Standardsteg. Dette er et utgangspunkt som NorthWest Coast retter i admin.
insert into public.production_step_templates (position, title, description) values
  (1, 'Materialer plukket og kontrollert', 'Kontrollert mot spesifikasjonen på jobben.'),
  (2, 'Trinn og sidevanger montert', null),
  (3, 'Lengde og antall trinn kontrollmålt', 'Skal stemme med spesifikasjonen.'),
  (4, 'Produksjonsnummer merket', 'Nummeret registreres på jobben før dette steget fullføres.'),
  (5, 'Kvalitetskontroll og belastningstest', null),
  (6, 'Dokumentasjon lagt ved', 'Sertifikat og bruksanvisning.'),
  (7, 'Pakket', 'Med oppbevaringsskap hvis det er bestilt.'),
  (8, 'Klar for forsendelse', null);

create or replace function public.production_jobs_spawn_steps()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.production_job_steps (job_id, position, title, description)
  select new.id, row_number() over (order by t.position, t.created_at), t.title, t.description
  from public.production_step_templates t
  where t.active;
  return new;
end;
$$;

create trigger production_jobs_spawn_steps
  after insert on public.production_jobs
  for each row execute function public.production_jobs_spawn_steps();

-- Bekrefter en bestilling og legger én produksjonsjobb per leider.
create or replace function public.confirm_order(p_order uuid, p_due_date date default null)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order   record;
  v_line    record;
  v_label   text;
  v_created integer := 0;
  i         integer;
begin
  if not app.is_staff() then
    raise exception 'Bare administratorer kan bekrefte bestillinger.' using errcode = '42501';
  end if;

  select o.* into v_order from public.orders o where o.id = p_order for update;
  if v_order.id is null then
    raise exception 'Fant ikke bestillingen.' using errcode = 'P0001';
  end if;
  if v_order.status not in ('new', 'quoted') then
    raise exception 'Bestillingen er allerede bekreftet.' using errcode = 'P0001';
  end if;

  select coalesce(c.name, v_order.contact_name) into v_label
  from (select 1) x
  left join public.companies c on c.id = v_order.company_id;

  for v_line in
    select ol.*, p.kind, p.name as p_name, p.product_number as p_number,
           p.length_m as p_length, p.steps as p_steps, cab.name as cab_name
    from public.order_lines ol
    join public.products p on p.id = ol.product_id
    left join public.products cab on cab.id = p.cabinet_product_id
    where ol.order_id = p_order and p.kind = 'ladder'
  loop
    for i in 1 .. v_line.qty loop
      insert into public.production_jobs
        (order_id, order_line_id, product_id, product_name, product_number,
         length_m, steps, with_cabinet, cabinet_name, order_number,
         customer_label, vessel_name, due_date)
      values
        (p_order, v_line.id, v_line.product_id, v_line.p_name, v_line.p_number,
         v_line.p_length, v_line.p_steps, v_line.with_cabinet,
         case when v_line.with_cabinet then v_line.cab_name end,
         v_order.order_number, v_label, v_order.vessel_name,
         coalesce(p_due_date, v_order.expected_delivery));
      v_created := v_created + 1;
    end loop;
  end loop;

  update public.orders
     set status = case when v_created > 0 then 'in_production' else 'confirmed' end::public.order_status,
         confirmed_at = now(),
         expected_delivery = coalesce(p_due_date, expected_delivery)
   where id = p_order;

  if v_created > 0 then
    perform app.notify_staff(
      'production', 'production_new',
      v_created || ' ny(e) produksjonsjobb(er) fra ' || v_order.order_number,
      v_label, '/produksjon'
    );
  end if;

  perform app.notify_user(
    v_order.created_by, 'order_confirmed',
    'Bestilling ' || v_order.order_number || ' er bekreftet',
    case when v_created > 0 then 'Leideren er lagt i produksjon.' end,
    '/minside/bestillinger'
  );
  if v_order.company_id is not null then
    perform app.notify_company_admins(
      v_order.company_id, 'order_confirmed',
      'Bestilling ' || v_order.order_number || ' er bekreftet',
      case when v_created > 0 then 'Leideren er lagt i produksjon.' end,
      '/minside/bestillinger'
    );
  end if;

  return v_created;
end;
$$;

-- Kvitterer ut (eller angrer) et produksjonssteg.
create or replace function public.set_production_step(
  p_step uuid,
  p_done boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_step   record;
  v_job    record;
  v_name   text;
  v_left   integer;
  v_done   integer;
  v_status text;
begin
  if not app.is_production() then
    raise exception 'Bare produksjon kan kvittere ut steg.' using errcode = '42501';
  end if;

  select s.* into v_step from public.production_job_steps s where s.id = p_step for update;
  if v_step.id is null then
    raise exception 'Fant ikke steget.' using errcode = 'P0001';
  end if;

  select j.* into v_job from public.production_jobs j where j.id = v_step.job_id for update;
  if v_job.status in ('shipped', 'delivered', 'cancelled') then
    raise exception 'Jobben er avsluttet og kan ikke endres.' using errcode = 'P0001';
  end if;

  select coalesce(p.full_name, p.email::text) into v_name
  from public.profiles p where p.user_id = auth.uid();

  update public.production_job_steps
     set done_at = case when p_done then coalesce(done_at, now()) end,
         done_by = case when p_done then coalesce(done_by, auth.uid()) end,
         done_by_name = case when p_done then coalesce(done_by_name, v_name) end,
         note = coalesce(nullif(left(btrim(coalesce(p_note, '')), 1000), ''), note)
   where id = p_step;

  select count(*) filter (where s.done_at is null), count(*) filter (where s.done_at is not null)
    into v_left, v_done
  from public.production_job_steps s where s.job_id = v_job.id;

  v_status := case
                when v_left = 0 then 'ready'
                when v_done > 0 then 'in_progress'
                else 'queued'
              end;

  update public.production_jobs
     set status = v_status,
         started_at = case when v_done > 0 then coalesce(started_at, now()) end,
         completed_at = case when v_left = 0 then coalesce(completed_at, now()) end
   where id = v_job.id;

  if v_status = 'ready' and v_job.status <> 'ready' then
    perform app.notify_staff(
      'admin', 'production_ready',
      'Jobb ' || v_job.job_number || ' er klar for forsendelse',
      v_job.product_name || coalesce(' – ' || v_job.customer_label, ''),
      '/produksjon/' || v_job.id
    );
  end if;

  return jsonb_build_object('status', v_status, 'remaining', v_left);
end;
$$;

-- Registrerer produksjonsnummeret på jobben og oppretter selve leideren.
create or replace function public.assign_job_serial(p_job uuid, p_serial text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job     record;
  v_serial  text := upper(btrim(coalesce(p_serial, '')));
  v_ladder  uuid;
  v_company uuid;
begin
  if not app.is_production() then
    raise exception 'Bare produksjon kan registrere produksjonsnummer.' using errcode = '42501';
  end if;
  if v_serial !~ '^[A-Z0-9][A-Z0-9._/-]{2,39}$' then
    raise exception 'Produksjonsnummeret må være 3–40 tegn (bokstaver, tall, bindestrek).'
      using errcode = 'P0001';
  end if;

  select j.* into v_job from public.production_jobs j where j.id = p_job for update;
  if v_job.id is null then
    raise exception 'Fant ikke jobben.' using errcode = 'P0001';
  end if;
  if v_job.status in ('delivered', 'cancelled') then
    raise exception 'Jobben er avsluttet.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.production_jobs j
             where j.serial_number = v_serial and j.id <> p_job) then
    raise exception 'Produksjonsnummeret er allerede brukt på en annen jobb.' using errcode = 'P0001';
  end if;

  select o.company_id into v_company from public.orders o where o.id = v_job.order_id;

  if v_job.ladder_id is not null then
    update public.ladders set serial_number = v_serial where id = v_job.ladder_id;
    v_ladder := v_job.ladder_id;
  else
    if exists (select 1 from public.ladders l where upper(l.serial_number) = v_serial) then
      raise exception 'Det finnes allerede en leider med dette produksjonsnummeret.'
        using errcode = 'P0001';
    end if;
    insert into public.ladders (serial_number, product_id, status, company_id)
    values (v_serial, v_job.product_id, 'in_production', v_company)
    returning id into v_ladder;
  end if;

  update public.production_jobs
     set serial_number = v_serial, ladder_id = v_ladder
   where id = p_job;

  return v_ladder;
end;
$$;

-- Flytter jobben videre: sendt, levert eller kansellert.
create or replace function public.advance_job(
  p_job uuid,
  p_status text,
  p_carrier text default null,
  p_tracking text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job   record;
  v_order record;
  v_open  integer;
begin
  if not app.is_production() then
    raise exception 'Bare ansatte kan endre produksjonsjobber.' using errcode = '42501';
  end if;
  if p_status not in ('shipped', 'delivered', 'cancelled') then
    raise exception 'Ugyldig status.' using errcode = 'P0001';
  end if;
  if p_status = 'cancelled' and not app.is_staff() then
    raise exception 'Bare administratorer kan kansellere en jobb.' using errcode = '42501';
  end if;

  select j.* into v_job from public.production_jobs j where j.id = p_job for update;
  if v_job.id is null then
    raise exception 'Fant ikke jobben.' using errcode = 'P0001';
  end if;
  if v_job.status in ('delivered', 'cancelled') then
    raise exception 'Jobben er allerede avsluttet.' using errcode = 'P0001';
  end if;

  if p_status = 'shipped' then
    if v_job.status <> 'ready' then
      raise exception 'Alle steg må være kvittert ut før jobben kan sendes.' using errcode = 'P0001';
    end if;
    if v_job.ladder_id is null then
      raise exception 'Registrer produksjonsnummeret før jobben sendes.' using errcode = 'P0001';
    end if;

    update public.production_jobs set status = 'shipped', shipped_at = now() where id = p_job;
    update public.ladders
       set produced_at = coalesce(produced_at, current_date)
     where id = v_job.ladder_id;

    if v_job.order_id is not null then
      insert into public.deliveries (order_id, job_id, shipped_at, carrier, tracking_reference)
      values (v_job.order_id, p_job, current_date,
              nullif(left(btrim(coalesce(p_carrier, '')), 120), ''),
              nullif(left(btrim(coalesce(p_tracking, '')), 120), ''));
    end if;

  elsif p_status = 'delivered' then
    if v_job.status not in ('ready', 'shipped') then
      raise exception 'Jobben må være ferdig produsert før den kan leveres.' using errcode = 'P0001';
    end if;
    if v_job.ladder_id is null then
      raise exception 'Registrer produksjonsnummeret før jobben leveres.' using errcode = 'P0001';
    end if;

    update public.production_jobs
       set status = 'delivered',
           shipped_at = coalesce(shipped_at, now()),
           delivered_at = now()
     where id = p_job;

    update public.ladders
       set status = case when status = 'in_production' then 'delivered' else status end,
           produced_at = coalesce(produced_at, current_date)
     where id = v_job.ladder_id;

    if v_job.order_id is not null then
      update public.deliveries set delivered_at = current_date
       where job_id = p_job and delivered_at is null;
      if not found then
        insert into public.deliveries (order_id, job_id, shipped_at, delivered_at, carrier, tracking_reference)
        values (v_job.order_id, p_job, current_date, current_date,
                nullif(left(btrim(coalesce(p_carrier, '')), 120), ''),
                nullif(left(btrim(coalesce(p_tracking, '')), 120), ''));
      end if;
    end if;

  else
    update public.production_jobs set status = 'cancelled' where id = p_job;
  end if;

  -- Bestillingen er levert når ingen av jobbene står igjen.
  if v_job.order_id is not null then
    select o.* into v_order from public.orders o where o.id = v_job.order_id;

    select count(*) into v_open
    from public.production_jobs j
    where j.order_id = v_job.order_id and j.status not in ('delivered', 'cancelled');

    if v_open = 0 and p_status = 'delivered' then
      update public.orders set status = 'delivered' where id = v_job.order_id;
    end if;

    if p_status in ('shipped', 'delivered') then
      perform app.notify_user(
        v_order.created_by,
        case p_status when 'shipped' then 'order_shipped' else 'order_delivered' end,
        case p_status
          when 'shipped' then 'Leideren fra bestilling ' || v_order.order_number || ' er sendt'
          else 'Leideren fra bestilling ' || v_order.order_number || ' er levert'
        end,
        case when p_status = 'delivered'
             then 'Legg den til på fartøyet under Leidere.' end,
        '/minside/bestillinger'
      );
      if v_order.company_id is not null then
        perform app.notify_company_admins(
          v_order.company_id,
          case p_status when 'shipped' then 'order_shipped' else 'order_delivered' end,
          case p_status
            when 'shipped' then 'Leideren fra bestilling ' || v_order.order_number || ' er sendt'
            else 'Leideren fra bestilling ' || v_order.order_number || ' er levert'
          end,
          case when p_status = 'delivered'
               then 'Legg den til på fartøyet under Leidere.' end,
          '/minside/bestillinger'
        );
      end if;
    end if;
  end if;
end;
$$;

grant execute on function public.confirm_order(uuid, date) to authenticated;
grant execute on function public.set_production_step(uuid, boolean, text) to authenticated;
grant execute on function public.assign_job_serial(uuid, text) to authenticated;
grant execute on function public.advance_job(uuid, text, text, text) to authenticated;

-- ── 19. Nyheter ─────────────────────────────────────────────────────────────
create table public.posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_no        text not null check (length(btrim(title_no)) between 2 and 200),
  title_en        text,
  excerpt_no      text,
  excerpt_en      text,
  body_no         text not null default '',
  body_en         text,
  tag_no          text not null default 'Nyheter',
  tag_en          text not null default 'News',
  cover_image_url text,
  status          text not null default 'draft' check (status in ('draft', 'published')),
  published_at    timestamptz,
  author_id       uuid references auth.users(id) on delete set null default auth.uid(),
  author_name     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index posts_published_idx on public.posts (published_at desc) where status = 'published';

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

alter table public.posts enable row level security;

create policy posts_read_published on public.posts
  for select to anon, authenticated
  using ((status = 'published' and published_at is not null and published_at <= now())
         or app.is_staff());

create policy posts_manage on public.posts
  for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;

-- ── 20. Offentlige skjema uten service-role ─────────────────────────────────
create or replace function public.submit_contact_request(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_name  text := left(btrim(coalesce(payload ->> 'name', '')), 120);
  v_email text := lower(left(btrim(coalesce(payload ->> 'email', '')), 160));
  v_id    uuid;
begin
  if v_name = '' or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'Navn og gyldig e-post er påkrevd.' using errcode = 'P0001';
  end if;
  if not app.throttle('contact:email:' || v_email, 5, interval '1 hour')
     or not app.throttle('contact:all', 60, interval '1 hour') then
    raise exception 'For mange henvendelser på kort tid. Prøv igjen senere.' using errcode = 'P0001';
  end if;

  insert into public.contact_requests (name, email, phone, company_name, product, message, source)
  values (
    v_name, v_email,
    nullif(left(btrim(coalesce(payload ->> 'phone', '')), 40), ''),
    nullif(left(btrim(coalesce(payload ->> 'company', '')), 160), ''),
    nullif(left(btrim(coalesce(payload ->> 'product', '')), 120), ''),
    nullif(left(btrim(coalesce(payload ->> 'message', '')), 4000), ''),
    'web')
  returning id into v_id;

  perform app.notify_staff(
    'admin', 'contact', 'Ny henvendelse fra ' || v_name,
    nullif(left(btrim(coalesce(payload ->> 'message', '')), 200), ''),
    '/admin/henvendelser'
  );

  return v_id;
end;
$$;

create or replace function public.subscribe_newsletter(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_email text := lower(left(btrim(coalesce(p_email, '')), 160));
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'E-postadressen ser ikke gyldig ut.' using errcode = 'P0001';
  end if;
  if not app.throttle('newsletter:all', 120, interval '1 hour') then
    raise exception 'For mange påmeldinger på kort tid. Prøv igjen senere.' using errcode = 'P0001';
  end if;

  insert into public.newsletter_subscribers (email, source)
  values (v_email, 'web')
  on conflict (email) do update set unsubscribed_at = null;

  return true;
end;
$$;

-- Vedlikeholdsrapport fra det åpne skjemaet. Returnerer id-en, som også er
-- mappen bildene lastes opp til den neste halvtimen.
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
  if not app.throttle('maintenance:all', 60, interval '1 hour') then
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

-- Avslutter rapporten: knytter bildene som faktisk ble lastet opp, og varsler.
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

  if v_log.id is null or v_log.source <> 'web'
     or v_log.created_at < now() - interval '2 hours' then
    raise exception 'Fant ikke rapporten.' using errcode = 'P0001';
  end if;
  if v_log.notified_at is not null then
    return jsonb_build_object('ok', true, 'photos', 0, 'already', true);
  end if;

  foreach v_path in array (coalesce(p_paths, '{}'::text[]))[1:10]
  loop
    -- Bare filer i rapportens egen mappe, og bare de som faktisk finnes.
    if v_path like p_log::text || '/%'
       and exists (select 1 from storage.objects o
                   where o.bucket_id = 'maintenance-photos' and o.name = v_path) then
      insert into public.maintenance_photos (maintenance_log_id, storage_path)
      values (p_log, v_path);
      v_count := v_count + 1;
    end if;
  end loop;

  update public.maintenance_logs set notified_at = now() where id = p_log;

  perform app.notify_staff(
    'admin', 'maintenance_report',
    'Vedlikehold registrert på ' || coalesce(v_log.serial_number_raw, 'ukjent leider'),
    coalesce(v_log.reporter_name, '') || coalesce(' – ' || v_log.vessel_name_raw, '') ||
      case when v_log.ladder_id is null then ' (serienummeret er ikke koblet til en leider)' else '' end,
    '/admin/vedlikehold'
  );

  return jsonb_build_object(
    'ok', true, 'photos', v_count,
    'serial', v_log.serial_number_raw, 'vessel', v_log.vessel_name_raw,
    'imo', v_log.imo_raw, 'reporter', v_log.reporter_name,
    'reporter_email', v_log.reporter_email, 'notes', v_log.notes,
    'matched', v_log.ladder_id is not null
  );
end;
$$;

grant execute on function public.submit_contact_request(jsonb) to anon, authenticated;
grant execute on function public.subscribe_newsletter(text) to anon, authenticated;
grant execute on function public.submit_maintenance_report(jsonb) to anon, authenticated;
grant execute on function public.finish_maintenance_report(uuid, text[]) to anon, authenticated;

-- ── 21. Deling av tilstand (los) ────────────────────────────────────────────
alter table public.ladder_state_shares
  add column title      text,
  add column recipient  text,
  add column checklist  jsonb not null default '[]'::jsonb,
  add column created_by_name text;

-- Slår opp en delt rapport på lenkens token. Bare hashen ligger i databasen,
-- så en lekket tabell gir ingen gyldige lenker.
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
        'length_m', p.length_m,
        'steps', p.steps,
        'produced_at', l.produced_at,
        'installed_at', l.installed_at
      ),
      'vessel', case when v.id is not null then jsonb_build_object(
        'name', v.name, 'imo', v.imo, 'call_sign', v.call_sign
      ) end,
      'last_service', (
        select jsonb_build_object(
          'performed_at', sr.performed_at, 'result', sr.result,
          'next_service_due', sr.next_service_due, 'performed_by', sr.performed_by)
        from public.service_reports sr
        where sr.ladder_id = l.id
        order by sr.performed_at desc limit 1
      ),
      'recent_logs', (
        select coalesce(jsonb_agg(x order by x ->> 'performed_at' desc), '[]'::jsonb)
        from (
          select jsonb_build_object(
            'performed_at', m.performed_at, 'kind', m.kind,
            'title', m.title, 'reporter_name', m.reporter_name) as x
          from public.maintenance_logs m
          where m.ladder_id = l.id
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
    where l.id = v_share.ladder_id
  );
end;
$$;

grant execute on function public.get_ladder_share(text) to anon, authenticated;

-- ── 22. Lagring ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-media', 'public-media', true, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create or replace function app.uuid_or_null(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- Mappenavnet er id-en til loggføringen bildene hører til.
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
  );
$$;

create or replace function app.can_read_log_photo(p_folder text)
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
        or m.reported_by_user_id = auth.uid()
        or (m.ladder_id is not null and app.can_access_ladder(m.ladder_id))
      )
  );
$$;

-- Mappenavnet er id-en til delingen.
create or replace function app.can_upload_share_photo(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.ladder_state_shares s
    where s.id = app.uuid_or_null(p_folder)
      and s.revoked_at is null
      and (app.can_access_ladder(s.ladder_id) or app.is_staff())
  );
$$;

-- Den som har lenken (og dermed delings-id-en) ser bildene så lenge delingen
-- er aktiv. Trekkes delingen tilbake eller utløper den, stenges bildene også.
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
        (s.revoked_at is null and s.expires_at > now())
        or app.can_access_ladder(s.ladder_id)
        or app.is_staff()
      )
  );
$$;

grant execute on function app.uuid_or_null(text) to anon, authenticated, service_role;
grant execute on function app.can_upload_log_photo(text) to anon, authenticated, service_role;
grant execute on function app.can_read_log_photo(text) to authenticated, service_role;
grant execute on function app.can_upload_share_photo(text) to authenticated, service_role;
grant execute on function app.can_read_share_photo(text) to anon, authenticated, service_role;

create policy nwc_maintenance_photos_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'maintenance-photos'
              and app.can_upload_log_photo((storage.foldername(name))[1]));

create policy nwc_maintenance_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'maintenance-photos'
         and app.can_read_log_photo((storage.foldername(name))[1]));

create policy nwc_share_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ladder-state-photos'
              and app.can_upload_share_photo((storage.foldername(name))[1]));

create policy nwc_share_photos_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'ladder-state-photos'
         and app.can_read_share_photo((storage.foldername(name))[1]));

create policy nwc_share_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ladder-state-photos'
         and app.can_upload_share_photo((storage.foldername(name))[1]));

-- Servicerapporter (PDF): mappenavnet er leiderens id.
create policy nwc_service_reports_select on storage.objects
  for select to authenticated
  using (bucket_id = 'service-reports'
         and (app.is_staff()
              or app.can_access_ladder(app.uuid_or_null((storage.foldername(name))[1]))));

create policy nwc_service_reports_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'service-reports' and app.is_staff());

-- Bilder til nyheter og produkter. Bøtta er offentlig lesbar; bare
-- administratorer skriver.
create policy nwc_public_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-media' and app.is_staff());

create policy nwc_public_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'public-media' and app.is_staff())
  with check (bucket_id = 'public-media' and app.is_staff());

create policy nwc_public_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-media' and app.is_staff());

create policy nwc_public_media_select on storage.objects
  for select to authenticated
  using (bucket_id = 'public-media' and app.is_staff());

-- Delingen: bildene kan slettes av den som kan laste opp.
create policy ladder_state_photos_delete on public.ladder_state_photos
  for delete to authenticated
  using (
    exists (
      select 1 from public.ladder_state_shares s
      where s.id = share_id and (app.can_access_ladder(s.ladder_id) or app.is_staff())
    )
  );

grant delete on public.ladder_state_photos to authenticated;

-- ── 23. Statusviewet: eierselskap og neste planlagte oppgave ────────────────
drop view public.ladder_status;

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
    l.company_id,
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
    ml.performed_at  as last_maintenance_at,
    l.service_interval_months,
    c.name           as company_name,
    tk.next_task_due,
    tk.open_tasks,
    bk.scheduled_date as booked_service_date
  from public.ladders l
  join public.products p on p.id = l.product_id
  left join public.vessels v on v.id = l.vessel_id
  left join public.companies c on c.id = l.company_id
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
) base;

comment on view public.ladder_status is
  'Beregnet status per leider. Kilden til neste service for dashboard, PDF og paminnelser.';

grant select on public.ladder_status to authenticated;
