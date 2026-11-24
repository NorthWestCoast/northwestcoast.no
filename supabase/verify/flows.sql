-- Ende-til-ende-test av tilgangsreglene og funksjonene i portalen.
--
-- Hver «bruker» simuleres slik PostgREST gjør det: rollen settes til
-- authenticated (eller anon) og JWT-en legges i request.jwt.claims. Alt kjører
-- i én transaksjon som rulles tilbake, så testen etterlater ingenting.
--
-- Kjøres av supabase/verify/run.sh mot den midlertidige databasen.
begin;

create schema t;
grant usage on schema t to public;

create function t.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;

create function t.anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;

create function t.root() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function t.ok(p_cond boolean, p_what text) returns void language plpgsql as $$
begin
  if p_cond is not true then
    raise exception 'FEILET: %', p_what;
  end if;
end $$;

grant execute on all functions in schema t to public;

do $$
declare
  a uuid; b uuid; c uuid; d uuid; e uuid; f uuid;   -- eier, utenforstående, admin, produksjon, uverifisert, invitert
  v_company uuid; v_vessel uuid; v_ladder uuid; v_job uuid; v_order jsonb; v_order2 jsonb;
  v_product uuid; v_request uuid; v_task uuid; v_log uuid; v_ticket uuid; v_booking uuid;
  v_share uuid; v_res jsonb; v_count integer; v_step record; v_failed boolean;
  v_token text := 'tok_abcdefghijklmnopqrstuvwxyz0123456789';
  -- Portal v3
  g uuid;                                             -- media
  v_cabinet_product uuid; v_order3 jsonb; v_job2 uuid; v_job3 uuid; v_ladder2 uuid;
  v_project uuid; v_cabinet uuid; v_report uuid; v_cert uuid; v_cert2 uuid;
  v_cert_token text; v_log2 uuid;
  v_token2 text := 'tok_v3_abcdefghijklmnopqrstuvwxyz012345';
