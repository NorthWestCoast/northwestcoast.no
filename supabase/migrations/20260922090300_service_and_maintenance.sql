-- ============================================================================
-- Service og vedlikehold.
--
-- Bevisst to tabeller, ikke én:
--  * service_reports  – utført av NWC eller godkjent partner. Har resultat
--                       (ok / med anmerkning / ikke godkjent) og neste frist.
--                       Dette er det som teller ved tilsyn.
--  * maintenance_logs – mannskapets egenrapportering fra /vedlikehold.
--
-- Slår man disse sammen blir compliance-PDF-en meningsløs: man kan ikke se
-- forskjell på "en fagperson har godkjent leideren" og "noen om bord skrev
-- at den ser fin ut".
-- ============================================================================

create type public.service_result as enum ('ok', 'ok_with_remarks', 'failed');

create table public.service_reports (
  id                 uuid primary key default gen_random_uuid(),
  ladder_id          uuid not null references public.ladders(id) on delete cascade,
  performed_at       date not null,
  performed_by       text not null,
  technician_user_id uuid references auth.users(id) on delete set null,
  findings           text,
  parts_replaced     jsonb not null default '[]'::jsonb,
  result             public.service_result not null,
  next_service_due   date,
  report_path        text, -- sti i storage-bøtta 'service-reports'
  created_at         timestamptz not null default now(),

  constraint service_reports_due_after_performed
    check (next_service_due is null or next_service_due >= performed_at)
);

create index service_reports_ladder_idx
  on public.service_reports (ladder_id, performed_at desc);

-- ── Mannskapets vedlikeholdslogg ────────────────────────────────────────────

create table public.maintenance_logs (
  id                  uuid primary key default gen_random_uuid(),
  ladder_id           uuid references public.ladders(id) on delete set null,
  vessel_id           uuid references public.vessels(id) on delete set null,

  -- Det offentlige skjemaet lar hvem som helst skrive inn et serienummer som
  -- kanskje ikke finnes. Vi tar vare på det de faktisk skrev, slik at en
  -- innsending aldri går tapt bare fordi oppslaget bommet.
  serial_number_raw   text,
  vessel_name_raw     text,
  imo_raw             text,

  reported_by_user_id uuid references auth.users(id) on delete set null,
  reporter_name       text,
  reporter_email      citext,
  performed_at        date not null default current_date,
  notes               text,
  source              text not null default 'web',
  created_at          timestamptz not null default now()
);

create index maintenance_logs_ladder_idx
  on public.maintenance_logs (ladder_id, performed_at desc);
create index maintenance_logs_vessel_idx on public.maintenance_logs (vessel_id);
-- Uparede innsendinger – NWC må kunne finne og koble disse manuelt.
create index maintenance_logs_unmatched_idx
  on public.maintenance_logs (created_at desc)
  where ladder_id is null;

create table public.maintenance_photos (
  id                  uuid primary key default gen_random_uuid(),
  maintenance_log_id  uuid not null
    references public.maintenance_logs(id) on delete cascade,
  storage_path        text not null,
  -- captured_at ≠ uploaded_at: mannskap fotograferer kl. 14 og laster opp
  -- kl. 22 når de får dekning. Tidspunktet som betyr noe er når bildet ble tatt.
  captured_at         timestamptz,
  uploaded_at         timestamptz not null default now(),
  caption             text
);

create index maintenance_photos_log_idx
  on public.maintenance_photos (maintenance_log_id);
