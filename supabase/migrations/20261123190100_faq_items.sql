-- ============================================================================
-- Spørsmål og svar (FAQ) redigeres i admin
-- ============================================================================
-- Lå før i ordbøkene i koden. Rekkefølgen her er rekkefølgen på /faq, og de
-- fire første vises også på forsiden. Administrator og media styrer lista.
create table public.faq_items (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'product'
              check (category in ('product', 'certification', 'installation', 'delivery')),
  question_no text not null check (length(btrim(question_no)) between 3 and 300),
  answer_no   text not null check (length(btrim(answer_no)) between 2 and 4000),
  question_en text check (question_en is null or length(question_en) <= 300),
  answer_en   text check (answer_en is null or length(answer_en) <= 4000),
  sort_order  integer not null default 0,
  published   boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index faq_items_order_idx on public.faq_items (sort_order, created_at);

create trigger faq_items_set_updated_at
  before update on public.faq_items
  for each row execute function public.set_updated_at();

alter table public.faq_items enable row level security;

create policy faq_items_read on public.faq_items
  for select to anon, authenticated
  using (published or app.is_media());

create policy faq_items_manage on public.faq_items
  for all to authenticated
  using (app.is_media()) with check (app.is_media());

grant select on public.faq_items to anon, authenticated;
grant insert, update, delete on public.faq_items to authenticated;

-- Spørsmålene som sto i koden, i samme rekkefølge og med samme tekst
-- (merkenavnet skrevet «NorthWestCoast»).
insert into public.faq_items (category, sort_order, question_no, answer_no, question_en, answer_en, created_by) values
('certification', 10,
 'Er stigen godkjent for norske skip?',
 'Ja, Argostep Entrings- og Livbåtleider er testet og godkjent etter ISO 799-1:2019 og godkjent av Sjøfartsdirektoratet for norske fartøy.',
 'Is the ladder approved for Norwegian ships?',
 'Yes. The Argostep embarkation and lifeboat ladder is tested and certified to ISO 799-1:2019 and approved by the Norwegian Maritime Authority for Norwegian vessels.',
 null),
('product', 20,
 'Hvilke lengder er tilgjengelige?',
 'Argostep Livbåtleider leveres som standard lengder fra 2 - 15 meter. Ta kontakt ved andre behov så skreddersyr vi en pakke for deg.',
 'Which lengths are available?',
 'The Argostep Lifeboat Ladder comes in standard lengths from 2 to 15 metres. Get in touch if you need something else and we will put together a package for you.',
 null),
('product', 30,
 'Hvor lenge varer en leider?',
 'Designet for lang levetid med utskiftbare komponenter. Ved oppbevaring i skap fra NorthWestCoast vil levetiden øke betraktlig.',
 'How long does a ladder last?',
 'It is designed for a long service life with replaceable components. Storing it in a cabinet from NorthWestCoast increases that life considerably.',
 null),
('installation', 40,
 'Hvordan monterer jeg leideren?',
 'Argostep er designet for enkel montering og demontering uten spesialverktøy. Leideren monteres på samme måte som den tradisjonelle leideren.',
 'How do I mount the ladder?',
 'Argostep is designed for easy mounting and dismounting without special tools. The ladder is mounted the same way as a traditional ladder.',
 null),
('delivery', 50,
 'Hva er leveringstiden for Argostep?',
 'Leveringstiden varierer avhengig av spesifikasjoner. Kontakt oss for et nøyaktig tilbud og estimert leveringstid for ditt fartøy.',
 'What is the delivery time for Argostep?',
 'Delivery time varies with the specification. Contact us for an exact quote and an estimated delivery time for your vessel.',
 null),
('product', 60,
 'Av hvilket materiale er leideren laget?',
 'Trinnene og festene er laget av sprøytestøpt glassfiberarmert plast – et materiale som kombinerer lav vekt, høy styrke og utmerket korrosjonsbestandighet i saltvannsmiljø.',
 'What material is the ladder made of?',
 'The steps and fittings are injection-moulded glass-fibre reinforced plastic – a material that combines low weight, high strength and excellent corrosion resistance in saltwater environments.',
 null),
('product', 70,
 'Hva veier en standard Argostep?',
 'Alle vektene for Argostep leider finner du under Bestill nå.',
 'What does a standard Argostep weigh?',
 'You will find all the weights for the Argostep ladder under Order now.',
 null),
('installation', 80,
 'Kan jeg montere leideren selv?',
 'Ja, Argostep er konstruert for selvmontering. Medfølgende monteringsveiledning og klikk-koblingssystemet gjør det mulig å montere leideren uten fagfolk.',
 'Can I mount the ladder myself?',
 'Yes, Argostep is built for self-installation. The included mounting instructions and the click coupling system make it possible to mount the ladder without a professional.',
 null),
('delivery', 90,
 'Tilbyr dere reservedeler og service?',
 'Ja. Et av hovedfordelene med Argostep er det modulære systemet – enkelttrinn og komponenter kan bestilles separat. Kontakt oss for reservedeler eller serviceavtale.',
 'Do you offer spare parts and service?',
 'Yes. One of the main advantages of Argostep is the modular system – individual steps and components can be ordered separately. Contact us for spare parts or a service agreement.',
 null);
