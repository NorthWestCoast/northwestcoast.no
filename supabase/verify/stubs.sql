-- Minimal stand-in for de Supabase-styrte delene migrasjonene bruker (roller,
-- auth, storage, extensions-skjemaet og standardrettighetene Supabase gir nye
-- objekter i public). Brukes bare av supabase/verify/run.sh.
-- Minimal stand-in for the Supabase-managed pieces the migrations rely on.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create table storage.buckets (
  id text primary key, name text not null, owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  public boolean default false, avif_autodetection boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
-- Supabase's default privileges for objects created in public
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant usage on schema public     to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
