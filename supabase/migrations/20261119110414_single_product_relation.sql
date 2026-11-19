-- Én relasjon per tabellpar mot products.
--
-- portal_v3 la cabinet_product_id med fremmednøkkel til products på både
-- order_lines og production_jobs. Da finnes det to relasjoner mellom
-- order_lines og products, og API-et (PostgREST) nekter å gjette hvilken som
-- menes i «order_lines(…, products(…))» – oppslaget feiler med PGRST201.
-- Det traff sidene som viser bestillinger.
--
-- Kolonnene beholdes; bare fremmednøklene fjernes. Verdien settes kun av
-- place_order() og confirm_order(), som selv slår opp et aktivt skap.
alter table public.order_lines
  drop constraint order_lines_cabinet_product_id_fkey;

alter table public.production_jobs
  drop constraint production_jobs_cabinet_product_id_fkey;
