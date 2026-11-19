-- Demodata: ett rederi med fartøy, leidere, historikk, bestillinger og en sak.
--
-- Alt er merket «Demo» og henger på ett selskap, så det kan fjernes igjen med
-- supabase/seed/remove-demo.sql. Inneholder ingen brukere og ingen offentlig
-- synlig tekst. Kan kjøres flere ganger (gjør ingenting hvis dataene finnes).
do $$
declare
  v_company uuid := '0d000000-0000-4000-8000-000000000001';
  v_havorn  uuid := '0d000000-0000-4000-8000-000000000011';
  v_fjord   uuid := '0d000000-0000-4000-8000-000000000012';
  l1 uuid := '0d000000-0000-4000-8000-000000000021';
  l2 uuid := '0d000000-0000-4000-8000-000000000022';
  l3 uuid := '0d000000-0000-4000-8000-000000000023';
  l4 uuid := '0d000000-0000-4000-8000-000000000024';
  o_new  uuid := '0d000000-0000-4000-8000-000000000031';
  o_prod uuid := '0d000000-0000-4000-8000-000000000032';
  o_done uuid := '0d000000-0000-4000-8000-000000000033';
  j_prod uuid := '0d000000-0000-4000-8000-000000000041';
  j_done uuid := '0d000000-0000-4000-8000-000000000042';
  p4 record; p6 record; p8 record; p9 record;
  cab8 record;
  v_line uuid;
  v_ticket uuid;
