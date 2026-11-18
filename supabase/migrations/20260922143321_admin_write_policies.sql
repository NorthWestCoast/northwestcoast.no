-- ============================================================================
-- Manglende skrivepolicyer for admin-arbeidet.
--
-- Fase 0 ga selskaper kun SELECT og UPDATE, og vedlikeholdslogger kun INSERT
-- og SELECT. Det betyr at NWC verken kunne opprette en ny kunde eller koble
-- en innsendt rapport med ukjent serienummer til riktig leider – nettopp de
-- to operasjonene admin-verktøyet finnes for.
--
-- Admin skriver gjennom sin EGEN sesjon, ikke service-role. RLS er dermed
-- fortsatt autorisasjonslaget, og staff-rollen må bevises i JWT-en.
-- ============================================================================

create policy companies_insert on public.companies
  for insert to authenticated
  with check (app.is_staff());

grant insert on public.companies to authenticated;

-- Kobling av uparede vedlikeholdsrapporter: ladder_id og vessel_id settes
-- i ettertid når NWC finner ut hvilken leider rapporten gjelder.
create policy maintenance_logs_update on public.maintenance_logs
  for update to authenticated
  using (app.is_staff())
  with check (app.is_staff());

grant update on public.maintenance_logs to authenticated;

-- Sletting av selskap er bevisst ikke tillatt gjennom API-et. Et selskap med
-- fartøy og servicehistorikk skal ikke kunne forsvinne med ett klikk; det
-- gjøres eventuelt manuelt i Supabase.
