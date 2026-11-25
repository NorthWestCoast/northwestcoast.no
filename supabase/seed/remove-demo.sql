-- Fjerner demodataene fra supabase/seed/demo.sql og demo-lager.sql.
--
-- Demoradene er merket demo = true, også de triggerne laget. Resten går med
-- når foreldreraden slettes. Lageret (bare lokalt) kjennes på id-ene, og
-- bevegelsene må bort før varene de gjelder.
delete from public.stock_movements where item_id::text like '0d000000-0000-4000-8000-%';
delete from public.product_components where item_id::text like '0d000000-0000-4000-8000-%';
delete from public.purchase_orders where id::text like '0d000000-0000-4000-8000-%';
delete from public.stock_items where id::text like '0d000000-0000-4000-8000-%';
delete from public.suppliers where id::text like '0d000000-0000-4000-8000-%';

delete from public.notifications where demo;
delete from public.deliveries where demo;
delete from public.production_jobs where demo;
delete from public.orders where demo;
delete from public.support_tickets where demo;
delete from public.contact_requests where demo;
delete from public.maintenance_logs where demo;
delete from public.cabinets where demo;
delete from public.ladders where demo;
delete from public.projects where demo;
delete from public.service_agreements where demo;
delete from public.vessels where demo;
delete from public.companies where demo;
