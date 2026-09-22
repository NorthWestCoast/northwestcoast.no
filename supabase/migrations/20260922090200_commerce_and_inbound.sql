-- ============================================================================
-- Bestillinger, leveranser og innkommende skjemaer.
--
-- Kjernepoenget i fase 0: raden skrives FØR e-posten sendes. Tidligere var
-- e-posten selve databasen – feilet Resend, var bestillingen borte. Nå er
-- e-post et varsel som kan sendes på nytt.
-- ============================================================================

create type public.order_status as enum
  ('new', 'quoted', 'confirmed', 'in_production', 'delivered', 'cancelled');

create sequence public.order_number_seq;

create or replace function public.next_order_number()
returns text
language sql
volatile
as $$
  select 'NWC-' || to_char(now(), 'YYYY') || '-'
         || lpad(nextval('public.order_number_seq')::text, 4, '0');
$$;

create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  text not null unique default public.next_order_number(),
  company_id    uuid references public.companies(id) on delete set null,
  contact_name  text not null,
  contact_email citext not null,
  contact_phone text,
  vessel_name   text,
  notes         text,
  -- Snapshot av totalen slik den ble regnet ut på serveren da bestillingen kom.
  total_nok     integer not null check (total_nok >= 0),
  status        public.order_status not null default 'new',
  source        text not null default 'web',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create index orders_company_idx on public.orders (company_id);
create index orders_created_idx on public.orders (created_at desc);

create table public.order_lines (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  product_id         uuid not null references public.products(id),
  qty                integer not null check (qty > 0),
  with_cabinet       boolean not null default false,
  -- Prisene fryses på ordretidspunktet. Prislista endrer seg; historiske
  -- ordrer skal ikke endre seg med den.
  unit_price_nok     integer not null check (unit_price_nok >= 0),
  cabinet_price_nok  integer not null default 0 check (cabinet_price_nok >= 0),
  line_total_nok     integer not null check (line_total_nok >= 0)
);

create index order_lines_order_idx on public.order_lines (order_id);

create table public.deliveries (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  shipped_at         date,
  delivered_at       date,
  carrier            text,
  tracking_reference text,
  notes              text,
  created_at         timestamptz not null default now()
);

create index deliveries_order_idx on public.deliveries (order_id);

-- ── Innkommende skjemaer ────────────────────────────────────────────────────

create table public.contact_requests (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        citext not null,
  phone        text,
  company_name text,
  product      text,
  message      text,
  source       text not null default 'web',
  handled_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index contact_requests_created_idx on public.contact_requests (created_at desc);

create table public.newsletter_subscribers (
  id             uuid primary key default gen_random_uuid(),
  email          citext not null unique,
  source         text not null default 'web',
  unsubscribed_at timestamptz,
  created_at     timestamptz not null default now()
);

-- ── E-postlogg ──────────────────────────────────────────────────────────────
-- Hver utsending logges. Gir oss (a) feilsøking, (b) grunnlag for retry, og
-- (c) mulighet til å bytte leverandør uten å miste historikken.

create type public.email_status as enum ('queued', 'sent', 'failed');

create table public.email_log (
  id                  uuid primary key default gen_random_uuid(),
  to_email            citext not null,
  template            text not null,
  provider            text not null,
  provider_message_id text,
  status              public.email_status not null default 'queued',
  error               text,
  attempts            integer not null default 0,
  related_type        text,
  related_id          uuid,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz
);

create index email_log_status_idx on public.email_log (status, created_at)
  where status <> 'sent';
create index email_log_related_idx on public.email_log (related_type, related_id);
