# Supabase – NorthWest Coast

Prosjekt: **northwestcoast**, region **eu-central-1 (Frankfurt)**.

## Viktig om drift

Gratisnivået **pauser prosjektet etter ~7 dagers inaktivitet**. Da svarer
databasen ikke, og Min side slutter å virke av seg selv. Produksjon må stå på
Pro-planen.

## Migrasjoner

Filene i `migrations/` er kjørt i denne rekkefølgen og er allerede anvendt på
prosjektet. Ny migrasjon legges til med tidsstempel-prefiks og kjøres med
`npm run db:push` (krever Supabase CLI og innlogging).

Typene regenereres med `npm run db:types` etter skjemaendringer.
`lib/supabase/database.types.ts` er i dag håndskrevet og dekker kun tabellene
fase 0 bruker – erstatt den med full generert output når dashboardet i fase 2
begynner å lese fartøy, leidere og service.

## Sikkerhetsmodell

- **RLS på alle tabeller.** Tilgang følger kjeden leider → fartøy → selskap.
  Server-komponenter leser gjennom brukerens egen sesjon, slik at et glemt
  WHERE-ledd ikke kan lekke data mellom rederier.
- **Hjelpefunksjonene ligger i skjemaet `app`**, ikke `public`. PostgREST
  eksponerer kun `public`, så funksjonene er ikke kallbare som RPC. De er
  `SECURITY DEFINER` fordi et policy på `company_members` som slår opp i
  `company_members` ellers gir uendelig rekursjon.
- **`ladder_status` er et view med `security_invoker = true`.** Uten det
  kjører viewet som eier og omgår RLS fullstendig.
- **Storage-bøttene er private uten policyer.** All lesing skjer med signerte
  URL-er generert på serveren.
- **Los-deling har ingen anon-policy.** Den offentlige siden serveres av en
  route handler med service-role etter at tokenet er verifisert server-side.
  Et anon-policy basert på token ville latt tokenet reise i en klientspørring.

## Kjent rot i eksisterende data

- Tabellen `public.leads` er fra et tidligere forsøk, er tom (0 rader) og har
  RLS på uten policyer (altså avvist for alle). `contact_requests` erstatter
  den. Kan slettes når NWC bekrefter at den ikke brukes.
- `cabinetNumber` i den opprinnelige prislista er inkonsistent: samme nummer
  brukes på ulike skapmodeller (400-062 er både ASC-LC3-5 og ASC-LC6-8;
  400-063 er tre ulike). Skapene er derfor seedet på modellnavn. De offisielle
  400-0xx-numrene må avklares med NWC.