begin
  -- ── Oppsett ───────────────────────────────────────────────────────────────
  insert into auth.users (email, email_confirmed_at) values ('eier@rederi.test', now()) returning id into a;
  insert into auth.users (email, email_confirmed_at) values ('los@ute.test', now()) returning id into b;
  insert into auth.users (email, email_confirmed_at) values ('Admin@nwc.test', now()) returning id into c;
  insert into auth.users (email, email_confirmed_at) values ('prod@nwc.test', now()) returning id into d;
  insert into auth.users (email, email_confirmed_at) values ('sjef@nwc.test', null) returning id into e;
  insert into auth.users (email, email_confirmed_at) values ('ny@rederi.test', now()) returning id into f;

  insert into public.staff_members (email, role) values
    ('admin@nwc.test', 'admin'), ('prod@nwc.test', 'production'), ('sjef@nwc.test', 'admin');

  select id into v_product from public.products where product_number = '400-034';

  -- ── Roller ────────────────────────────────────────────────────────────────
  perform t.login(c);
  perform t.ok(app.is_staff(), 'admin med verifisert e-post er ansatt (uavhengig av store/små bokstaver)');
  perform t.ok((public.portal_bootstrap() ->> 'staff_role') = 'admin', 'bootstrap melder admin-rollen');
  perform t.login(d);
  perform t.ok(app.is_production() and not app.is_staff(), 'produksjon er produksjon, ikke admin');
  perform public.portal_bootstrap();
  perform t.login(e);
  perform t.ok(not app.is_staff() and not app.is_production(), 'uverifisert e-post gir ingen ansattrolle');
  perform t.login(a);
  perform t.ok(not app.is_staff(), 'kunde er ikke ansatt');

  -- ── Kunde oppretter selskap og fartøy selv ────────────────────────────────
  perform public.portal_bootstrap();
  perform t.ok(exists (select 1 from public.profiles where user_id = a), 'bootstrap oppretter profil');
  v_company := public.create_my_company('Testrederi AS', '923 609 016', 'Kaia 1', '6001', 'Ålesund', '99999999');
  perform t.ok((select role from public.company_members where user_id = a and company_id = v_company) = 'owner',
               'den som oppretter selskapet blir eier');

  insert into public.vessels (company_id, name) values (v_company, 'MS Test') returning id into v_vessel;
  perform t.ok(v_vessel is not null, 'eier kan legge til fartøy i eget selskap');

  perform t.login(b);
  perform public.portal_bootstrap();
  perform t.ok(not exists (select 1 from public.companies), 'utenforstående ser ingen selskap');
  perform t.ok(not exists (select 1 from public.vessels), 'utenforstående ser ingen fartøy');

  -- ── Bestilling uten innlogging ────────────────────────────────────────────
  perform t.anon();
  v_order := public.place_order(jsonb_build_object(
    'name', 'Kari Kunde', 'email', 'kari@kunde.test', 'vessel', 'MS Anon',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_product, 'qty', 2, 'with_cabinet', true))));
  perform t.ok((v_order ->> 'total_nok')::integer = 2 * (13999 + 9500), 'prisen regnes ut fra katalogen, med skap');
  perform t.ok((v_order ->> 'order_number') like 'NWC-%', 'bestillingen får ordrenummer');

  v_failed := false;
  begin
    perform 1 from public.orders;
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'anon kan ikke lese bestillinger');

  -- ── Bestilling fra innlogget kunde, knyttet til selskapet ─────────────────
  perform t.login(a);
  v_order2 := public.place_order(jsonb_build_object(
    'name', 'Eier', 'email', 'eier@rederi.test', 'company_id', v_company, 'source', 'portal',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_product, 'qty', 1))));
  perform t.ok((select count(*) from public.orders) = 1, 'kunden ser bare sin egen bestilling');

  v_failed := false;
  begin
    perform public.confirm_order((v_order2 ->> 'id')::uuid);
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'kunde kan ikke bekrefte en bestilling');

  -- ── Admin bekrefter, produksjon kvitterer ut ──────────────────────────────
  perform t.login(c);
  perform t.ok((select count(*) from public.orders) = 2, 'admin ser alle bestillinger');
  perform t.ok((select count(*) from public.notifications where kind = 'order') = 2, 'admin er varslet om begge');
  perform t.ok(public.confirm_order((v_order2 ->> 'id')::uuid, current_date + 14) = 1, 'én jobb per leider');
  perform t.ok(public.confirm_order((v_order ->> 'id')::uuid) = 2, 'to jobber for to leidere');

  perform t.login(a);
  select id into v_job from public.production_jobs;
  perform t.ok((select count(*) from public.production_jobs) = 1, 'kunden ser bare produksjonen av egen bestilling');
  perform t.ok((select count(*) from public.production_job_steps where job_id = v_job) = 8, 'jobben får stegene fra malen');

  perform t.login(d);
  perform t.ok((select count(*) from public.production_jobs) = 3, 'produksjon ser alle jobber');
  perform t.ok(not exists (select 1 from public.companies), 'produksjon ser ikke kunderegisteret');
  perform t.ok(not exists (select 1 from public.orders), 'produksjon ser ikke bestillingene');
  perform t.ok(exists (select 1 from public.notifications where kind = 'production_new'), 'produksjon er varslet');

  v_failed := false;
  begin
    perform public.advance_job(v_job, 'shipped');
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'jobben kan ikke sendes før stegene er kvittert ut');

  for v_step in select id from public.production_job_steps where job_id = v_job order by position loop
    v_res := public.set_production_step(v_step.id, true, null);
  end loop;
  perform t.ok((v_res ->> 'status') = 'ready', 'alle steg kvittert gir status klar');

  v_ladder := public.assign_job_serial(v_job, 'nwc-2026-0001');
  perform t.ok((select serial_number from public.production_jobs where id = v_job) = 'NWC-2026-0001',
               'produksjonsnummeret lagres med store bokstaver');
  perform public.advance_job(v_job, 'shipped', 'Bring', 'SPOR123');
  perform public.advance_job(v_job, 'delivered');

  perform t.login(a);
  perform t.ok((select status from public.orders where id = (v_order2 ->> 'id')::uuid) = 'delivered',
               'bestillingen er levert når jobben er levert');
  perform t.ok((select status from public.ladders where id = v_ladder) = 'delivered',
               'kunden ser den leverte leideren (eid av selskapet)');
  perform t.ok(exists (select 1 from public.deliveries where delivered_at is not null), 'leveransen er registrert');
  perform t.ok(exists (select 1 from public.notifications where kind = 'order_delivered'), 'kunden er varslet om levering');

  -- ── Kunden monterer leideren på fartøyet ──────────────────────────────────
  perform public.install_ladder(v_ladder, v_vessel, current_date);
  perform t.ok((select service_state from public.ladder_status where ladder_id = v_ladder) = 'ok',
               'montert leider får beregnet servicefrist');

  -- ── Tilgang via produksjonsnummer ─────────────────────────────────────────
  perform t.login(b);
  perform t.ok(not exists (select 1 from public.ladders), 'utenforstående ser ikke leideren');
  perform t.ok((public.request_ladder_access('finnes-ikke-123') ->> 'status') = 'not_found', 'ukjent nummer');
  v_res := public.request_ladder_access('NWC-2026-0001', 'Jeg er los');
  perform t.ok((v_res ->> 'status') = 'requested' and (v_res ->> 'handled_by') = 'owner', 'forespørselen går til eieren');
  v_request := (v_res ->> 'request_id')::uuid;
  perform t.ok((public.request_ladder_access('nwc-2026-0001') ->> 'status') = 'pending', 'ingen dobbel forespørsel');
  perform t.ok((select serial_number from public.ladder_access_requests where id = v_request) = 'NWC-2026-0001',
               'den som spør ser hvilket nummer forespørselen gjelder');

  v_failed := false;
  begin
    perform public.decide_ladder_access(v_request, true);
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'man kan ikke godkjenne sin egen forespørsel');

  perform t.login(a);
  perform t.ok(exists (select 1 from public.notifications where kind = 'access_request'), 'eieren er varslet');
  perform t.ok(exists (select 1 from public.ladder_access_requests where id = v_request), 'eieren ser forespørselen');
  perform public.decide_ladder_access(v_request, true, 'viewer', 'Velkommen');

  perform t.login(b);
  perform t.ok((select count(*) from public.ladder_status) = 1, 'godkjent bruker ser leideren');
  perform t.ok((select vessel_name from public.ladder_status) = 'MS Test', 'og fartøyet den står på');
  perform t.ok(not exists (select 1 from public.companies), 'men fortsatt ikke selskapet');
  perform t.ok(exists (select 1 from public.notifications where kind = 'access_granted'), 'og er varslet om tilgangen');

  -- ── Logg og oppgaver ──────────────────────────────────────────────────────
  insert into public.maintenance_logs (ladder_id, reported_by_user_id, reporter_name, kind, title, source)
  values (v_ladder, b, 'Los', 'inspection', 'Kontroll før bruk', 'portal');

  v_failed := false;
  begin
    insert into public.maintenance_logs (ladder_id, reported_by_user_id, kind, source)
    values (v_ladder, a, 'inspection', 'portal');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'man kan ikke loggføre i en annens navn');

  perform t.login(a);
  perform t.ok(exists (select 1 from public.notifications where kind = 'log_entry'), 'eieren varsles om loggføringen');
  insert into public.ladder_tasks (ladder_id, kind, title, due_date, recurrence_months)
  values (v_ladder, 'inspection', 'Halvårlig egenkontroll', current_date + 10, 6) returning id into v_task;

  perform t.login(b);
  v_log := public.complete_ladder_task(v_task, 'Alt i orden', current_date);
  perform t.ok((select status from public.ladder_tasks where id = v_task) = 'done', 'oppgaven er fullført');
  perform t.ok((select count(*) from public.ladder_tasks where status = 'open') = 1, 'neste forekomst er lagt inn');
  perform t.ok((select title from public.maintenance_logs where id = v_log) = 'Halvårlig egenkontroll',
               'fullføringen er dokumentert i loggen');

  -- ── Support og service ────────────────────────────────────────────────────
  v_ticket := public.create_ticket('Slitt trinn', 'Trinn 4 har en skade.', 'support', v_ladder);
  v_booking := public.request_service(v_ladder, current_date + 30, 'Ålesund', null);

  perform t.login(a);
  perform t.ok(not exists (select 1 from public.support_tickets where id = v_ticket),
               'en sak fra en som ikke er i selskapet er ikke synlig for selskapet');

  perform t.login(c);
  perform t.ok(exists (select 1 from public.notifications where kind = 'ticket'), 'admin varsles om ny sak');
  perform public.reply_ticket(v_ticket, 'Vi sender nytt trinn.');
  update public.service_bookings set status = 'scheduled', scheduled_date = current_date + 31 where id = v_booking;
  insert into public.service_reports (ladder_id, performed_at, performed_by, result, next_service_due)
  values (v_ladder, current_date, 'NWC', 'ok', current_date + 365);

  perform t.login(b);
  perform t.ok((select status from public.support_tickets where id = v_ticket) = 'waiting_customer', 'svar fra NWC setter status');
  perform t.ok((select count(*) from public.ticket_messages where ticket_id = v_ticket) = 2, 'kunden ser hele tråden');
  perform t.ok(exists (select 1 from public.notifications where kind = 'ticket_reply'), 'kunden varsles om svaret');
  perform t.ok(exists (select 1 from public.notifications where kind = 'service_scheduled'), 'og om avtalt service');
  perform t.ok((select status from public.service_bookings where id = v_booking) = 'completed',
               'servicerapporten avslutter bestillingen');

  -- ── Invitasjoner ──────────────────────────────────────────────────────────
  perform t.login(a);
  insert into public.access_invitations (email, scope, company_id, role, invited_by)
  values ('NY@rederi.test', 'company', v_company, 'member', a);

  perform t.login(b);
  v_failed := false;
  begin
    insert into public.access_invitations (email, scope, company_id, role, invited_by)
    values ('x@y.test', 'company', v_company, 'owner', b);
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'bare administratorer i selskapet kan invitere');

  perform t.login(f);
  v_res := public.portal_bootstrap();
  perform t.ok(jsonb_array_length(v_res -> 'invitations') = 1, 'invitasjonen venter på den inviterte');
  perform t.ok(not exists (select 1 from public.vessels where id = v_vessel), 'invitasjonen gir ingen tilgang før den er godtatt');
  perform public.accept_invitation((v_res #>> '{invitations,0,id}')::uuid);
  perform t.ok(exists (select 1 from public.vessels where id = v_vessel), 'den inviterte ser selskapets fartøy når hun har godtatt');
  perform t.ok(jsonb_array_length(public.portal_bootstrap() -> 'invitations') = 0, 'en godtatt invitasjon vises ikke igjen');

  -- ── Deling med los ────────────────────────────────────────────────────────
  perform t.login(a);
  insert into public.ladder_state_shares (ladder_id, vessel_id, token_hash, created_by, title)
  values (v_ladder, v_vessel, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), a, 'Tilstand før losbording')
  returning id into v_share;
  insert into storage.objects (bucket_id, name) values ('ladder-state-photos', v_share || '/1.jpg');
  insert into public.ladder_state_photos (share_id, storage_path, captured_at) values (v_share, v_share || '/1.jpg', now());

  perform t.anon();
  v_res := public.get_ladder_share(v_token);
  perform t.ok((v_res ->> 'state') = 'active' and (v_res #>> '{ladder,serial_number}') = 'NWC-2026-0001',
               'los ser rapporten med lenken');
  perform t.ok(jsonb_array_length(v_res -> 'photos') = 1, 'med bildene');
  perform t.ok(public.get_ladder_share('feil-token-som-er-lang-nok-1234') is null, 'feil lenke gir ingenting');
  perform t.ok((select count(*) from storage.objects) = 0, 'uten nøkkelen fra lenken ser ingen bildene');
  perform set_config('request.headers', json_build_object('x-share-token', 'feil-token-som-er-lang-nok-1234')::text, true);
  perform t.ok((select count(*) from storage.objects) = 0, 'feil nøkkel gir heller ingen bilder');
  perform set_config('request.headers', json_build_object('x-share-token', v_token)::text, true);
  perform t.ok((select count(*) from storage.objects) = 1, 'bildene kan hentes med nøkkelen mens delingen er aktiv');
  perform set_config('request.headers', '', true);

  v_failed := false;
  begin
    insert into storage.objects (bucket_id, name) values ('ladder-state-photos', v_share || '/2.jpg');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'uinnlogget kan ikke laste opp til en deling');

  perform t.login(a);
  update public.ladder_state_shares set revoked_at = now() where id = v_share;
  perform t.anon();
  perform t.ok((public.get_ladder_share(v_token) ->> 'state') = 'revoked', 'tilbaketrukket lenke virker ikke');
  perform t.ok((select count(*) from storage.objects) = 0, 'og bildene stenges samtidig');

  perform t.login(a);
  delete from storage.objects where bucket_id = 'ladder-state-photos' and name = v_share || '/1.jpg';
  perform t.root();
  perform t.ok(not exists (select 1 from storage.objects where name = v_share || '/1.jpg'),
               'eieren kan slette bildene også etter at delingen er trukket tilbake');
  perform t.anon();

  -- ── Åpent vedlikeholdsskjema ──────────────────────────────────────────────
  v_res := public.submit_maintenance_report(jsonb_build_object(
    'name', 'Ola', 'boat', 'MS Test', 'serial', 'nwc-2026-0001', 'notes', 'Smurt'));
  perform t.ok((v_res ->> 'matched')::boolean, 'serienummeret kobles til leideren');
  insert into storage.objects (bucket_id, name) values ('maintenance-photos', (v_res ->> 'log_id') || '/1-a.jpg');
  v_res := public.finish_maintenance_report((v_res ->> 'log_id')::uuid,
            array[(v_res ->> 'log_id') || '/1-a.jpg', 'en-annen-mappe/x.jpg']);
  perform t.ok((v_res ->> 'photos')::integer = 1, 'bare bilder i egen mappe knyttes til rapporten');

  -- ── Nyheter ───────────────────────────────────────────────────────────────
  perform t.login(c);
  insert into public.posts (slug, title_no, status, published_at) values
    ('utkast', 'Utkast', 'draft', null), ('publisert', 'Publisert', 'published', now());
  perform t.anon();
  perform t.ok((select count(*) from public.posts) = 1, 'besøkende ser bare publiserte innlegg');

  -- ── Medierollen: nyheter og galleri, ingenting annet ──────────────────────
  perform t.root();
  insert into auth.users (email, email_confirmed_at) values ('media@byraa.test', now()) returning id into g;
  insert into public.staff_members (email, role) values ('media@byraa.test', 'media');

  perform t.login(g);
  perform t.ok(app.is_media() and not app.is_staff() and not app.is_production(),
               'media er verken administrator eller produksjon');
  perform t.ok((public.portal_bootstrap() ->> 'staff_role') = 'media', 'bootstrap melder medierollen');
  perform t.ok((select count(*) from public.posts) = 2, 'media ser også utkast');
  update public.posts set title_no = 'Publisert og rettet' where slug = 'publisert';
  insert into public.gallery_images (image_url, alt_no, tag) values ('https://media.test/a.jpg', 'Leider i bruk', 'inUse');
  insert into public.gallery_images (image_url, alt_no, published) values ('https://media.test/b.jpg', 'Ikke klart ennå', false);
  insert into storage.objects (bucket_id, name) values ('public-media', 'galleri/a.jpg');
  perform t.ok(not exists (select 1 from public.companies), 'media ser ikke kunderegisteret');
  perform t.ok(not exists (select 1 from public.orders), 'media ser ikke bestillinger');
  perform t.ok(not exists (select 1 from public.production_jobs), 'media ser ikke produksjonen');
  perform t.ok(not exists (select 1 from public.staff_members), 'media ser ikke ansattlista');
  update public.products set price_nok = 1 where product_number = '400-034';

  perform t.root();
  perform t.ok((select title_no from public.posts where slug = 'publisert') = 'Publisert og rettet',
               'media kan redigere innlegg');
  perform t.ok((select price_nok from public.products where product_number = '400-034') = 13999,
               'media kan ikke endre priser');

  perform t.anon();
  perform t.ok((select count(*) from public.gallery_images) = 1, 'besøkende ser bare publiserte galleribilder');

  perform t.login(a);
  v_failed := false;
  begin
    insert into public.gallery_images (image_url, alt_no) values ('https://media.test/c.jpg', 'Fra en kunde');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'kunde kan ikke legge bilder i galleriet');

  -- ── Spesiallengde og skap bestilt alene ───────────────────────────────────
  select id into v_cabinet_product from public.products where product_number = 'ASC-LC3-5';
  v_order3 := public.place_order(jsonb_build_object(
    'name', 'Eier', 'email', 'eier@rederi.test', 'company_id', v_company, 'source', 'portal',
    'items', jsonb_build_array(
      jsonb_build_object('custom_length_m', 4.5, 'qty', 1, 'with_cabinet', true),
      jsonb_build_object('product_id', v_cabinet_product, 'qty', 2))));
  perform t.ok((v_order3 ->> 'total_nok')::integer = 2 * 9000,
               'skap alene prises fra katalogen, spesiallengden teller ikke i summen');
  perform t.ok((v_order3 #>> '{lines,0,on_request}')::boolean
               and (v_order3 #>> '{lines,0,name}') = 'Argostep – 4,5 m (spesiallengde)',
               'halvmeteren går på forespørsel, med lengden i navnet');
  perform t.ok((v_order3 #>> '{lines,0,cabinet_name}') = 'Oppbevaringsskap ASC-LC3-5',
               'spesiallengden får skapet som passer nærmeste standardlengde over');

  v_failed := false;
  begin
    perform public.place_order(jsonb_build_object(
      'name', 'Eier', 'email', 'eier@rederi.test',
      'items', jsonb_build_array(jsonb_build_object('custom_length_m', 4.3, 'qty', 1))));
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'bare hele og halve meter godtas som spesiallengde');

  v_failed := false;
  begin
    perform public.place_order(jsonb_build_object(
      'name', 'Eier', 'email', 'eier@rederi.test',
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', (select id from public.products where product_number = 'ARG-SPES'), 'qty', 1))));
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'spesiallengde uten lengde avvises');

  perform t.login(c);
  perform t.ok(public.confirm_order((v_order3 ->> 'id')::uuid) = 3, 'én jobb for leideren og én per skap');
  select id into v_job2 from public.production_jobs
   where order_id = (v_order3 ->> 'id')::uuid and kind = 'ladder';
  select id into v_job3 from public.production_jobs
   where order_id = (v_order3 ->> 'id')::uuid and kind = 'cabinet' limit 1;
  perform t.ok((select length_m = 4.5 and steps is null and with_cabinet and cabinet_name = 'Oppbevaringsskap ASC-LC3-5'
                from public.production_jobs where id = v_job2),
               'jobben har ønsket lengde og riktig skap i spesifikasjonen');
  perform t.ok((select count(*) from public.production_job_steps where job_id = v_job3) = 4,
               'skapjobben får bare stegene som gjelder skap');

  perform t.login(d);
  for v_step in select id from public.production_job_steps where job_id = v_job3 order by position loop
    v_res := public.set_production_step(v_step.id, true, null);
  end loop;
  perform public.advance_job(v_job3, 'delivered');

  for v_step in select id from public.production_job_steps where job_id = v_job2 order by position loop
    v_res := public.set_production_step(v_step.id, true, null);
  end loop;
  v_ladder2 := public.assign_job_serial(v_job2, 'NWC-2026-0045');
  perform public.advance_job(v_job2, 'delivered');

  perform t.login(a);
  perform t.ok((select count(*) from public.cabinets) = 2,
               'kunden ser skapet som ble levert alene og skapet som fulgte leideren');
  perform t.ok(exists (select 1 from public.cabinets where ladder_id = v_ladder2),
               'skapet som fulgte leideren er knyttet til den');
  perform t.ok((select length_m from public.ladder_status where ladder_id = v_ladder2) = 4.5,
               'leideren står med spesiallengden');

  -- ── Prosjekt: utstyr som ikke står på et fartøy ───────────────────────────
  insert into public.projects (company_id, name, kind, location)
  values (v_company, 'Kai 3 Ålesund', 'quay', 'Ålesund') returning id into v_project;

  perform public.install_ladder(v_ladder2, null, current_date, v_project);
  perform t.ok((select status = 'installed' and project_id = v_project and vessel_id is null
                from public.ladders where id = v_ladder2),
               'en leider kan stå i et prosjekt uten fartøy');
  perform t.ok((select project_name from public.ladder_status where ladder_id = v_ladder2) = 'Kai 3 Ålesund',
               'statusen viser prosjektet');

  select id into v_cabinet from public.cabinets where ladder_id is null limit 1;
  perform public.place_cabinet(v_cabinet, null, v_project, current_date, 'Ved landgangen');
  perform t.ok((select status = 'installed' and project_id = v_project and location_note = 'Ved landgangen'
                from public.cabinets where id = v_cabinet),
               'et skap kan plasseres i et prosjekt');

  perform t.login(b);
  perform t.ok(not exists (select 1 from public.projects), 'utenforstående ser ingen prosjekter');
  perform t.ok(not exists (select 1 from public.cabinets), 'og ingen skap');
  v_failed := false;
  begin
    perform public.place_cabinet(v_cabinet, null, null);
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'utenforstående kan ikke flytte et skap');
  v_failed := false;
  begin
    insert into public.projects (company_id, name) values (v_company, 'Ikke mitt');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'utenforstående kan ikke opprette prosjekt i andres selskap');

  perform t.login(a);
  perform public.place_cabinet(v_cabinet, v_vessel, null);
  perform t.ok((select vessel_id = v_vessel and project_id is null and status = 'installed'
                from public.cabinets where id = v_cabinet),
               'skapet kan flyttes fra prosjektet til et fartøy');
  perform t.ok((select location_note is null from public.cabinets where id = v_cabinet),
               'nøyaktig sted følger ikke med når skapet flyttes uten ny tekst');
  perform public.install_ladder(v_ladder2, null, null, null);
  perform t.ok((select status = 'delivered' and project_id is null from public.ladders where id = v_ladder2),
               'leideren kan tas ut av prosjektet igjen');

  perform t.root();
  update public.ladders set status = 'retired' where id = v_ladder2;
  perform t.login(a);
  v_failed := false;
  begin
    perform public.install_ladder(v_ladder2, null, current_date, v_project);
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'en utrangert leider kan ikke tas i bruk av kunden');
  perform t.root();
  update public.ladders set status = 'delivered' where id = v_ladder2;
  perform t.login(a);

  -- ── Service med bilder og servicesertifikat ───────────────────────────────
  perform t.login(c);
  insert into public.service_reports (ladder_id, performed_at, performed_by, result, next_service_due)
  values (v_ladder, current_date, 'NWC Service', 'ok', current_date + 365) returning id into v_report;
  insert into storage.objects (bucket_id, name) values ('service-reports', v_ladder || '/' || v_report || '/1.jpg');
  insert into public.service_report_photos (service_report_id, storage_path)
  values (v_report, v_ladder || '/' || v_report || '/1.jpg');

  v_cert := public.issue_ladder_certificate(v_ladder, v_report);
  perform t.ok((select certificate_number like 'SS-%' and valid_until = current_date + 365
                       and serial_number = 'NWC-2026-0001' and vessel_name = 'MS Test'
                from public.ladder_certificates where id = v_cert),
               'sertifikatet får nummer, gyldighet fra servicen og opplysningene om leideren');
  select verify_token into v_cert_token from public.ladder_certificates where id = v_cert;

  v_cert2 := public.issue_ladder_certificate(v_ladder, null, current_date + 30, 'Ekstra kontroll');
  perform t.ok((select replaced_by = v_cert2 from public.ladder_certificates where id = v_cert),
               'et nytt sertifikat erstatter det forrige');

  perform t.login(a);
  perform t.ok((select count(*) from public.ladder_certificates where ladder_id = v_ladder) = 2,
               'eieren ser sertifikatene');
  perform t.ok((select count(*) from public.service_report_photos) = 1, 'og bildene fra servicen');
  perform t.ok((select count(*) from storage.objects where bucket_id = 'service-reports') = 1,
               'bildefilene kan hentes av den som har tilgang til leideren');
  perform t.ok((select certificate_valid_until from public.ladder_status where ladder_id = v_ladder) = current_date + 30,
               'statusen viser det gjeldende sertifikatet');
  perform t.ok(exists (select 1 from public.notifications where kind = 'certificate_issued' and user_id = a),
               'eieren er varslet om sertifikatet');
  v_failed := false;
  begin
    perform public.issue_ladder_certificate(v_ladder);
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'kunde kan ikke utstede sertifikat');

  perform t.anon();
  perform t.ok((public.get_certificate(v_cert_token) ->> 'status') = 'replaced',
               'kontrollenken viser at sertifikatet er erstattet');
  perform t.ok((public.get_certificate('00000000000000000000000000000000') ->> 'found') = 'false',
               'ukjent kode gir ingenting');
  v_failed := false;
  begin
    perform 1 from public.ladder_certificates;
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'uinnlogget kan ikke lese sertifikatregisteret');

  -- Sertifikatet følger med i den delte rapporten til los.
  perform t.login(a);
  insert into public.ladder_state_shares (ladder_id, vessel_id, token_hash, created_by, title)
  values (v_ladder, v_vessel, encode(sha256(convert_to(v_token2, 'UTF8')), 'hex'), a, 'Med sertifikat');
  perform t.anon();
  v_res := public.get_ladder_share(v_token2);
  perform t.ok((v_res #>> '{certificate,certificate_number}') like 'SS-%'
               and (v_res #>> '{certificate,valid_until}')::date = current_date + 30,
               'los ser det gjeldende sertifikatet i den delte rapporten');

  -- En ikke godkjent service trekker det gjeldende sertifikatet tilbake.
  perform t.login(c);
  insert into public.service_reports (ladder_id, performed_at, performed_by, result)
  values (v_ladder, current_date, 'NWC Service', 'failed');
  perform t.ok((select revoked_at is not null and revoked_reason like 'Leideren ble ikke godkjent%'
                from public.ladder_certificates where id = v_cert2),
               'ikke godkjent service trekker sertifikatet tilbake');

  perform t.login(a);
  perform t.ok(exists (select 1 from public.notifications where kind = 'certificate_revoked' and user_id = a),
               'eieren varsles når sertifikatet trekkes tilbake');
  perform t.ok((select certificate_number is null from public.ladder_status where ladder_id = v_ladder),
               'leideren står da uten gjeldende sertifikat');
  perform t.anon();
  perform t.ok(jsonb_typeof(public.get_ladder_share(v_token2) -> 'certificate') = 'null',
               'og sertifikatet forsvinner fra den delte rapporten');

  -- ── Admin loggfører vedlikehold selv ──────────────────────────────────────
  perform t.login(c);
  insert into public.maintenance_logs
    (ladder_id, reported_by_user_id, reporter_name, performed_at, kind, title, notes, source)
  values (v_ladder, c, 'NorthWest Coast', current_date, 'inspection', 'Kontroll ved kai', 'Alt i orden.', 'admin')
  returning id into v_log2;
  insert into storage.objects (bucket_id, name) values ('maintenance-photos', v_log2 || '/1.jpg');
  insert into public.maintenance_photos (maintenance_log_id, storage_path) values (v_log2, v_log2 || '/1.jpg');

  perform t.login(a);
  perform t.ok(exists (select 1 from public.maintenance_logs where id = v_log2),
               'kunden ser rapporten administratoren la inn');
  perform t.ok(exists (select 1 from public.maintenance_photos where maintenance_log_id = v_log2),
               'med bildene');
  perform t.ok(exists (select 1 from public.notifications
                       where kind = 'log_entry' and user_id = a
                         and title like 'NorthWest Coast har loggført%'),
               'og blir varslet om den');

  -- ── Jobb opprettet for hånd ───────────────────────────────────────────────
  perform t.login(c);
  insert into public.production_jobs (product_id, kind, product_name, product_number, customer_label)
  values (v_cabinet_product, 'cabinet', 'Oppbevaringsskap ASC-LC3-5', 'ASC-LC3-5', 'Lager');
  perform t.ok(exists (select 1 from public.production_jobs
                       where customer_label = 'Lager' and job_number like 'P-%'),
               'administrator kan opprette en jobb for hånd, og den får jobbnummer');

  perform t.login(d);
  v_failed := false;
  begin
    insert into public.production_jobs (product_id, kind, product_name, product_number)
    values (v_cabinet_product, 'cabinet', 'Oppbevaringsskap ASC-LC3-5', 'ASC-LC3-5');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'produksjon kan ikke opprette jobber selv');

  -- ── Den siste administratoren ─────────────────────────────────────────────
  perform t.login(c);
  delete from public.staff_members where email = 'sjef@nwc.test';
  v_failed := false;
  begin
    delete from public.staff_members where email = 'admin@nwc.test';
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'den siste administratoren kan ikke fjernes');

  perform t.login(d);
  delete from public.staff_members where email = 'admin@nwc.test';
  perform t.root();
  perform t.ok(exists (select 1 from public.staff_members where email = 'admin@nwc.test'),
               'produksjon kan ikke endre ansattlista');

  raise notice 'Flyttestene består.';
