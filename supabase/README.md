# Supabase – NorthWest Coast

Prosjekt: **northwestcoast** (`mlmzroxnvbocftiqwotd`), region **eu-central-1
(Frankfurt)**, Postgres 17.

## Viktig om drift

Gratisnivået **pauser prosjektet etter ~7 dagers inaktivitet**. Da svarer
databasen ikke, og bestilling, innlogging, admin og prisene på nettsiden
slutter å virke. Prosjektet har vært pauset to ganger mens dette ble bygget.
Produksjon må stå på Pro-planen.

## Migrasjoner

`migrations/` er en **1:1-kopi av historikken i databasen**
(`supabase_migrations.schema_migrations`): samme versjon, samme navn, samme
SQL. `supabase db push` er derfor en no-op, og en tom database bygget fra
filene får nøyaktig samme skjema som produksjon.

Slik legger du til en endring:

1. Skriv SQL-en. Kjør den mot prosjektet (`npm run db:push`, eller Supabase
   MCP `apply_migration`).
2. Hent versjonen databasen ga den:
   `select version, name from supabase_migrations.schema_migrations order by version desc limit 1;`
3. Lagre SQL-en som `migrations/<versjon>_<navn>.sql`. Filnavnet **må** bruke
   versjonen fra databasen. MCP setter den til tidspunktet migrasjonen kjørte,
   så et selvvalgt tidsstempel gir en ny runde med drift.
4. `npm run db:verify -- --update`, og kjør `verify/fingerprint.sql` mot
   produksjon. Alle sjekksummer skal være like.
5. Regenerer typene: `npm run db:types`. `lib/supabase/database.types.ts` er
   generert og skal ikke redigeres for hånd.

Endre aldri en migrasjon som allerede er kjørt. Lag en ny.

### `npm run db:verify`

Kjører alle migrasjoner på en tom, midlertidig Postgres (krever lokal
Postgres, Mac: `brew install postgresql@17`) uten å røre noen ekte database:

- migrasjonene må la seg kjøre fra scratch
- `verify/assertions.sql` sjekker sikkerhetsreglene under
- `verify/fingerprint.sql` gir én sjekksum per kategori (kolonner,
  constraints, indekser, policyer, funksjoner, triggere, rettigheter ...),
  som sammenlignes med `verify/expected-fingerprint.txt`

`expected-fingerprint.txt` er fingeravtrykket av produksjon da det ble skrevet
(2026-11-18, etter `20261118223552`). Kjør `verify/fingerprint.sql` i Supabase
SQL-editor for å sammenligne med live-databasen.

## Sikkerhetsmodell

- **RLS på alle tabeller.** Tilgang følger kjeden leider → fartøy → selskap.
  Server-komponenter leser gjennom brukerens egen sesjon, slik at et glemt
  WHERE-ledd ikke kan lekke data mellom rederier.
- **Hjelpefunksjonene for RLS ligger i skjemaet `app`**, ikke `public`.
  PostgREST eksponerer kun `public`, så funksjonene er ikke kallbare som RPC.
  De er `SECURITY DEFINER` fordi et policy på `company_members` som slår opp i
  `company_members` ellers gir uendelig rekursjon.
- **Ansatt = `app_metadata.staff` i JWT-en**, lest av `app.is_staff()`. Settes
  med SQL på brukeren; brukeren kan ikke selv endre `app_metadata`.
- **`ladder_status` er et view med `security_invoker = true`.** Uten det
  kjører viewet som eier og omgår RLS fullstendig.
- **Storage-bøttene er private uten policyer.** All lesing skjer med signerte
  URL-er generert på serveren.
- **Priser:** `products` er sannhetskilden, og nettsiden leser derfra.
  `product_price_history` loggfører hver endring (trigger) og kan bare leses av
  ansatte.
- **Los-deling:** tabellene `ladder_state_shares` og `ladder_state_photos`
  finnes og har ingen anon-policy, men funksjonen er ikke bygget i appen ennå.
  Når den bygges skal den offentlige siden serveres av en route handler med
  service-role etter at tokenet er verifisert server-side. Et anon-policy basert
  på token ville latt tokenet reise i en klientspørring.

### Regler for nye tabeller og funksjoner

Supabase gir alle nye objekter i `public` **alle rettigheter for `anon` og
`authenticated`**. RLS stopper ikke alt (`TRUNCATE` styres ikke av RLS, og en
funksjon i `public` er kallbar som `/rest/v1/rpc/<navn>`). Hver migrasjon som
lager noe nytt må derfor stramme inn selv:

```sql
revoke all on public.ny_tabell from anon, authenticated;
grant select on public.ny_tabell to authenticated;   -- bare det som trengs

revoke execute on function public.ny_funksjon() from public, anon, authenticated;
```

`npm run db:verify` feiler hvis dette glemmes. To ting ble funnet på den måten
2026-11-18: prishistorikken hadde fulle rettigheter for anon og authenticated,
og `next_order_number()` var kallbar for hvem som helst.

## Kjent rot

- Tabellen `public.leads` er fra et tidligere forsøk (2026-07-31), er tom
  (0 rader), ikke brukt av koden, og har RLS på uten policyer (altså avvist for
  alle; Supabase melder den som INFO). `contact_requests` erstatter den. Kan
  slettes med en ny migrasjon når NWC bekrefter at den ikke brukes.
- `cabinetNumber` i den opprinnelige prislista er inkonsistent: samme nummer
  brukes på ulike skapmodeller (400-062 er både ASC-LC3-5 og ASC-LC6-8;
  400-063 er tre ulike). Skapene er derfor seedet på modellnavn. De offisielle
  400-0xx-numrene må avklares med NWC.
- 2 m-leideren ligger inne med plassholdernummeret `ARG-2ML` og «pris på
  forespørsel». Nummer, trinn og pris settes i `/admin/priser`.
- Supabase-rådgiverne melder `multiple_permissive_policies` (de `*_manage`
  FOR ALL-policyene overlapper `*_select` på SELECT), 7 FK-er uten indeks og
  ubrukte indekser. Alle er ytelsesvarsler som ikke betyr noe ved dagens
  datamengde, og å splitte policyene ville endre sikkerhetsmodellen. Se på dem
  igjen når tabellene har titusener av rader.
