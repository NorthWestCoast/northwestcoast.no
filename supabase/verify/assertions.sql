-- Sikkerhetsregler som skal holde etter at alle migrasjoner er kjørt.
-- Hver regel finnes fordi den ble brutt en gang (se supabase/README.md).
--
-- Supabase gir nye objekter i public alle rettigheter for anon og
-- authenticated. Hver migrasjon som lager en tabell eller funksjon må derfor
-- stramme inn selv. RLS dekker ikke alt: TRUNCATE styres ikke av RLS, og en
-- funksjon i public er kallbar som /rest/v1/rpc/<navn>.
do $$
declare
  bad text;
begin
  -- 1) Ingen tabell eller view skal gi anon/authenticated TRUNCATE, TRIGGER
  --    eller REFERENCES. Ingen API-flate trenger dem.
  select string_agg(format('%s: %s har %s', c.relname, r.rolname, p.priv), E'\n' order by c.relname)
    into bad
  from pg_class c
  cross join (values ('anon'), ('authenticated')) r(rolname)
  cross join (values ('TRUNCATE'), ('TRIGGER'), ('REFERENCES')) p(priv)
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'v')
    and has_table_privilege(r.rolname, c.oid, p.priv);
  if bad is not null then
    raise exception E'Regel 1 brutt - farlige tabellrettigheter:\n%', bad;
  end if;

  -- 2) anon skal bare kunne lese produktkatalogen, nyhetene og galleriet (RLS
  --    slipper bare publiserte innlegg og bilder gjennom). Alt annet går
  --    gjennom innlogget bruker eller en av funksjonene i regel 4.
  select string_agg(format('%s: anon har %s', c.relname, p.priv), E'\n' order by c.relname)
    into bad
  from pg_class c
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'v')
    and has_table_privilege('anon', c.oid, p.priv)
    and not (c.relname in ('products', 'posts', 'gallery_images') and p.priv = 'SELECT');
  if bad is not null then
    raise exception E'Regel 2 brutt - anon har for mye tilgang:\n%', bad;
  end if;

  -- 3) anon skal ikke kunne bruke sekvenser (ordrenummer).
  select string_agg(format('%s: anon har %s', c.relname, p.priv), E'\n' order by c.relname)
    into bad
  from pg_class c
  cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) p(priv)
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'S'
    and has_sequence_privilege('anon', c.oid, p.priv);
  if bad is not null then
    raise exception E'Regel 3 brutt - anon kan bruke sekvens:\n%', bad;
  end if;

  -- 4) En SECURITY DEFINER-funksjon i public er kallbar som /rest/v1/rpc/<navn>
  --    og kjører med eierens rettigheter. Hver slik funksjon autoriserer selv,
  --    og må derfor stå på lista under før den kan åpnes. En ny funksjon som
  --    ikke står her, får testen til å feile i stedet for å bli åpnet stille.
  select string_agg(format('%s kan kalles av %s', p.oid::regprocedure, r.rolname), E'\n' order by p.proname)
    into bad
  from pg_proc p
  cross join (values ('anon'), ('authenticated')) r(rolname)
  where p.pronamespace = 'public'::regnamespace
    and (p.prosecdef or p.proname = 'next_order_number')
    and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
    and not (
      -- Åpne skjema på nettsiden (uten innlogging). Alle er strupet i databasen.
      p.proname in ('place_order', 'submit_contact_request', 'subscribe_newsletter',
                    'confirm_newsletter', 'unsubscribe_newsletter',
                    'submit_maintenance_report', 'finish_maintenance_report',
                    'get_ladder_share', 'get_certificate')
      or (
        r.rolname = 'authenticated'
        and p.proname in (
          'portal_bootstrap', 'create_my_company', 'mark_notifications_read',
          'request_ladder_access', 'decide_ladder_access', 'install_ladder',
          'complete_ladder_task', 'create_ticket', 'reply_ticket', 'set_ticket_status',
          'request_service', 'cancel_service_booking',
          'confirm_order', 'set_production_step', 'assign_job_serial', 'advance_job',
          'place_cabinet', 'issue_ladder_certificate',
          'accept_invitation', 'decline_invitation',
          'receive_purchase_line', 'fulfil_job_from_stock')
      )
    );
  if bad is not null then
    raise exception E'Regel 4 brutt - funksjon i public er kallbar via API-et uten å stå på lista:\n%', bad;
  end if;

  -- 5) Alle tabeller i public skal ha RLS på (view-et ladder_status bruker
  --    security_invoker og er dekket av tabellene under).
  select string_agg(c.relname, ', ' order by c.relname)
    into bad
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and not c.relrowsecurity;
  if bad is not null then
    raise exception 'Regel 5 brutt - RLS er av på: %', bad;
  end if;

  -- 6) Skjemaet app er internt: ingen tabell der skal være lesbar via API-et.
  select string_agg(format('%s: %s', c.relname, r.rolname), ', ' order by c.relname)
    into bad
  from pg_class c
  cross join (values ('anon'), ('authenticated')) r(rolname)
  where c.relnamespace = 'app'::regnamespace
    and c.relkind = 'r'
    and (has_table_privilege(r.rolname, c.oid, 'SELECT')
         or has_table_privilege(r.rolname, c.oid, 'INSERT'));
  if bad is not null then
    raise exception 'Regel 6 brutt - intern tabell er tilgjengelig: %', bad;
  end if;

  -- 7) Ansattlista kan bare endres av administratorer, og en uverifisert
  --    e-postadresse gir aldri ansattrolle. Begge deler testes i flows.sql;
  --    her sjekkes bare at selve funksjonen krever verifisert adresse.
  if position('email_confirmed_at is not null' in pg_get_functiondef('app.staff_role()'::regprocedure)) = 0 then
    raise exception 'Regel 7 brutt - app.staff_role() krever ikke verifisert e-post.';
  end if;

  -- 8) Hver SECURITY DEFINER-funksjon har låst search_path. Uten det kan den
  --    som kaller, få funksjonen til å bruke sine egne objekter.
  select string_agg(p.oid::regprocedure::text, ', ') into bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if bad is not null then
    raise exception 'Regel 8 brutt - SECURITY DEFINER uten search_path: %', bad;
  end if;

  -- 9) På disse tabellene kan innloggede bare endre de kolonnene som er
  --    nevnt, aldri hele raden: ellers kan et medlemskap dateres tilbake
  --    eller en delt rapport åpnes igjen.
  select string_agg(t, ', ') into bad
  from unnest(array['public.company_members', 'public.ladder_state_shares',
                    'public.stock_items', 'public.stock_movements']) t
  where has_table_privilege('authenticated', t, 'UPDATE');
  if bad is not null then
    raise exception 'Regel 9 brutt - authenticated kan oppdatere hele raden i: %', bad;
  end if;
  if has_table_privilege('authenticated', 'public.company_members', 'INSERT') then
    raise exception 'Regel 9 brutt - medlemmer kan settes inn direkte i company_members.';
  end if;

  -- 10) Anonyme må kunne slå opp hjelpefunksjonene policyene bruker, og alle
  --     visninger leser med innloggerens egne rettigheter.
  if not has_schema_privilege('anon', 'app', 'USAGE') then
    raise exception 'Regel 10 brutt - anon mangler USAGE på skjemaet app.';
  end if;
  select string_agg(c.oid::regclass::text, ', ') into bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and not coalesce(c.reloptions, '{}') @> array['security_invoker=true'];
  if bad is not null then
    raise exception 'Regel 10 brutt - visning uten security_invoker: %', bad;
  end if;

  raise notice 'Sikkerhetsreglene holder (10 av 10).';
end $$;
