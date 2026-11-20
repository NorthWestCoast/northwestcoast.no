-- Fjerner demodataene fra supabase/seed/demo.sql.
-- Lageret først: bevegelsene må bort før varene de gjelder.
delete from public.stock_movements where item_id::text like '0d000000-0000-4000-8000-%';
delete from public.product_components where item_id::text like '0d000000-0000-4000-8000-%';
delete from public.purchase_orders where id::text like '0d000000-0000-4000-8000-%';
delete from public.stock_items where id::text like '0d000000-0000-4000-8000-%';
delete from public.suppliers where id::text like '0d000000-0000-4000-8000-%';
delete from public.deliveries where order_id in (select id from public.orders where id::text like '0d000000-0000-4000-8000-%');
delete from public.production_jobs where id::text like '0d000000-0000-4000-8000-%';
delete from public.orders where id::text like '0d000000-0000-4000-8000-%';
delete from public.support_tickets where company_id = '0d000000-0000-4000-8000-000000000001';
delete from public.cabinets where id::text like '0d000000-0000-4000-8000-%';
delete from public.ladders where id::text like '0d000000-0000-4000-8000-%';
delete from public.contact_requests where email = 'nina@demo.invalid';
delete from public.companies where id = '0d000000-0000-4000-8000-000000000001';