end $$;

-- ── Sikkerhetsgjennomgangen 19.11.2026 ──────────────────────────────────────
-- Hvert avsnitt er et angrep som virket før, og som nå skal avvises.
do $$
declare
  o uuid; ad uuid; x uuid; m uuid;       -- eier, selskapsadministrator, utenforstående, medlem
  v_company uuid; v_other uuid; v_vessel uuid; v_other_vessel uuid; v_ladder uuid;
  v_share uuid; v_ticket uuid; v_failed boolean; v_count integer;
  v_token text := 'tok_sec_abcdefghijklmnopqrstuvwxyz01234';
  v_res jsonb; v_tok text; v_last date; v_user uuid;
begin
  perform t.root();
  insert into auth.users (email, email_confirmed_at) values ('eier@sikker.test', now()) returning id into o;
  insert into auth.users (email, email_confirmed_at) values ('admin@sikker.test', now()) returning id into ad;
  insert into auth.users (email, email_confirmed_at) values ('angriper@sikker.test', now()) returning id into x;
  insert into auth.users (email, email_confirmed_at) values ('medlem@sikker.test', now()) returning id into m;

  perform t.login(o);  perform public.portal_bootstrap();
  v_company := public.create_my_company('Sikker Rederi AS');
  insert into public.vessels (company_id, name) values (v_company, 'MS Sikker') returning id into v_vessel;
  perform t.login(ad); perform public.portal_bootstrap();
  perform t.login(m);  perform public.portal_bootstrap();
  perform t.login(x);  perform public.portal_bootstrap();
  v_other := public.create_my_company('Sikker Rederi');
  insert into public.vessels (company_id, name) values (v_other, 'MS Angriper') returning id into v_other_vessel;

  perform t.root();
  insert into public.company_members (company_id, user_id, role) values (v_company, ad, 'admin'), (v_company, m, 'member');
  insert into public.ladders (company_id, vessel_id, product_id, serial_number, status)
  select v_company, v_vessel, p.id, 'SEC-2026-0001', 'installed' from public.products p where p.product_number = '400-034'
  returning id into v_ladder;

  -- ── Medlemskap kan ikke tvinges på noen ────────────────────────────────
  perform t.login(x);
  v_failed := false;
  begin
    insert into public.company_members (company_id, user_id, role) values (v_other, o, 'member');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'ingen kan sette inn et medlem direkte');

  -- ── Eierrollen ─────────────────────────────────────────────────────────
  perform t.login(ad);
  v_failed := false;
  begin
    update public.company_members set role = 'owner' where company_id = v_company and user_id = ad;
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'en administrator kan ikke gjøre seg selv til eier');

  v_failed := false;
  begin
    delete from public.company_members where company_id = v_company and user_id = o;
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'en administrator kan ikke fjerne eieren');

  v_failed := false;
  begin
    update public.company_members set created_at = '2000-01-01' where company_id = v_company and user_id = ad;
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'bare rollen kan endres på et medlemskap');

  v_failed := false;
  begin
    insert into public.access_invitations (email, scope, company_id, role, invited_by)
    values ('ny-eier@sikker.test', 'company', v_company, 'owner', ad);
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'en administrator kan ikke invitere en ny eier');

  update public.company_members set role = 'admin' where company_id = v_company and user_id = m;
  perform t.root();
  perform t.ok((select role from public.company_members where company_id = v_company and user_id = m) = 'admin',
               'en administrator kan fortsatt endre andre roller');

  perform t.login(o);
  v_failed := false;
  begin
    delete from public.company_members where company_id = v_company and user_id = o;
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'den siste eieren kan ikke forlate selskapet');

  insert into public.access_invitations (email, scope, company_id, role, invited_by, invited_by_name)
  values ('ny-eier@sikker.test', 'company', v_company, 'owner', o, 'NorthWest Coast AS');
  perform t.ok((select invited_by_name from public.access_invitations where email = 'ny-eier@sikker.test')
               = 'eier@sikker.test', 'navnet på den som inviterer hentes fra profilen');

  perform t.login(m);
  delete from public.company_members where company_id = v_company and user_id = m;
  perform t.root();
  perform t.ok(not exists (select 1 from public.company_members where company_id = v_company and user_id = m),
               'et medlem kan selv forlate selskapet');
  insert into public.company_members (company_id, user_id, role) values (v_company, m, 'member');

  -- ── Tak på invitasjoner ────────────────────────────────────────────────
  perform t.login(x);
  v_failed := false;
  begin
    for i in 1..6 loop
      insert into public.access_invitations (email, scope, company_id, role, invited_by)
      values ('offer@andre.test', 'company', v_other, 'member', x);
      delete from public.access_invitations where email = 'offer@andre.test';
    end loop;
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'samme adresse kan ikke få invitasjoner i det uendelige');

  -- ── Loggføringer kan ikke utgi seg for å komme fra NorthWest Coast ─────
  perform t.login(m);
  v_failed := false;
  begin
    insert into public.maintenance_logs (ladder_id, reported_by_user_id, reporter_name, kind, title, source)
    values (v_ladder, m, 'NorthWest Coast AS', 'inspection', 'Årskontroll godkjent', 'admin');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'en kunde kan ikke loggføre som NorthWest Coast');

  v_failed := false;
  begin
    insert into public.maintenance_logs (ladder_id, vessel_id, reported_by_user_id, reporter_name, kind, title, source)
    values (v_ladder, v_other_vessel, m, 'Medlem', 'inspection', 'Kontroll', 'portal');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'en loggføring kan ikke legges på et annet selskaps fartøy');

  v_failed := false;
  begin
    insert into public.maintenance_logs (ladder_id, reported_by_user_id, reporter_name, kind, title, source, performed_at)
    values (v_ladder, m, 'Medlem', 'inspection', 'Kontroll', 'portal', current_date + 400);
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'en loggføring kan ikke dateres fram i tid');

  insert into public.maintenance_logs (ladder_id, vessel_id, reported_by_user_id, reporter_name, kind, title, source, performed_at)
  values (v_ladder, v_vessel, m, 'Medlem', 'inspection', 'Kontroll før bruk', 'portal', current_date);

  -- ── Delte rapporter kan ikke skrives om ────────────────────────────────
  perform t.login(o);
  insert into public.ladder_state_shares (ladder_id, vessel_id, token_hash, created_by, created_by_name, title)
  values (v_ladder, v_vessel, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), o, 'NorthWest Coast AS', 'Rapport')
  returning id into v_share;
  perform t.ok((select created_by_name from public.ladder_state_shares where id = v_share) = 'eier@sikker.test',
               'navnet på den som deler hentes fra profilen');
  update public.ladder_state_shares set revoked_at = now() where id = v_share;

  perform t.login(m);
  v_failed := false;
  begin
    update public.ladder_state_shares set expires_at = 'infinity' where id = v_share;
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'en delt rapport kan ikke forlenges');

  update public.ladder_state_shares set revoked_at = null where id = v_share;
  perform t.root();
  perform t.ok((select revoked_at is not null from public.ladder_state_shares where id = v_share),
               'en tilbaketrukket lenke kan ikke åpnes igjen av andre');

  perform t.login(m);
  v_failed := false;
  begin
    insert into public.ladder_state_shares (ladder_id, vessel_id, token_hash, created_by, title, expires_at)
    values (v_ladder, v_vessel, 'x', m, 'Evig', now() + interval '5 years');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'en delt rapport kan ikke vare i årevis');

  -- ── En leider kan ikke flyttes til et annet selskap ────────────────────
  perform t.root();
  insert into public.ladder_members (ladder_id, user_id, role) values (v_ladder, x, 'manager');
  perform t.login(x);
  v_failed := false;
  begin
    perform public.install_ladder(v_ladder, v_other_vessel, current_date, null);
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'en som forvalter én leider kan ikke flytte den til sitt eget selskap');
  perform t.root();
  perform t.ok((select company_id from public.ladders where id = v_ladder) = v_company, 'leideren står der den sto');

  perform t.login(o);
  v_failed := false;
  begin
    perform public.install_ladder(v_ladder, v_vessel, current_date + 900, null);
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'monteringsdatoen kan ikke ligge fram i tid');
  perform public.install_ladder(v_ladder, v_vessel, current_date, null);

  -- ── En sak havner ikke i et tilfeldig selskap ──────────────────────────
  perform t.root();
  insert into public.company_members (company_id, user_id, role, created_at) values (v_other, o, 'member', '2000-01-01');
  perform t.login(o);
  v_ticket := public.create_ticket('Faktura', 'Konfidensielt', 'support');
  perform t.root();
  perform t.ok((select company_id is null from public.support_tickets where id = v_ticket),
               'med flere selskap gjettes det ikke hvilket saken gjelder');

  -- ── Avmelding fra nyhetsbrevet står ─────────────────────────────────────
  perform t.anon();
  perform public.subscribe_newsletter('avmeldt@sikker.test');
  perform t.root();
  update public.newsletter_subscribers set unsubscribed_at = now() where email = 'avmeldt@sikker.test';
  perform t.anon();
  perform public.subscribe_newsletter('avmeldt@sikker.test');
  perform t.root();
  perform t.ok((select unsubscribed_at is not null from public.newsletter_subscribers where email = 'avmeldt@sikker.test'),
               'en avmeldt adresse meldes ikke på igjen av andre');

  -- ── Den gamle veien til administrator er stengt ────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', x, 'role', 'authenticated', 'app_metadata', json_build_object('staff', true))::text, true);
  perform t.ok(app.staff_role() is null, 'et flagg i JWT-en gir ikke lenger administrator');

  -- ── En invitasjon gir ikke medlemskap før den er godtatt ───────────────
  perform t.root();
  delete from public.company_members where company_id = v_other and user_id = o;
  perform t.login(x);
  insert into public.access_invitations (email, scope, company_id, role, invited_by)
  values ('eier@sikker.test', 'company', v_other, 'member', x);
  perform t.login(o);
  v_res := public.portal_bootstrap();
  perform t.ok(jsonb_array_length(v_res -> 'invitations') = 1
               and (v_res #>> '{invitations,0,target}') = 'Sikker Rederi',
               'den inviterte ser invitasjonen og hvem den gjelder');
  perform t.root();
  perform t.ok(not exists (select 1 from public.company_members where company_id = v_other and user_id = o),
               'ingen blir medlem av et selskap uten å godta selv');
  perform t.login(m);
  v_failed := false;
  begin
    perform public.accept_invitation((v_res #>> '{invitations,0,id}')::uuid);
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'en invitasjon kan ikke godtas av andre enn mottakeren');
  perform t.login(o);
  perform public.decline_invitation((v_res #>> '{invitations,0,id}')::uuid);
  perform t.ok(jsonb_array_length(public.portal_bootstrap() -> 'invitations') = 0, 'en avslått invitasjon er borte');

  -- ── Meldinger fra det åpne skjemaet teller ikke før de er bekreftet ────
  perform t.root();
  select last_maintenance_at into v_last from public.ladder_status where ladder_id = v_ladder;
  perform t.anon();
  perform public.submit_maintenance_report(jsonb_build_object(
    'name', 'Kontrollert OK – NWC service', 'boat', 'x', 'serial', 'sec-2026-0001'));
  perform t.root();
  perform t.ok((select last_maintenance_at from public.ladder_status where ladder_id = v_ladder) is not distinct from v_last,
               'en anonym melding endrer ikke «siste vedlikehold»');
  perform t.login(o);
  insert into public.ladder_state_shares (ladder_id, vessel_id, token_hash, created_by, title)
  values (v_ladder, v_vessel, encode(sha256(convert_to(v_token || 'b', 'UTF8')), 'hex'), o, 'Rapport 2');
  perform t.anon();
  perform t.ok(not exists (
      select 1 from jsonb_array_elements(public.get_ladder_share(v_token || 'b') -> 'recent_logs') e
      where e ->> 'reporter_name' = 'Kontrollert OK – NWC service'),
    'en anonym melding vises ikke for los');
  perform t.root();
  update public.maintenance_logs set verified_at = now() where reporter_name = 'Kontrollert OK – NWC service';
  perform t.anon();
  perform t.ok(exists (
      select 1 from jsonb_array_elements(public.get_ladder_share(v_token || 'b') -> 'recent_logs') e
      where e ->> 'reporter_name' = 'Kontrollert OK – NWC service'),
    'en bekreftet melding vises');

  -- ── Skjemaene kan ikke stenges for andre ───────────────────────────────
  perform t.root();
  insert into app.gates (name, secret_hash) values ('forms', encode(sha256(convert_to('hemmelig', 'UTF8')), 'hex'));
  perform t.anon();
  perform set_config('request.headers', '{}', true);
  for i in 1..20 loop
    perform public.submit_contact_request(jsonb_build_object('name', 'Bot', 'email', 'bot' || i || '@flom.test'));
  end loop;
  v_failed := false;
  begin
    perform public.submit_contact_request(jsonb_build_object('name', 'Bot', 'email', 'bot21@flom.test'));
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'kall rett mot API-et har sin egen, lille kvote');

  perform set_config('request.headers', json_build_object('x-nwc-gate', 'hemmelig', 'x-nwc-client', '203.0.113.7')::text, true);
  perform public.submit_contact_request(jsonb_build_object('name', 'Kari', 'email', 'kari@kunde.test'));
  perform t.ok(true, 'en besøkende på nettstedet slipper gjennom selv om kvoten for direkte kall er brukt opp');

  v_failed := false;
  begin
    for i in 1..8 loop
      perform public.submit_contact_request(jsonb_build_object('name', 'Kari', 'email', 'kari' || i || '@kunde.test'));
    end loop;
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'én besøkende har sin egen grense');
  perform set_config('request.headers', json_build_object('x-nwc-gate', 'hemmelig', 'x-nwc-client', '203.0.113.8')::text, true);
  perform public.submit_contact_request(jsonb_build_object('name', 'Ola', 'email', 'ola@kunde.test'));
  perform t.ok(true, 'og den rammer ikke neste besøkende');

  perform set_config('request.headers', json_build_object('x-nwc-gate', 'feil', 'x-nwc-client', '203.0.113.9')::text, true);
  v_failed := false;
  begin
    perform public.submit_contact_request(jsonb_build_object('name', 'Bot', 'email', 'bot@flom2.test'));
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'feil nøkkel regnes som et direkte kall');

  -- ── Nyhetsbrev: påmelding gjelder først når adressen er bekreftet ──────
  perform set_config('request.headers', '{}', true);
  v_res := public.subscribe_newsletter('offer@nyhet.test');
  perform t.ok(v_res ->> 'status' = 'pending' and not (v_res ? 'token'),
               'nøkkelen til bekreftelsen gis ikke ut rett fra API-et');
  perform set_config('request.headers', json_build_object('x-nwc-gate', 'hemmelig', 'x-nwc-client', '203.0.113.20')::text, true);
  v_res := public.subscribe_newsletter('ny@nyhet.test');
  v_tok := v_res ->> 'token';
  perform t.ok(v_res ->> 'status' = 'pending' and length(v_tok) = 48, 'nettstedet får nøkkelen til bekreftelses-e-posten');
  perform t.root();
  perform t.ok((select confirmed_at is null from public.newsletter_subscribers where email = 'ny@nyhet.test'),
               'påmeldingen er ventende til den er bekreftet');
  perform t.anon();
  perform t.ok(public.confirm_newsletter('x' || v_tok) is false, 'feil nøkkel bekrefter ingenting');
  perform t.ok(public.confirm_newsletter(v_tok) is true, 'riktig nøkkel bekrefter');
  perform t.ok(public.confirm_newsletter(v_tok) is false, 'nøkkelen virker bare én gang');
  perform t.ok((public.subscribe_newsletter('ny@nyhet.test') ->> 'status') = 'active', 'en bekreftet adresse får ingen ny e-post');
  perform t.root();
  select unsubscribe_token into v_tok from public.newsletter_subscribers where email = 'ny@nyhet.test';
  perform t.anon();
  perform t.ok(public.unsubscribe_newsletter(v_tok) is true, 'avmelding med lenken virker');
  perform t.root();
  perform t.ok((select unsubscribed_at is not null from public.newsletter_subscribers where email = 'ny@nyhet.test'),
               'og adressen står som avmeldt');
  perform set_config('request.headers', '', true);

  -- ── Ingen passord på kontoene ──────────────────────────────────────────
  insert into auth.users (email, encrypted_password) values ('forhånd@sikker.test', 'angriperens-passord')
  returning id into v_user;
  perform t.ok((select encrypted_password is null from auth.users where id = v_user),
               'et passord satt ved registrering blir ikke stående');
  update auth.users set encrypted_password = 'nytt-forsøk' where id = v_user;
  perform t.ok((select encrypted_password is null from auth.users where id = v_user),
               'og kan ikke settes etterpå');

  raise notice 'Sikkerhetstestene består.';
end $$;

-- ── Lager ───────────────────────────────────────────────────────────────────
do $$
declare
  adm uuid; prod uuid; cust uuid; med uuid;
  v_built uuid; v_resale uuid; v_spare uuid; v_special uuid;     -- produkter
  i_step uuid; i_rope uuid; i_built uuid; i_resale uuid; i_spare uuid;  -- lagervarer
  v_sup uuid; v_po uuid; v_line uuid; v_line2 uuid;
  v_order jsonb; v_job uuid; v_stock_job uuid; v_ladder uuid; v_failed boolean;
  r record;
begin
  select id into adm  from auth.users where lower(email) = 'admin@nwc.test';
  select id into prod from auth.users where lower(email) = 'prod@nwc.test';
  select id into cust from auth.users where lower(email) = 'eier@rederi.test';
  select id into med  from auth.users where lower(email) = 'media@byraa.test';

  perform t.root();
  insert into public.products (product_number, name, kind, length_m, steps, price_nok, sourcing)
  values ('L-BYGG-4', 'Egen leider 4 m', 'ladder', 4, 13, 10000, 'assembled') returning id into v_built;
  insert into public.products (product_number, name, kind, length_m, steps, price_nok, sourcing)
  values ('L-VIDERE-6', 'Videresalgsleider 6 m', 'ladder', 6, 19, 12000, 'resale') returning id into v_resale;
  insert into public.products (product_number, name, kind, price_nok, sourcing)
  values ('R-TRINN', 'Trinn, reservedel', 'spare_part', 400, 'resale') returning id into v_spare;
  insert into public.products (product_number, name, kind, price_nok, sourcing, price_on_request)
  values ('L-SPES', 'Egen leider, spesiallengde', 'ladder', 0, 'assembled', true) returning id into v_special;

  -- ── Administrator setter opp varer og stykkliste ───────────────────────
  perform t.login(adm);
  insert into public.suppliers (name) values ('Tauverket AS') returning id into v_sup;
  insert into public.stock_items (item_number, name, category, supply, unit, product_id, reorder_point)
  values ('D-TRINN', 'Trinn', 'part', 'external', 'stk', v_spare, 20) returning id into i_step;
  insert into public.stock_items (item_number, name, category, supply, unit, supplier_id)
  values ('D-TAU', 'Sidetau', 'part', 'purchased', 'm', v_sup) returning id into i_rope;
  insert into public.stock_items (item_number, name, category, supply, product_id)
  values ('F-BYGG-4', 'Egen leider 4 m', 'finished', 'assembled', v_built) returning id into i_built;
  insert into public.stock_items (item_number, name, category, supply, product_id)
  values ('F-VIDERE-6', 'Videresalgsleider 6 m', 'finished', 'purchased', v_resale) returning id into i_resale;

  insert into public.product_components (product_id, item_id, qty) values (v_built, i_step, 13), (v_built, i_rope, 8.5);
  insert into public.product_components (product_id, item_id, qty, qty_per_metre) values (v_special, i_step, 1, 3);
  insert into public.product_components (product_id, item_id, qty_per_metre) values (v_special, i_rope, 2.1);

  v_failed := false;
  begin
    update public.stock_items set on_hand = 999 where id = i_step;
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'beholdningen kan ikke settes direkte, bare gjennom bevegelser');

  -- ── Innkjøp og varemottak ──────────────────────────────────────────────
  insert into public.purchase_orders (supplier_id, kind, expected_on)
  values (v_sup, 'external_production', current_date + 14) returning id into v_po;
  insert into public.purchase_order_lines (purchase_order_id, item_id, qty_ordered)
  values (v_po, i_step, 100) returning id into v_line;
  insert into public.purchase_order_lines (purchase_order_id, item_id, qty_ordered)
  values (v_po, i_rope, 60) returning id into v_line2;
  perform t.ok((select on_order from public.stock_overview where id = i_step) = 100, 'det som er bestilt vises som «i bestilling»');

  perform t.login(prod);
  perform public.receive_purchase_line(v_line, 60);
  perform t.ok((select on_hand from public.stock_items where id = i_step) = 60
               and (select on_order from public.stock_overview where id = i_step) = 40,
               'produksjon registrerer delmottak, resten står i bestilling');
  perform public.receive_purchase_line(v_line, 40);
  perform public.receive_purchase_line(v_line2, 60);
  perform t.ok((select status from public.purchase_orders where id = v_po) = 'received', 'innkjøpet er mottatt når alt er kommet');
  v_failed := false;
  begin
    perform public.receive_purchase_line(v_line, 1);
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'et avsluttet innkjøp tar ikke imot mer');

  insert into public.stock_movements (item_id, quantity, kind, note) values (i_resale, 5, 'receipt', 'Varemottak uten innkjøp');
  insert into public.stock_movements (item_id, quantity, kind, note) values (i_rope, -1.5, 'scrap', 'Skadet kveil');
  perform t.ok((select on_hand from public.stock_items where id = i_rope) = 58.5, 'produksjon kan registrere svinn');
  perform t.ok((select created_by_name from public.stock_movements where kind = 'scrap' and item_id = i_rope) is not null,
               'bevegelsen stemples med hvem som registrerte den');

  v_failed := false;
  begin
    insert into public.stock_movements (item_id, quantity, kind) values (i_rope, 5, 'scrap');
  exception when check_violation then v_failed := true;
  end;
  perform t.ok(v_failed, 'fortegnet må passe med slaget bevegelse');

  v_failed := false;
  begin
    insert into public.stock_movements (item_id, quantity, kind, job_id) values (i_rope, -1, 'production_out', gen_random_uuid());
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'en manuell bevegelse kan ikke knyttes til en jobb');

  v_failed := false;
  begin
    delete from public.stock_movements where item_id = i_rope;
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'bevegelser kan ikke slettes');

  v_failed := false;
  begin
    insert into public.stock_items (item_number, name) values ('X-1', 'Ulovlig vare');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'produksjon kan ikke opprette varer');

  -- ── Kunder og media ser ikke lageret ───────────────────────────────────
  perform t.login(cust);
  perform t.ok((select count(*) from public.stock_items) = 0 and (select count(*) from public.stock_movements) = 0
               and (select count(*) from public.product_components) = 0, 'kunder ser ikke lageret');
  perform t.ok((select count(*) from public.stock_usage()) = 0, 'og får ingenting ut av forbruksoversikten');
  perform t.login(med);
  perform t.ok((select count(*) from public.stock_overview) = 0 and (select count(*) from public.purchase_orders) = 0,
               'media ser ikke lageret');

  -- ── Bestilling av en leider vi bygger selv: delene trekkes når den er ferdig ──
  perform t.login(cust);
  v_order := public.place_order(jsonb_build_object(
    'name', 'Eier', 'email', 'lager1@rederi.test', 'source', 'portal',
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_built, 'qty', 1),
      jsonb_build_object('product_id', v_resale, 'qty', 1),
      jsonb_build_object('product_id', v_spare, 'qty', 4))));
  perform t.login(adm);
  perform public.confirm_order((v_order ->> 'id')::uuid);
  perform t.ok((select reserved from public.stock_overview where id = i_step) = 13
               and (select available from public.stock_overview where id = i_step) = 87,
               'åpne jobber binder deler etter stykklista');

  perform t.login(prod);
  select id into v_job from public.production_jobs where order_id = (v_order ->> 'id')::uuid and product_id = v_built;
  perform public.assign_job_serial(v_job, 'LAGER-0001');
  for r in select id from public.production_job_steps where job_id = v_job loop
    perform public.set_production_step(r.id, true);
  end loop;
  perform t.ok((select on_hand from public.stock_items where id = i_step) = 87
               and (select on_hand from public.stock_items where id = i_rope) = 50
               and (select on_hand from public.stock_items where id = i_built) = 1,
               'ferdig montert: delene er trukket, og enheten står på lager');
  perform t.ok((select reserved from public.stock_overview where id = i_step) = 0, 'og delene er ikke lenger bundet');

  -- Et steg åpnes og lukkes igjen: delene trekkes ikke en gang til.
  select id into r from public.production_job_steps where job_id = v_job limit 1;
  perform public.set_production_step(r.id, false);
  perform public.set_production_step(r.id, true);
  perform t.ok((select on_hand from public.stock_items where id = i_step) = 87, 'delene trekkes bare én gang per jobb');

  perform public.advance_job(v_job, 'delivered');
  perform t.ok((select on_hand from public.stock_items where id = i_built) = 0, 'levert: enheten går ut som solgt');

  -- ── Videresalg: ingen deler, bare enheten ut ───────────────────────────
  select id into v_job from public.production_jobs where order_id = (v_order ->> 'id')::uuid and product_id = v_resale;
  perform public.assign_job_serial(v_job, 'LAGER-0002');
  for r in select id from public.production_job_steps where job_id = v_job loop
    perform public.set_production_step(r.id, true);
  end loop;
  perform t.ok((select on_hand from public.stock_items where id = i_resale) = 5
               and (select count(*) from public.stock_movements where job_id = v_job) = 0,
               'en leider vi selger videre trekker ingen deler og legges ikke inn på nytt');
  perform public.advance_job(v_job, 'delivered');
  perform t.ok((select on_hand from public.stock_items where id = i_resale) = 4, 'den går ut av lageret når den leveres');

  -- ── Reservedeler: trekkes når bestillingen er levert ───────────────────
  perform t.root();
  perform t.ok((select status from public.orders where id = (v_order ->> 'id')::uuid) = 'delivered', 'bestillingen er levert');
  perform t.ok((select on_hand from public.stock_items where id = i_step) = 83, 'reservedelene i bestillingen er trukket som direkte salg');

  -- ── Forbruk: produksjon mot direkte salg ───────────────────────────────
  perform t.login(adm);
  select * into r from public.stock_usage(current_date - 1, current_date) u where u.item_id = i_step;
  perform t.ok(r.received = 100 and r.used_in_production = 13 and r.sold = 4,
               'forbruket skiller mellom produksjon og direkte salg');

  -- ── Spesiallengde: mengden følger lengden ──────────────────────────────
  perform t.login(cust);
  v_order := public.place_order(jsonb_build_object(
    'name', 'Eier', 'email', 'lager2@rederi.test', 'source', 'portal',
    'company_id', (select cm.company_id from public.company_members cm
                   join public.companies c on c.id = cm.company_id
                   where cm.user_id = cust and c.name = 'Testrederi AS'),
    'items', jsonb_build_array(jsonb_build_object('product_id', v_built, 'qty', 1))));
  perform t.root();
  insert into public.production_jobs (product_id, kind, product_name, product_number, length_m)
  values (v_special, 'ladder', 'Egen leider – 5,5 m (spesiallengde)', 'L-SPES', 5.5) returning id into v_job;
  perform t.login(prod);
  perform public.assign_job_serial(v_job, 'LAGER-0003');
  for r in select id from public.production_job_steps where job_id = v_job loop
    perform public.set_production_step(r.id, true);
  end loop;
  perform t.ok((select -quantity from public.stock_movements where job_id = v_job and item_id = i_step) = 17.5
               and (select -quantity from public.stock_movements where job_id = v_job and item_id = i_rope) = 11.55,
               'en spesiallengde trekker deler etter lengden');
  perform public.advance_job(v_job, 'delivered');

  -- ── Bygget til lager, og solgt fra lager ───────────────────────────────
  perform t.login(adm);
  insert into public.production_jobs (product_id, kind, product_name, product_number, length_m, steps)
  values (v_built, 'ladder', 'Egen leider 4 m', 'L-BYGG-4', 4, 13) returning id into v_stock_job;
  perform t.login(prod);
  perform public.assign_job_serial(v_stock_job, 'LAGER-0004');
  for r in select id from public.production_job_steps where job_id = v_stock_job loop
    perform public.set_production_step(r.id, true);
  end loop;
  perform public.advance_job(v_stock_job, 'stocked');
  select ladder_id into v_ladder from public.production_jobs where id = v_stock_job;
  perform t.root();   -- produksjon ser ikke leidere uten kunde
  perform t.ok((select status from public.production_jobs where id = v_stock_job) = 'stocked'
               and (select status::text from public.ladders where id = v_ladder) = 'in_stock'
               and (select on_hand from public.stock_items where id = i_built) = 1,
               'en jobb uten bestilling kan legges på lager');

  perform t.login(prod);
  v_failed := false;
  begin
    perform public.advance_job(v_stock_job, 'delivered');
  exception when others then v_failed := true;
  end;
  perform t.ok(v_failed, 'en enhet på lager leveres ikke uten bestilling');

  perform t.login(cust);
  perform t.ok(not exists (select 1 from public.ladders where id = v_ladder), 'kunder ser ikke leidere som står på lager');

  perform t.login(adm);
  perform public.confirm_order((v_order ->> 'id')::uuid);
  select id into v_job from public.production_jobs where order_id = (v_order ->> 'id')::uuid;
  perform t.login(prod);
  perform public.fulfil_job_from_stock(v_job, v_stock_job);
  perform t.ok(not exists (select 1 from public.production_jobs where id = v_job)
               and (select status from public.production_jobs where id = v_stock_job) = 'ready'
               and (select order_id from public.production_jobs where id = v_stock_job) = (v_order ->> 'id')::uuid,
               'enheten på lager tar plassen til jobben for bestillingen');
  perform t.ok((select count(*) from public.stock_movements where job_id = v_stock_job and kind = 'production_out') = 2,
               'og delene trekkes ikke en gang til');
  perform public.advance_job(v_stock_job, 'delivered');
  perform t.root();
  perform t.ok((select on_hand from public.stock_items where id = i_built) = 0
               and (select status::text from public.ladders where id = v_ladder) = 'delivered',
               'solgt fra lager: enheten er ute, og leideren er levert');
  perform t.login(cust);
  perform t.ok(exists (select 1 from public.ladders where id = v_ladder), 'og kunden ser leideren sin');

  -- ── Minimumsbeholdning ─────────────────────────────────────────────────
  perform t.login(adm);
  update public.stock_items set reorder_point = 80 where id = i_step;
  perform t.ok((select below_minimum from public.stock_overview where id = i_step), 'varer under minimum flagges');

  raise notice 'Lagertestene består.';
