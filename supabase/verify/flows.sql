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
  perform t.ok((select count(*) from storage.objects) = 1, 'bildene kan hentes mens delingen er aktiv');

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

rollback;
