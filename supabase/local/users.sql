-- Testbrukere for det lokale miljøet. Kjøres ALDRI mot produksjon.
insert into auth.users (id, email, email_confirmed_at) values
  ('0e000000-0000-4000-8000-000000000001', 'admin@nwc.test', now()),
  ('0e000000-0000-4000-8000-000000000002', 'produksjon@nwc.test', now()),
  ('0e000000-0000-4000-8000-000000000003', 'kari@demo.test', now()),
  ('0e000000-0000-4000-8000-000000000004', 'mannskap@demo.test', now()),
  ('0e000000-0000-4000-8000-000000000005', 'los@demo.test', now()),
  ('0e000000-0000-4000-8000-000000000006', 'media@nwc.test', now())
on conflict (email) do nothing;

insert into public.staff_members (email, role, full_name) values
  ('admin@nwc.test', 'admin', 'Anne Admin'),
  ('produksjon@nwc.test', 'production', 'Per Produksjon'),
  ('media@nwc.test', 'media', 'Mia Media')
on conflict (email) do nothing;

insert into public.profiles (user_id, email, full_name, phone, title) values
  ('0e000000-0000-4000-8000-000000000001', 'admin@nwc.test', 'Anne Admin', null, 'Daglig leder'),
  ('0e000000-0000-4000-8000-000000000002', 'produksjon@nwc.test', 'Per Produksjon', null, 'Produksjon'),
  ('0e000000-0000-4000-8000-000000000003', 'kari@demo.test', 'Kari Demo', '400 00 000', 'Driftssjef'),
  ('0e000000-0000-4000-8000-000000000004', 'mannskap@demo.test', 'Ola Mannskap', null, 'Matros'),
  ('0e000000-0000-4000-8000-000000000006', 'media@nwc.test', 'Mia Media', null, 'Kommunikasjon')
on conflict (user_id) do nothing;

insert into public.company_members (company_id, user_id, role) values
  ('0d000000-0000-4000-8000-000000000001', '0e000000-0000-4000-8000-000000000003', 'owner')
on conflict do nothing;

insert into public.vessel_members (vessel_id, user_id, role) values
  ('0d000000-0000-4000-8000-000000000011', '0e000000-0000-4000-8000-000000000004', 'crew')
on conflict do nothing;

update public.orders set created_by = '0e000000-0000-4000-8000-000000000003'
 where company_id = '0d000000-0000-4000-8000-000000000001';
update public.support_tickets set created_by = '0e000000-0000-4000-8000-000000000003'
 where company_id = '0d000000-0000-4000-8000-000000000001';
update public.ticket_messages set author_id = '0e000000-0000-4000-8000-000000000003'
 where author_name = 'Kari Demo';

insert into public.posts (slug, title_no, title_en, excerpt_no, body_no, status, published_at, author_name) values
  ('lokal-testnyhet', 'Lokal testnyhet', 'Local test post', 'Ingress til testnyheten.',
   E'Første avsnitt med **fet** tekst og en [lenke](https://northwestcoast.no).\n\n## Mellomtittel\n\n- Punkt en\n- Punkt to',
   'published', now(), 'Anne Admin'),
  ('lokalt-utkast', 'Lokalt utkast', null, null, 'Ikke publisert.', 'draft', null, 'Anne Admin')
on conflict (slug) do nothing;