end $$;

-- ── Gjennomgangen 23.11.2026 ────────────────────────────────────────────────
do $$
declare
  o uuid; x uuid; y uuid; adm uuid;               -- eier, fremmed, mannskap, administrator
  v_company uuid; v_nwc_company uuid; v_vessel uuid; v_ladder uuid; v_product uuid;
  v_log uuid; v_log2 uuid; v_path text; v_kept text;
  v_failed boolean; v_count integer; v_res jsonb;
begin
  perform t.root();
  insert into auth.users (email, email_confirmed_at) values ('eier@runde2.test', now()) returning id into o;
  insert into auth.users (email, email_confirmed_at) values ('fremmed@runde2.test', now()) returning id into x;
  insert into auth.users (email, email_confirmed_at) values ('mannskap@runde2.test', now()) returning id into y;
  insert into auth.users (email, email_confirmed_at) values ('admin@nwc-runde2.test', now()) returning id into adm;
  insert into public.staff_members (email, role) values ('admin@nwc-runde2.test', 'admin');
  insert into app.gates (name, secret_hash)
  values ('forms', encode(sha256(convert_to('hemmelig', 'UTF8')), 'hex'))
  on conflict (name) do nothing;
  select id into v_product from public.products where product_number = '400-034';

  perform t.login(x); perform public.portal_bootstrap();
  perform t.login(y); perform public.portal_bootstrap();
  perform t.login(o); perform public.portal_bootstrap();
  v_company := public.create_my_company('Runde To Rederi AS', '987654325');
  insert into public.vessels (company_id, name) values (v_company, 'MS Runde') returning id into v_vessel;

  perform t.root();
  insert into public.vessel_members (vessel_id, user_id, role) values (v_vessel, y, 'crew');
  insert into public.ladders (company_id, vessel_id, product_id, serial_number, status)
  values (v_company, v_vessel, v_product, 'R2-2026-0001', 'installed')
  returning id into v_ladder;

  -- ── Medlemskap på fartøy og leider bare med samtykke ───────────────────
  perform t.login(o);
  v_failed := false;
  begin
    insert into public.vessel_members (vessel_id, user_id, role) values (v_vessel, x, 'viewer');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'ingen kan sette inn et medlem på et fartøy direkte');

  v_failed := false;
  begin
    update public.vessel_members set user_id = x where vessel_id = v_vessel and user_id = y;
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'et medlemskap på et fartøy kan ikke flyttes til en annen bruker');

  v_failed := false;
  begin
    insert into public.ladder_members (ladder_id, user_id, role) values (v_ladder, x, 'viewer');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'ingen kan sette inn et medlem på en leider direkte');

  perform t.ok(not exists (select 1 from public.profiles where user_id = x),
               'eieren ser ikke profilen til en som ikke har tilgang');

  update public.vessel_members set role = 'viewer' where vessel_id = v_vessel and user_id = y;
  perform t.root();
  perform t.ok((select role::text from public.vessel_members where vessel_id = v_vessel and user_id = y) = 'viewer',
               'eieren kan fortsatt endre rollen');
  perform t.login(o);
  delete from public.vessel_members where vessel_id = v_vessel and user_id = y;
  perform t.root();
  perform t.ok(not exists (select 1 from public.vessel_members where vessel_id = v_vessel and user_id = y),
               'og fjerne et medlem');

  -- ── Nyhetene viser ikke hvem som skrev dem ─────────────────────────────
  insert into public.posts (slug, title_no, status, published_at, author_id, author_name)
  values ('runde-to', 'Runde to', 'published', now(), adm, 'admin@nwc-runde2.test');
  perform t.anon();
  perform t.ok((select count(*) from public.posts where slug = 'runde-to') = 1, 'besøkende leser fortsatt nyhetene');
  v_failed := false;
  begin
    perform author_id from public.posts where slug = 'runde-to';
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'besøkende ser ikke forfatterens id');
  v_failed := false;
  begin
    perform author_name from public.posts where slug = 'runde-to';
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'besøkende ser ikke forfatterens navn');

  -- ── Verifiserte selskap ────────────────────────────────────────────────
  perform t.root();
  perform t.ok((select verified_at is null from public.companies where id = v_company),
               'et selskap kunden oppretter selv, er ikke verifisert');

  perform t.login(o);
  v_failed := false;
  begin
    update public.companies set org_number = '923609016' where id = v_company;
  exception when raise_exception then v_failed := true;
  end;
  perform t.ok(v_failed, 'kunden kan ikke endre organisasjonsnummeret');

  v_failed := false;
  begin
    update public.companies set verified_at = now() where id = v_company;
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'kunden kan ikke verifisere selskapet selv');

  update public.companies set name = 'Runde To Rederi' where id = v_company;
  perform t.root();
  perform t.ok((select name from public.companies where id = v_company) = 'Runde To Rederi',
               'navnet kan endres før selskapet er verifisert');

  perform t.login(adm);
  update public.companies set verified_at = now() where id = v_company;
  perform t.root();
  perform t.ok((select verified_by from public.companies where id = v_company) = adm,
               'det står hvem som verifiserte selskapet');

  perform t.login(o);
  v_failed := false;
  begin
    update public.companies set name = 'Et Annet Rederi AS' where id = v_company;
  exception when raise_exception then v_failed := true;
  end;
  perform t.ok(v_failed, 'navnet på et verifisert selskap endres bare av ansatte');
  update public.companies set city = 'Ålesund' where id = v_company;
  perform t.root();
  perform t.ok((select city from public.companies where id = v_company) = 'Ålesund',
               'kunden kan fortsatt endre adressen');

  perform t.login(adm);
  insert into public.companies (name) values ('Registrert av NWC AS') returning id into v_nwc_company;
  perform t.root();
  perform t.ok((select verified_at is not null and verified_by = adm from public.companies where id = v_nwc_company),
               'et selskap en administrator oppretter, er verifisert');

  -- ── Bilder fra det åpne vedlikeholdsskjemaet ───────────────────────────
  perform t.anon();
  perform set_config('request.headers',
    json_build_object('x-nwc-gate', 'hemmelig', 'x-nwc-client', '198.51.100.31')::text, true);
  v_res := public.submit_maintenance_report(jsonb_build_object(
    'name', 'Per', 'boat', 'MS Runde', 'serial', 'r2-2026-0001'));
  v_log := (v_res ->> 'log_id')::uuid;
  for i in 1..10 loop
    insert into storage.objects (bucket_id, name) values ('maintenance-photos', v_log || '/' || i || '.jpg');
  end loop;
  v_failed := false;
  begin
    insert into storage.objects (bucket_id, name) values ('maintenance-photos', v_log || '/11.jpg');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'høyst 10 bilder per rapport fra skjemaet');

  perform t.root();
  insert into storage.objects (bucket_id, name, metadata)
  values ('maintenance-photos', v_log || '/stor.jpg', jsonb_build_object('size', 250 * 1024 * 1024));
  perform t.anon();
  perform set_config('request.headers',
    json_build_object('x-nwc-gate', 'hemmelig', 'x-nwc-client', '198.51.100.32')::text, true);
  v_res := public.submit_maintenance_report(jsonb_build_object(
    'name', 'Pål', 'boat', 'MS Runde', 'serial', 'r2-2026-0001'));
  v_log2 := (v_res ->> 'log_id')::uuid;
  v_failed := false;
  begin
    insert into storage.objects (bucket_id, name) values ('maintenance-photos', v_log2 || '/1.jpg');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'skjemaet tar ikke imot flere bilder når døgnkvoten er brukt opp');
  perform t.ok(v_log2 is not null, 'rapporten lagres likevel');

  -- ── Opprydding i bilder som aldri ble knyttet til en rapport ───────────
  perform t.root();
  v_path := gen_random_uuid() || '/gammel.jpg';
  v_kept := v_log || '/beholdt.jpg';
  insert into storage.objects (bucket_id, name, created_at) values
    ('maintenance-photos', v_path, now() - interval '2 days'),
    ('maintenance-photos', v_kept, now() - interval '2 days');
  insert into public.maintenance_photos (maintenance_log_id, storage_path) values (v_log, v_kept);

  perform t.login(o);
  v_failed := false;
  begin
    perform public.orphan_maintenance_photos();
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'bare administratorer ser lista over løse bilder');

  perform t.login(adm);
  perform t.ok(exists (select 1 from public.orphan_maintenance_photos() where path = v_path)
               and not exists (select 1 from public.orphan_maintenance_photos() where path = v_kept),
               'lista har bare bilder uten rapport');
  delete from storage.objects where bucket_id = 'maintenance-photos' and name in (v_path, v_kept);
  perform t.root();
  perform t.ok(not exists (select 1 from storage.objects where name = v_path)
               and exists (select 1 from storage.objects where name = v_kept),
               'en administrator kan slette løse bilder, men ikke bilder i en rapport');

  -- ── Bestillinger fra nettsiden: høyst 5 i timen per besøkende ──────────
  perform t.anon();
  perform set_config('request.headers',
    json_build_object('x-nwc-gate', 'hemmelig', 'x-nwc-client', '198.51.100.33')::text, true);
  for i in 1..5 loop
    perform public.place_order(jsonb_build_object(
      'name', 'Kunde', 'email', 'kunde' || i || '@runde2.test',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_product, 'qty', 1))));
  end loop;
  v_failed := false;
  begin
    perform public.place_order(jsonb_build_object(
      'name', 'Kunde', 'email', 'kunde6@runde2.test',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_product, 'qty', 1))));
  exception when raise_exception then v_failed := true;
  end;
  perform t.ok(v_failed, 'den sjette bestillingen i timen fra samme besøkende avvises');
  perform set_config('request.headers',
    json_build_object('x-nwc-gate', 'hemmelig', 'x-nwc-client', '198.51.100.34')::text, true);
  perform public.place_order(jsonb_build_object(
    'name', 'Kunde', 'email', 'kunde7@runde2.test',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_product, 'qty', 1))));
  perform t.ok(true, 'en annen besøkende kan fortsatt bestille');
  perform set_config('request.headers', '', true);

  raise notice 'Testene fra gjennomgangen 23.11 består.';
