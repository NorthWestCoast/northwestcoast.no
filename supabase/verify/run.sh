#!/usr/bin/env bash
#
# Verifiserer migrasjonene uten å røre noen ekte database:
#   1. kjører alle filer i supabase/migrations på en tom, midlertidig Postgres
#   2. sjekker sikkerhetsreglene i assertions.sql
#   3. kjører flyttestene i flows.sql (hvem får gjøre hva)
#   4. sammenligner strukturen med expected-fingerprint.txt
#
#   npm run db:verify              kjør og sammenlign
#   npm run db:verify -- --update  skriv nytt fingeravtrykk (etter en
#                                  bevisst skjemaendring)
#   npm run db:types               generer lib/supabase/database.types.ts
#                                  fra samme midlertidige database
#
# expected-fingerprint.txt er fingeravtrykket av produksjon på det tidspunktet
# det ble skrevet. Etter en ny migrasjon: kjør --update, kjør
# fingerprint.sql mot produksjon, og se at sjekksummene er like.
#
# Krever Postgres (initdb, pg_ctl, psql) i PATH. Mac: brew install postgresql@17
set -euo pipefail

cd "$(dirname "$0")/../.."

for tool in initdb pg_ctl psql; do
  command -v "$tool" >/dev/null || {
    echo "Mangler $tool. Installer Postgres (Mac: brew install postgresql@17)." >&2
    exit 1
  }
done

# macOS: postmaster starter ikke uten en gyldig locale.
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
PORT="${DB_VERIFY_PORT:-54329}"
DIR="$(mktemp -d)"

cleanup() {
  pg_ctl -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DIR"
}
trap cleanup EXIT

initdb -D "$DIR/data" -U postgres --auth=trust -E UTF8 >/dev/null
# Bare loopback-TCP: unix-socket-stien blir for lang i en midlertidig mappe.
pg_ctl -D "$DIR/data" -l "$DIR/pg.log" -w start \
  -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" >/dev/null

run_sql() { psql -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

run_sql -c "create database nwc" >/dev/null
run_sql -d nwc -f supabase/verify/stubs.sql

# Samme search_path som Supabase, så typer skrives likt i fingeravtrykket.
export PGOPTIONS='-c search_path="$user",public,extensions'

count=0
for file in supabase/migrations/*.sql; do
  if ! run_sql -d nwc -1 -f "$file" >/dev/null; then
    echo "FEIL i $file" >&2
    exit 1
  fi
  count=$((count + 1))
done
echo "OK: $count migrasjoner kjørte fra scratch."

run_sql -d nwc -f supabase/verify/assertions.sql

# Flyttestene simulerer kunde, utenforstående, admin og produksjon gjennom
# hele løpet fra bestilling til deling med los. Ruller tilbake etter seg.
run_sql -d nwc -f supabase/verify/flows.sql

if [ "${1:-}" = "--types" ]; then
  PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGDATABASE=nwc \
    node supabase/verify/gen-types.mjs lib/supabase/database.types.ts
  exit 0
fi

actual="$(run_sql -d nwc -At -F ' | ' -f supabase/verify/fingerprint.sql)"
expected_file="supabase/verify/expected-fingerprint.txt"

if [ "${1:-}" = "--update" ]; then
  printf '%s\n' "$actual" > "$expected_file"
  echo "Skrev $expected_file. Kjør fingerprint.sql mot produksjon og sammenlign."
  exit 0
fi

if [ ! -f "$expected_file" ]; then
  echo "Mangler $expected_file. Kjør: npm run db:verify -- --update" >&2
  exit 1
fi

if diff <(cat "$expected_file") <(printf '%s\n' "$actual"); then
  echo "OK: strukturen er lik expected-fingerprint.txt."
else
  echo >&2
  echo "Strukturen avviker fra expected-fingerprint.txt (linjene over)." >&2
  echo "Er endringen bevisst, kjør: npm run db:verify -- --update" >&2
  exit 1
fi