begin
  if exists (select 1 from public.companies where id = v_company) then
    raise notice 'Demodata finnes allerede.';
    return;
  end if;

  select * into p4 from public.products where kind = 'ladder' and length_m = 4;
  select * into p6 from public.products where kind = 'ladder' and length_m = 6;
  select * into p8 from public.products where kind = 'ladder' and length_m = 8;
  select * into p9 from public.products where kind = 'ladder' and length_m = 9;
  select * into cab8 from public.products where id = p8.cabinet_product_id;

  insert into public.companies (id, name, address, postal_code, city, contact_name, contact_email, contact_phone)
  values (v_company, 'Demo Rederi AS', 'Kaigata 1', '6002', 'Ålesund', 'Kari Demo', 'kari@demo.invalid', '400 00 000');

  insert into public.vessels (id, company_id, name, call_sign, vessel_type, home_port) values
    (v_havorn, v_company, 'MS Demo Havørn', 'LDEM1', 'Fiskefartøy', 'Ålesund'),
    (v_fjord,  v_company, 'MS Demo Fjordvakt', 'LDEM2', 'Arbeidsbåt', 'Fosnavåg');

  -- Leidere: én med forfalt service, én à jour, én levert men ikke montert.
  insert into public.ladders (id, serial_number, product_id, produced_at, vessel_id, installed_at, status, company_id) values
    (l1, 'DEMO-2025-0001', p6.id, current_date - 430, v_havorn, current_date - 400, 'installed', v_company),
    (l2, 'DEMO-2026-0002', p9.id, current_date - 140, v_fjord,  current_date - 120, 'installed', v_company),
    (l3, 'DEMO-2026-0003', p4.id, current_date - 20,  null,     null,               'delivered', v_company);

  insert into public.service_reports (ladder_id, performed_at, performed_by, findings, result, next_service_due) values
    (l2, current_date - 30, 'NorthWest Coast AS', 'Ingen anmerkninger. Trinn og sidetau kontrollert.', 'ok', current_date + 335);

  insert into public.maintenance_logs
    (ladder_id, vessel_id, serial_number_raw, vessel_name_raw, reporter_name, performed_at, notes, source, kind, title) values
    (l1, v_havorn, 'DEMO-2025-0001', 'MS Demo Havørn', 'Ola Mannskap', current_date - 200, 'Skylt med ferskvann, kontrollert festepunkt.', 'portal', 'maintenance', 'Rengjøring og kontroll'),
    (l1, v_havorn, 'DEMO-2025-0001', 'MS Demo Havørn', 'Ola Mannskap', current_date - 45,  'Brukt ved losbording, ingen avvik.', 'portal', 'usage', 'Losbording'),
    (l1, v_havorn, 'DEMO-2025-0001', 'MS Demo Havørn', 'Kari Demo',    current_date - 10,  'Slitasje på nederste trinn. Følges opp ved neste service.', 'portal', 'inspection', 'Egenkontroll'),
    (l2, v_fjord,  'DEMO-2026-0002', 'MS Demo Fjordvakt', 'Per Skipper', current_date - 60, 'Belastet og kontrollert etter montering.', 'portal', 'test', 'Funksjonstest'),
    (l2, v_fjord,  'DEMO-2026-0002', 'MS Demo Fjordvakt', 'Per Skipper', current_date - 5,  null, 'portal', 'inspection', 'Kontroll før bruk');

  insert into public.ladder_tasks (ladder_id, kind, title, description, due_date, recurrence_months, created_by) values
    (l1, 'inspection', 'Halvårlig egenkontroll', 'Trinn, sidetau og festepunkt.', current_date + 12, 6, null),
    (l1, 'repair', 'Bytt nederste trinn', 'Meldt ved egenkontroll.', current_date + 25, null, null),
    (l2, 'inspection', 'Halvårlig egenkontroll', 'Trinn, sidetau og festepunkt.', current_date + 60, 6, null);

  insert into public.service_bookings (ladder_id, requester_name, preferred_date, location, notes, status)
  values (l1, 'Kari Demo', current_date + 14, 'Ålesund, Skansekaia', 'Ligger til kai uke 2 og 3.', 'requested');

  insert into public.service_agreements (company_id, title, starts_on, ends_on, interval_months, price_nok, covers, status)
  values (v_company, 'Serviceavtale 2026', date_trunc('year', current_date)::date,
          (date_trunc('year', current_date) + interval '1 year - 1 day')::date, 12, 4500,
          'Årlig kontroll av alle leidere, inkludert rapport.', 'active');

  -- 1) Ny bestilling fra nettsiden, ikke behandlet.
  insert into public.orders (id, contact_name, contact_email, contact_phone, vessel_name, notes, total_nok, source, status, created_at)
  values (o_new, 'Ola Demo', 'ola@demo.invalid', '411 11 111', 'MS Demo Nordlys',
          'Ønsker levering før sesongstart.', p8.price_nok + coalesce(cab8.price_nok, 0), 'web', 'new', now() - interval '3 hours');
  insert into public.order_lines (order_id, product_id, qty, with_cabinet, unit_price_nok, cabinet_price_nok, line_total_nok)
  values (o_new, p8.id, 1, cab8.id is not null, p8.price_nok, coalesce(cab8.price_nok, 0), p8.price_nok + coalesce(cab8.price_nok, 0));

  -- 2) Bestilling i produksjon.
  insert into public.orders (id, company_id, contact_name, contact_email, vessel_name, total_nok, source, status, confirmed_at, expected_delivery, created_at)
  values (o_prod, v_company, 'Kari Demo', 'kari@demo.invalid', 'MS Demo Havørn', p9.price_nok, 'portal',
          'in_production', now() - interval '6 days', current_date + 10, now() - interval '8 days');
  insert into public.order_lines (order_id, product_id, qty, unit_price_nok, line_total_nok)
  values (o_prod, p9.id, 1, p9.price_nok, p9.price_nok) returning id into v_line;

  insert into public.ladders (id, serial_number, product_id, status, company_id)
  values (l4, 'DEMO-2026-0004', p9.id, 'in_production', v_company);

  insert into public.production_jobs
    (id, order_id, order_line_id, product_id, ladder_id, serial_number, product_name, product_number,
     length_m, steps, with_cabinet, order_number, customer_label, vessel_name, status, due_date, started_at)
  select j_prod, o_prod, v_line, p9.id, l4, 'DEMO-2026-0004', p9.name, p9.product_number,
         p9.length_m, p9.steps, false, o.order_number, 'Demo Rederi AS', 'MS Demo Havørn',
         'in_progress', current_date + 8, now() - interval '5 days'
  from public.orders o where o.id = o_prod;

  update public.production_job_steps
     set done_at = now() - make_interval(days => 5 - position), done_by_name = 'Produksjon (demo)'
   where job_id = j_prod and position <= 4;

  -- 3) Levert bestilling.
  insert into public.orders (id, company_id, contact_name, contact_email, total_nok, source, status, confirmed_at, created_at)
  values (o_done, v_company, 'Kari Demo', 'kari@demo.invalid', p4.price_nok, 'portal', 'delivered',
          now() - interval '40 days', now() - interval '45 days');
  insert into public.order_lines (order_id, product_id, qty, unit_price_nok, line_total_nok)
  values (o_done, p4.id, 1, p4.price_nok, p4.price_nok) returning id into v_line;

  insert into public.production_jobs
    (id, order_id, order_line_id, product_id, ladder_id, serial_number, product_name, product_number,
     length_m, steps, with_cabinet, order_number, customer_label, status, started_at, completed_at, shipped_at, delivered_at)
  select j_done, o_done, v_line, p4.id, l3, 'DEMO-2026-0003', p4.name, p4.product_number,
         p4.length_m, p4.steps, false, o.order_number, 'Demo Rederi AS', 'delivered',
         now() - interval '38 days', now() - interval '24 days', now() - interval '22 days', now() - interval '20 days'
  from public.orders o where o.id = o_done;

  update public.production_job_steps
     set done_at = now() - interval '24 days', done_by_name = 'Produksjon (demo)'
   where job_id = j_done;

  insert into public.deliveries (order_id, job_id, shipped_at, delivered_at, carrier, tracking_reference)
  values (o_done, j_done, current_date - 22, current_date - 20, 'Bring', 'DEMO-370000000001');

  -- En åpen sak og en henvendelse.
  insert into public.support_tickets (company_id, ladder_id, contact_name, contact_email, category, subject, status)
  values (v_company, l1, 'Kari Demo', 'kari@demo.invalid', 'spare_parts', 'Trenger nytt nederste trinn', 'open')
  returning id into v_ticket;
  insert into public.ticket_messages (ticket_id, author_name, from_staff, body)
  values (v_ticket, 'Kari Demo', false, 'Nederste trinn på leideren om bord i Havørn er slitt. Kan dere sende et nytt, og hva koster det?');

  insert into public.contact_requests (name, email, phone, company_name, product, message)
  values ('Nina Demo', 'nina@demo.invalid', '422 22 222', 'Demo Havbruk AS', 'Argostep 12 m',
          'Vi vurderer leidere til tre servicebåter. Kan dere ringe meg?');

  raise notice 'Demodata lagt inn.';
end $$;