end $$;

-- ── Bildebiblioteket ────────────────────────────────────────────────────────
do $$
declare
  m uuid; p uuid; k uuid;                         -- media, produksjon, kunde
  v_failed boolean;
begin
  perform t.root();
  insert into auth.users (email, email_confirmed_at) values ('media@bibliotek.test', now()) returning id into m;
  insert into auth.users (email, email_confirmed_at) values ('produksjon@bibliotek.test', now()) returning id into p;
  insert into auth.users (email, email_confirmed_at) values ('kunde@bibliotek.test', now()) returning id into k;
  insert into public.staff_members (email, role) values
    ('media@bibliotek.test', 'media'), ('produksjon@bibliotek.test', 'production');

  perform t.login(m);
  insert into public.media_library (storage_path, file_name, alt_no)
  values ('bibliotek/a1.jpg', 'kasse.jpg', 'Leiderkasse på dekk');
  update public.media_library set alt_en = 'Ladder case on deck' where storage_path = 'bibliotek/a1.jpg';
  perform t.ok((select created_by = m and alt_en = 'Ladder case on deck'
                from public.media_library where storage_path = 'bibliotek/a1.jpg'),
               'media legger bilder i biblioteket og skriver beskrivelsene');

  v_failed := false;
  begin
    insert into public.media_library (storage_path) values ('galleri/../privat.jpg');
  exception when check_violation then v_failed := true;
  end;
  perform t.ok(v_failed, 'biblioteket tar bare imot bilder i bibliotek/ og posts/');

  perform t.login(p);
  perform t.ok(not exists (select 1 from public.media_library), 'produksjon ser ikke biblioteket');
  v_failed := false;
  begin
    insert into public.media_library (storage_path) values ('bibliotek/p1.jpg');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'produksjon kan ikke legge bilder i biblioteket');

  perform t.login(k);
  perform t.ok(not exists (select 1 from public.media_library), 'kunder ser ikke biblioteket');
  delete from public.media_library;
  perform t.root();
  perform t.ok(exists (select 1 from public.media_library where storage_path = 'bibliotek/a1.jpg'),
               'kunder kan ikke slette fra biblioteket');

  perform t.anon();
  v_failed := false;
  begin
    perform 1 from public.media_library;
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'besøkende har ingen tilgang til biblioteket');

  perform t.login(m);
  delete from public.media_library where storage_path = 'bibliotek/a1.jpg';
  perform t.root();
  perform t.ok(not exists (select 1 from public.media_library where storage_path = 'bibliotek/a1.jpg'),
               'media kan slette fra biblioteket');

  raise notice 'Bibliotektestene består.';
