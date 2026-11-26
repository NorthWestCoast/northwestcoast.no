#!/usr/bin/env bash
#
# Lokalt Supabase-miljø uten Docker: Postgres bygget fra migrasjonene,
# PostgREST foran, og supabase/local/server.mjs som stedfortreder for auth og
# lagring. Se README.md i denne mappa.
#
#   bash supabase/local/start.sh           start (bygger databasen første gang)
#   bash supabase/local/start.sh --reset   bygg databasen på nytt fra migrasjonene
#
# Krever: postgresql (initdb, pg_ctl, psql) og postgrest i PATH.
#   brew install postgresql@17 postgrest
set -euo pipefail
cd "$(dirname "$0")/../.."

for tool in initdb pg_ctl psql postgrest node; do
  command -v "$tool" >/dev/null || { echo "Mangler $tool (brew install postgresql@17 postgrest)." >&2; exit 1; }
done

export LC_ALL="${LC_ALL:-en_US.UTF-8}"
DIR="${NWC_LOCAL_DIR:-/tmp/nwc-local}"
export PGHOST=127.0.0.1 PGPORT="${NWC_LOCAL_PGPORT:-54329}" PGUSER=postgres PGDATABASE=nwc
export LOCAL_JWT_SECRET="${LOCAL_JWT_SECRET:-lokal-utvikling-hemmelighet-minst-32-tegn-lang}"
export LOCAL_STORAGE_DIR="$DIR/storage"
REST_PORT="${LOCAL_POSTGREST_PORT:-54401}"
mkdir -p "$DIR"

if [ ! -d "$DIR/data" ]; then
  initdb -D "$DIR/data" -U postgres --auth=trust -E UTF8 >/dev/null
fi
if ! pg_ctl -D "$DIR/data" status >/dev/null 2>&1; then
  pg_ctl -D "$DIR/data" -l "$DIR/pg.log" -w start \
    -o "-p $PGPORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" >/dev/null
fi

run_sql() { psql -v ON_ERROR_STOP=1 -q "$@"; }
exists="$(psql -d postgres -Atc "select 1 from pg_database where datname = 'nwc'")"

if [ "${1:-}" = "--reset" ] && [ "$exists" = "1" ]; then
  pkill -f "postgrest $DIR/postgrest.conf" 2>/dev/null || true
  run_sql -d postgres -c "drop database nwc with (force)"
  for role in authenticator anon authenticated service_role; do
    run_sql -d postgres -c "drop role if exists $role"
  done
  rm -rf "$LOCAL_STORAGE_DIR"
  exists=""
fi

if [ "$exists" != "1" ]; then
  echo "Bygger databasen fra migrasjonene …"
  run_sql -d postgres -c "create database nwc"
  run_sql -f supabase/verify/stubs.sql
  export PGOPTIONS='-c search_path="$user",public,extensions -c client_min_messages=warning'
  for file in supabase/migrations/*.sql; do run_sql -1 -f "$file" >/dev/null; done
  run_sql -f supabase/seed/demo.sql
  run_sql -f supabase/seed/demo-lager.sql
  run_sql -f supabase/local/users.sql
  unset PGOPTIONS
  # Rollen PostgREST logger inn som; den bytter til anon/authenticated per forespørsel.
  run_sql -c "create role authenticator login noinherit" \
          -c "grant anon, authenticated, service_role to authenticator"
  # Som i Supabase: funksjoner i extensions-skjemaet (citext) skal være synlige.
  run_sql -c "alter role authenticator set search_path = public, extensions" \
          -c "alter role anon set search_path = public, extensions" \
          -c "alter role authenticated set search_path = public, extensions"
fi

cat > "$DIR/postgrest.conf" <<CONF
db-uri = "postgres://authenticator@127.0.0.1:$PGPORT/nwc"
db-schemas = "public"
db-anon-role = "anon"
db-extra-search-path = "public, extensions"
jwt-secret = "$LOCAL_JWT_SECRET"
server-host = "127.0.0.1"
server-port = $REST_PORT
CONF

pkill -f "postgrest $DIR/postgrest.conf" 2>/dev/null || true
postgrest "$DIR/postgrest.conf" > "$DIR/postgrest.log" 2>&1 &
trap 'kill %1 2>/dev/null || true' EXIT

echo
echo "Legg dette i .env.local og start appen med «npm run dev»:"
echo "  NEXT_PUBLIC_SUPABASE_URL=http://localhost:${LOCAL_SUPABASE_PORT:-54400}"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=$(node supabase/local/server.mjs --print-anon-key)"
echo
echo "Testbrukere: admin@nwc.test · produksjon@nwc.test · kari@demo.test · mannskap@demo.test · los@demo.test"
echo "Innloggingslenken skrives ut her når du ber om den på /logg-inn."
echo

LOCAL_POSTGREST_PORT="$REST_PORT" node supabase/local/server.mjs
