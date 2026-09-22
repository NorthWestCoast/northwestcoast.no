-- ============================================================================
-- Kjerneskjema: selskap, medlemmer, invitasjoner, fartøy.
--
-- Designnotater:
--  * org.nr og IMO lagres normalisert (kun siffer). Validering skjer i
--    databasen, ikke bare i skjemaet – feil IMO betyr feil fartøy på
--    los-siden, og det er en sikkerhetssak, ikke en skjønnhetsfeil.
--  * IMO er NULLABLE med vilje: fiskefartøy under 15 m har ofte ikke IMO.
--  * Invitasjoner ligger i egen tabell fordi personen ikke finnes i
--    auth.users før hun logger inn første gang.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ── Hjelpefunksjoner ────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Norsk organisasjonsnummer: 9 siffer med MOD11-kontrollsiffer.
create or replace function public.is_valid_org_number(value text)
returns boolean
language sql
immutable
as $$
  select case
    when value is null then true
    when value !~ '^\d{9}$' then false
    else (
      11 - (
        ( substr(value,1,1)::int * 3
        + substr(value,2,1)::int * 2
        + substr(value,3,1)::int * 7
        + substr(value,4,1)::int * 6
        + substr(value,5,1)::int * 5
        + substr(value,6,1)::int * 4
        + substr(value,7,1)::int * 3
        + substr(value,8,1)::int * 2
        ) % 11
      )
    ) % 11 = substr(value,9,1)::int
  end;
$$;

-- IMO-nummer: 7 siffer der siste er kontrollsiffer (vekt 7,6,5,4,3,2).
-- Fanger opp tastefeil før de havner på en los-delingsside.
create or replace function public.is_valid_imo(value text)
returns boolean
language sql
immutable
as $$
  select case
    when value is null then true
    when value !~ '^\d{7}$' then false
    else (
      ( substr(value,1,1)::int * 7
      + substr(value,2,1)::int * 6
      + substr(value,3,1)::int * 5
      + substr(value,4,1)::int * 4
      + substr(value,5,1)::int * 3
      + substr(value,6,1)::int * 2
      ) % 10
    ) = substr(value,7,1)::int
  end;
$$;

-- ── Selskap (rederi) ────────────────────────────────────────────────────────

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  org_number  text unique check (public.is_valid_org_number(org_number)),
  address     text,
  postal_code text,
  city        text,
  country     text not null default 'NO',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

comment on column public.companies.org_number is
  'Normalisert til 9 siffer uten mellomrom. Valideres med MOD11.';

-- ── Medlemmer og invitasjoner ───────────────────────────────────────────────

create type public.company_role as enum ('owner', 'admin', 'member');

create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.company_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index company_members_user_idx on public.company_members (user_id);

create table public.company_invitations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  email       citext not null,
  role        public.company_role not null default 'member',
  invited_by  uuid references auth.users(id) on delete set null,
  expires_at  timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (company_id, email)
);

create index company_invitations_email_idx
  on public.company_invitations (email)
  where accepted_at is null;

-- ── Fartøy ──────────────────────────────────────────────────────────────────

create table public.vessels (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  imo         text check (public.is_valid_imo(imo)),
  call_sign   text,
  mmsi        text check (mmsi is null or mmsi ~ '^\d{9}$'),
  vessel_type text,
  home_port   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger vessels_set_updated_at
  before update on public.vessels
  for each row execute function public.set_updated_at();

create index vessels_company_idx on public.vessels (company_id);
create unique index vessels_imo_key on public.vessels (imo) where imo is not null;

comment on column public.vessels.imo is
  'Nullable med vilje – fartøy under 15 m har ofte ikke IMO-nummer.';

create type public.vessel_role as enum ('master', 'crew', 'viewer');

create table public.vessel_members (
  vessel_id  uuid not null references public.vessels(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.vessel_role not null default 'crew',
  created_at timestamptz not null default now(),
  primary key (vessel_id, user_id)
);

create index vessel_members_user_idx on public.vessel_members (user_id);