end $$;

-- ── Versjoner, automatisk lagring og FAQ ────────────────────────────────────
do $$
declare
  m uuid; m2 uuid; k uuid;                        -- media, media nummer to, kunde
  v_post uuid; v_first uuid; v_deleted uuid; v_count integer; v_failed boolean;
begin
  perform t.root();
  insert into auth.users (email, email_confirmed_at) values ('media@historikk.test', now()) returning id into m;
  insert into auth.users (email, email_confirmed_at) values ('media2@historikk.test', now()) returning id into m2;
  insert into auth.users (email, email_confirmed_at) values ('kunde@historikk.test', now()) returning id into k;
  insert into public.staff_members (email, role) values ('media@historikk.test', 'media'), ('media2@historikk.test', 'media');

  -- ── Versjoner ──
  perform t.login(m);
  insert into public.posts (slug, title_no, body_no) values ('historikk', 'Første utgave', 'Tekst én') returning id into v_post;
  select id into v_first from public.post_revisions where post_id = v_post and action = 'created';
  perform t.ok(v_first is not null
               and (select changed_by = m and changed_by_name = 'media@historikk.test' from public.post_revisions where id = v_first),
               'et nytt innlegg blir første versjon, med hvem som skrev det');
  update public.posts set title_no = 'Første utgave' where id = v_post;
  perform t.ok((select count(*) from public.post_revisions where post_id = v_post) = 1,
               'en lagring uten endringer gir ingen ny versjon');
  update public.posts set title_no = 'Andre utgave', body_no = 'Tekst to', status = 'published', published_at = now() where id = v_post;
  perform t.ok((select count(*) from public.post_revisions where post_id = v_post and action = 'updated') = 1,
               'en endring gir en ny versjon');

  perform public.restore_post_revision(v_first);
  perform t.ok((select title_no = 'Første utgave' and body_no = 'Tekst én' and status = 'published'
                from public.posts where id = v_post),
               'en gammel versjon kan hentes tilbake, og innlegget beholder status');
  perform t.ok((select restored_from = v_first from public.post_revisions
                where post_id = v_post and action = 'restored'),
               'gjenopprettingen står i historikken med versjonen den kom fra');

  delete from public.posts where id = v_post;
  select id into v_deleted from public.post_revisions where post_id = v_post and action = 'deleted';
  perform t.ok(v_deleted is not null, 'et slettet innlegg blir liggende i historikken');
  perform public.restore_post_revision(v_deleted);
  perform t.ok((select status = 'draft' and title_no = 'Første utgave' from public.posts where id = v_post),
               'et slettet innlegg kan hentes tilbake, som kladd');

  v_failed := false;
  begin
    insert into public.post_revisions (post_id, action, data) values (v_post, 'updated', '{}');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'ingen kan skrive versjoner selv');
  v_failed := false;
  begin
    delete from public.post_revisions where post_id = v_post;
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'ingen kan slette historikken');

  perform t.login(k);
  perform t.ok(not exists (select 1 from public.post_revisions), 'kunder ser ikke historikken');
  v_failed := false;
  begin
    perform public.restore_post_revision(v_first);
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'kunder kan ikke hente tilbake versjoner');

  -- ── Automatisk lagring ──
  perform t.login(m);
  insert into public.post_autosaves (post_key, data) values ('ny', '{"title_no": "Halvferdig"}');
  insert into public.post_autosaves (post_key, data) values ('ny', '{"title_no": "Litt mer"}')
  on conflict (user_id, post_key) do update set data = excluded.data;
  perform t.ok((select data ->> 'title_no' from public.post_autosaves where post_key = 'ny') = 'Litt mer',
               'skjemaet lagres automatisk i en kopi per person');
  perform t.ok((select title_no from public.posts where id = v_post) = 'Første utgave',
               'den automatiske lagringen rører ikke innlegget');

  perform t.login(m2);
  perform t.ok(not exists (select 1 from public.post_autosaves), 'andre ser ikke kopien');
  v_failed := false;
  begin
    insert into public.post_autosaves (user_id, post_key, data) values (m, 'ny', '{}');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'ingen kan lagre i en annens kopi');

  perform t.login(k);
  v_failed := false;
  begin
    insert into public.post_autosaves (post_key, data) values ('ny', '{}');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'kunder har ingen automatisk lagring');

  -- ── FAQ ──
  perform t.anon();
  select count(*) into v_count from public.faq_items;
  perform t.ok(v_count = 9, 'spørsmålene fra koden er flyttet til databasen');
  perform t.login(m);
  insert into public.faq_items (question_no, answer_no, published) values ('Et nytt spørsmål?', 'Et svar.', false);
  update public.faq_items set answer_en = 'An answer.' where question_no = 'Et nytt spørsmål?';
  perform t.anon();
  perform t.ok((select count(*) from public.faq_items) = v_count, 'besøkende ser bare publiserte spørsmål');
  perform t.login(k);
  v_failed := false;
  begin
    insert into public.faq_items (question_no, answer_no) values ('Fra en kunde?', 'Svar.');
  exception when insufficient_privilege then v_failed := true;
  end;
  perform t.ok(v_failed, 'kunder kan ikke legge til spørsmål');

  raise notice 'Testene for versjoner, automatisk lagring og FAQ består.';
end $$;

rollback;
