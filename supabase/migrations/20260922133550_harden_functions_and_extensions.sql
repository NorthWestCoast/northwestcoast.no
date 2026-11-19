-- ============================================================================
-- Herding etter Supabase sin security advisor.
--
-- 1) RLS-hjelpefunksjonene flyttes ut av public.
--    PostgREST eksponerer kun public-skjemaet, så en SECURITY DEFINER-funksjon
--    i public er kallbar som /rest/v1/rpc/<navn>. Funksjonene lekker i seg selv
--    ingenting (de svarer bare på "hva har JEG tilgang til"), men RPC-flaten er
--    unødvendig. I skjemaet 'app' er de usynlige for API-et, mens RLS-policyene
--    fortsatt kan kalle dem – policyavhengigheter følger funksjonens OID.
--
-- 2) search_path pinnes på alle funksjoner, så de ikke kan kapres av en
--    manipulert search_path.
--
-- 3) citext flyttes til extensions-skjemaet, som er Supabase-konvensjonen.
--    Kolonnene peker på type-OID og påvirkes ikke.
-- ============================================================================

create schema if not exists app;
grant usage on schema app to authenticated;

alter function public.auth_company_ids()      set schema app;
alter function public.is_company_admin(uuid)  set schema app;
alter function public.can_access_ladder(uuid) set schema app;
alter function public.is_staff()              set schema app;

alter function app.is_staff() set search_path = '';

alter function public.set_updated_at()              set search_path = '';
alter function public.is_valid_org_number(text)     set search_path = '';
alter function public.is_valid_imo(text)            set search_path = '';
alter function public.next_order_number()           set search_path = '';
alter function public.purge_expired_shares(integer) set search_path = public, pg_temp;

alter extension citext set schema extensions;
