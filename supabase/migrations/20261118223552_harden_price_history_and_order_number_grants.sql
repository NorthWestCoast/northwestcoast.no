-- Stram inn rettigheter som ble stående med Supabases standardverdier.
--
-- 1) product_price_history ble opprettet etter at «revoke all»-trinnet i
--    storage_buckets_and_grants hadde kjørt, og fikk derfor alle rettigheter
--    for anon og authenticated. RLS stopper lesing og skriving, men TRUNCATE
--    styres ikke av RLS. Revisjonsloggen skal bare kunne leses, og bare av
--    ansatte (policyen krever app.is_staff()).
revoke all on public.product_price_history from anon, authenticated;
grant select on public.product_price_history to authenticated;

-- 2) next_order_number() var kallbar for alle som
--    /rest/v1/rpc/next_order_number. Det avslører hvor mange bestillinger som
--    finnes og lar hvem som helst brenne ordrenumre. Bestillinger opprettes
--    bare av service-role (app/api/order), så ingen andre trenger den.
revoke execute on function public.next_order_number() from public, anon, authenticated;
grant execute on function public.next_order_number() to service_role;
revoke all on sequence public.order_number_seq from anon;
