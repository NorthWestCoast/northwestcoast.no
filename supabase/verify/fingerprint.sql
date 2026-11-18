-- Strukturelt fingeravtrykk: én rad per kategori med antall og en sjekksum.
-- Kjøres likt mot den lokale gjenskapingen og mot produksjon, så to databaser
-- kan sammenlignes uten å diffe hele skjemaet. Avviker en kategori, grav videre
-- i akkurat den. Forutsetter search_path = "$user", public, extensions.
with items as (
  select 'columns' cat, c.relname||'.'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),'')||':'||a.attgenerated::text||a.attidentity::text k
  from pg_attribute a join pg_class c on c.oid=a.attrelid
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where c.relnamespace='public'::regnamespace and c.relkind in ('r','v') and a.attnum>0 and not a.attisdropped
  union all
  select 'constraints', conrelid::regclass::text||'.'||conname||':'||contype::text||':'||pg_get_constraintdef(oid)
  from pg_constraint where connamespace='public'::regnamespace and contype<>'n'
  union all
  select 'indexes', indexdef from pg_indexes where schemaname='public'
  union all
  select 'policies', tablename||'.'||policyname||':'||cmd||':'||array_to_string(roles,',')||':'||coalesce(qual,'')||':'||coalesce(with_check,'')
  from pg_policies where schemaname='public'
  union all
  select 'functions', p.oid::regprocedure::text||':'||p.prosecdef||':'||p.provolatile::text||':'||coalesce(p.proconfig::text,'')||':'||coalesce(p.proacl::text,'')||':'||md5(pg_get_functiondef(p.oid))
  from pg_proc p where pronamespace in ('public'::regnamespace,'app'::regnamespace)
  union all
  select 'triggers', tgrelid::regclass::text||'.'||tgname||':'||pg_get_triggerdef(oid)
  from pg_trigger where not tgisinternal and tgrelid in (select oid from pg_class where relnamespace='public'::regnamespace)
  union all
  select 'views', c.relname||':'||coalesce(c.reloptions::text,'')||':'||md5(pg_get_viewdef(c.oid))
  from pg_class c where relnamespace='public'::regnamespace and relkind='v'
  union all
  select 'enums', t.typname||':'||string_agg(e.enumlabel,',' order by e.enumsortorder)
  from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typnamespace='public'::regnamespace group by t.typname
  union all
  select 'rel_acl_rls', relname||':'||relkind::text||':'||relrowsecurity||':'||relforcerowsecurity||':'||coalesce(relacl::text,'')
  from pg_class where relnamespace='public'::regnamespace and relkind in ('r','v','S')
  union all
  select 'comments', c.relname||'.'||coalesce(a.attname,'')||':'||d.description
  from pg_description d join pg_class c on c.oid=d.objoid and d.classoid='pg_class'::regclass
  left join pg_attribute a on a.attrelid=c.oid and a.attnum=d.objsubid and d.objsubid>0
  where c.relnamespace='public'::regnamespace
  union all
  select 'extensions', extname||':'||extnamespace::regnamespace::text from pg_extension where extname in ('citext','pgcrypto')
  union all
  select 'schema_app_acl', nspname||':'||coalesce(nspacl::text,'') from pg_namespace where nspname='app'
  union all
  select 'buckets', id||':'||public||':'||coalesce(file_size_limit::text,'')||':'||coalesce(allowed_mime_types::text,'') from storage.buckets
)
select cat, count(*) n, md5(string_agg(k, E'\n' order by k)) h from items group by cat order by cat;
