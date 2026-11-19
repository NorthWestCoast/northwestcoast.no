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
  perform t.ok((public.portal_bootstrap() ->> 'redeemed')::integer = 1, 'invitasjonen løses inn ved første innlogging');
  perform t.ok(exists (select 1 from public.vessels where id = v_vessel), 'den inviterte ser selskapets fartøy');

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

  raise notice 'Sikkerhetstestene består.';
end $$;

rollback;
