-- Opplasting skjer nå direkte fra nettleseren til Storage, så rapporten
-- lagres i to trinn: først teksten, så bildene. Varselet til NWC sendes når
-- bildene faktisk ligger der, og notified_at gjør den operasjonen idempotent
-- slik at et gjentatt kall ikke gir dobbelt e-post.
alter table public.maintenance_logs
  add column notified_at timestamptz;

-- Rapporter som aldri ble varslet (klienten mistet dekning midt i
-- opplastingen). Teksten er trygt lagret; en opprydningsjobb i fase 5 kan
-- plukke disse opp.
create index maintenance_logs_unnotified_idx
  on public.maintenance_logs (created_at)
  where notified_at is null;

comment on column public.maintenance_logs.notified_at is
  'Satt når varsel-e-post er sendt. Hindrer dobbeltsending ved gjentatt fullfør-kall.';
