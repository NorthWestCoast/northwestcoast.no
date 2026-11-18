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

  -- 2) anon skal bare kunne lese produktkatalogen. Alt annet i public går
  --    gjennom innlogget bruker eller service-role.
  select string_agg(format('%s: anon har %s', c.relname, p.priv), E'\n' order by c.relname)
    into bad
  from pg_class c
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'v')
    and has_table_privilege('anon', c.oid, p.priv)
    and not (c.relname = 'products' and p.priv = 'SELECT');
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

  -- 4) SECURITY DEFINER-funksjoner i public skal ikke kunne kalles av
  --    anon/authenticated, og next_order_number() er bare for service-role.
  select string_agg(format('%s kan kalles av %s', p.oid::regprocedure, r.rolname), E'\n' order by p.proname)
    into bad
  from pg_proc p
  cross join (values ('anon'), ('authenticated')) r(rolname)
  where p.pronamespace = 'public'::regnamespace
    and (p.prosecdef or p.proname = 'next_order_number')
    and has_function_privilege(r.rolname, p.oid, 'EXECUTE');
  if bad is not null then
    raise exception E'Regel 4 brutt - funksjon i public er kallbar via API-et:\n%', bad;
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

  raise notice 'Sikkerhetsreglene holder (5 av 5).';
end $$;
