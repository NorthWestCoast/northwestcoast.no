-- Minimal stand-in for de Supabase-styrte delene migrasjonene bruker (roller,
-- auth, storage, extensions-skjemaet og standardrettighetene Supabase gir nye
-- objekter i public). Brukes av supabase/verify/run.sh og supabase/local.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create schema extensions;
create extension pgcrypto with schema extensions;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              varchar(255) unique,
  email_confirmed_at timestamptz,
  raw_app_meta_data  jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Som i Supabase: PostgREST legger JWT-en i request.jwt.claims.
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select coalesce(
       nullif(current_setting('request.jwt.claim.sub', true), ''),
       auth.jwt() ->> 'sub')::uuid $$;

create table storage.buckets (
  id text primary key, name text not null, owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  public boolean default false, avif_autodetection boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text,
  owner      uuid,
  created_at timestamptz default now(),
  metadata   jsonb,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)] $$;

grant usage on schema auth, storage, extensions to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects, storage.buckets to anon, authenticated, service_role;
grant execute on all functions in schema auth, storage to anon, authenticated, service_role;

-- Supabase's default privileges for objects created in public
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
