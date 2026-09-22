-- ============================================================================
-- Produktkatalog og fysiske leidere.
--
-- `products` overtar som fasit for prislista (erstatter lib/pricing.ts som
-- kilde). `ladders` er den serialiserte fysiske enheten og ryggraden i hele
-- systemet: service, vedlikehold og los-deling henger alle av den.
-- ============================================================================

create type public.product_kind as enum ('ladder', 'cabinet', 'spare_part');

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  product_number  text not null unique,
  name            text not null,
  kind            public.product_kind not null,
  length_m        numeric(4,1),
  steps           integer check (steps is null or steps > 0),
  price_nok       integer not null check (price_nok >= 0),
  -- Hvilket skap som passer til denne leideren (kun for kind = 'ladder').
  cabinet_product_id uuid references public.products(id) on delete set null,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

comment on column public.products.price_nok is
  'Hele kroner eks. mva. Heltall – ingen ører i denne katalogen.';

-- ── Fysiske leidere ─────────────────────────────────────────────────────────

create type public.ladder_lifecycle_status as enum
  ('in_production', 'delivered', 'installed', 'retired');

create table public.ladders (
  id          uuid primary key default gen_random_uuid(),
  serial_number text not null unique,

  -- Kortkode til QR-klistremerke. Egen kolonne fordi:
  --  1) allerede leverte leidere kan mangle preget serienummer, og må kunne
  --     ettermerkes uten å finne på et serienummer;
  --  2) serienummeret bør ikke ligge i URL-er som deles utenfor selskapet.
  public_code text unique check (public_code is null or public_code ~ '^[A-Z0-9]{6,12}$'),

  product_id  uuid not null references public.products(id),
  produced_at date,
  vessel_id   uuid references public.vessels(id) on delete set null,
  installed_at date,
  status      public.ladder_lifecycle_status not null default 'in_production',
  service_interval_months integer not null default 12
    check (service_interval_months between 1 and 120),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- En installert leider må høre til et fartøy.
  constraint ladders_installed_needs_vessel
    check (status <> 'installed' or vessel_id is not null)
);

create trigger ladders_set_updated_at
  before update on public.ladders
  for each row execute function public.set_updated_at();

create index ladders_vessel_idx on public.ladders (vessel_id);
create index ladders_product_idx on public.ladders (product_id);

comment on column public.ladders.public_code is
  'Kortkode for QR-merking. Brukes i interne URL-er i stedet for serienummer.';

-- ── Seed: prislista slik den står i lib/pricing.ts ───────────────────────────
--
-- MERK – avvik i kildedata: kolonnen cabinetNumber i lib/pricing.ts er
-- inkonsistent. Samme nummer brukes på ulike skapmodeller (400-062 er både
-- ASC-LC3-5 og ASC-LC6-8; 400-063 er ASC-LC3-5, ASC-LC6-8 og ASC-LC9-10).
-- Skapmodell og pris henger derimot konsistent sammen. Skapene seedes derfor
-- på modellnavn, og de offisielle 400-0xx-numrene må avklares med NWC før de
-- legges inn. Leidernumrene (400-031..400-043) er unike og beholdes som de er.

insert into public.products (product_number, name, kind, length_m, price_nok) values
  ('ASC-LC3-5',   'Oppbevaringsskap ASC-LC3-5',   'cabinet', null,  9000),
  ('ASC-LC5-6',   'Oppbevaringsskap ASC-LC5-6',   'cabinet', null,  9500),
  ('ASC-LC6-8',   'Oppbevaringsskap ASC-LC6-8',   'cabinet', null, 10000),
  ('ASC-LC9-10',  'Oppbevaringsskap ASC-LC9-10',  'cabinet', null, 11000),
  ('ASC-LC11-16', 'Oppbevaringsskap ASC-LC11-16', 'cabinet', null, 12000);

insert into public.products
  (product_number, name, kind, length_m, steps, price_nok, cabinet_product_id)
select v.product_number, v.name, 'ladder', v.length_m, v.steps, v.price_nok, c.id
from (values
  ('400-031', 'Argostep – 3ML',  3.0, 10,  9499, 'ASC-LC3-5'),
  ('400-032', 'Argostep – 4ML',  4.0, 13, 10999, 'ASC-LC3-5'),
  ('400-033', 'Argostep – 5ML',  5.0, 16, 12499, 'ASC-LC3-5'),
  ('400-034', 'Argostep – 6ML',  6.0, 19, 13999, 'ASC-LC5-6'),
  ('400-035', 'Argostep – 7ML',  7.0, 22, 15499, 'ASC-LC6-8'),
  ('400-036', 'Argostep – 8ML',  8.0, 25, 16999, 'ASC-LC6-8'),
  ('400-037', 'Argostep – 9ML',  9.0, 28, 18099, 'ASC-LC9-10'),
  ('400-038', 'Argostep – 10ML', 10.0, 31, 20699, 'ASC-LC9-10'),
  ('400-039', 'Argostep – 11ML', 11.0, 34, 23499, 'ASC-LC11-16'),
  ('400-040', 'Argostep – 12ML', 12.0, 37, 25999, 'ASC-LC11-16'),
  ('400-041', 'Argostep – 13ML', 13.0, 40, 27499, 'ASC-LC11-16'),
  ('400-042', 'Argostep – 14ML', 14.0, 43, 28999, 'ASC-LC11-16'),
  ('400-043', 'Argostep – 15ML', 15.0, 46, 30599, 'ASC-LC11-16')
) as v(product_number, name, length_m, steps, price_nok, cabinet_number)
join public.products c on c.product_number = v.cabinet_number;
