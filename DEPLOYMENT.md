# Deploy – NorthWest Coast

Vercel-prosjekt: **`northwestcoast-no`** (team `tobias-remme-jensens-projects`).
Serverless-region: **`fra1` (Frankfurt)**, satt i `vercel.json` – samme sted som
Supabase-prosjektet, så databasekall ikke krysser Atlanteren.

## 1. Slik henger det sammen

- **Ingen service-role-nøkkel.** Appen kjører bare med den publiserbare
  nøkkelen og sesjonen til den som er innlogget (eller den anonyme besøkende).
  RLS er autorisasjonslaget. Det som krever mer enn brukeren selv har lov til
  (ta imot en bestilling, kvittere ut et produksjonssteg, løse inn en
  invitasjon) gjøres av `SECURITY DEFINER`-funksjoner i databasen, som
  autoriserer selv. Se `docs/PORTAL.md`.
- **Databasen er fasit, e-post er et tillegg.** Bestillinger, henvendelser og
  vedlikeholdsrapporter lagres og varsles i portalen uansett. Uten
  `RESEND_API_KEY` virker alt, men ingen får e-post.
- **Innhold uten deploy.** Priser (`/admin/priser`) og nyheter (`/admin/nyheter`)
  ligger i databasen. Nettsiden mellomlagrer dem i inntil en time, og admin
  nullstiller mellomlageret når noe lagres.

## 2. Miljøvariabler

| Variabel | Påkrevd | Til hva |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Ja | Databasen, innlogging og fillagring |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ja | Den publiserbare nøkkelen |
| `RESEND_API_KEY` | For e-post | Kvitteringer og varsler på e-post |
| `RESEND_FROM_EMAIL` | For e-post | Avsender på et domene som er verifisert i Resend, f.eks. `noreply@northwestcoast.no` |
| `CONTACT_TO_EMAIL` | For e-post | Mottaker hos NWC (standard `arve@astep.no`) |
| `ORDER_TO_EMAIL`, `MAINTENANCE_TO_EMAIL` | Nei | Egne mottakere; faller tilbake på `CONTACT_TO_EMAIL` |
| `NEXT_PUBLIC_SITE_URL` | Nei | Se under |

**Status:** i Vercel (produksjon) er `NEXT_PUBLIC_SUPABASE_URL` og
`NEXT_PUBLIC_SUPABASE_ANON_KEY` satt, og ingenting annet. Nettsiden, innlogging
og portalen virker dermed, men appen sender ikke e-post før `RESEND_API_KEY` er
lagt inn og avsenderdomenet er verifisert i Resend (Domains → DNS-oppføringer).

```bash
vercel link                       # én gang, knytter mappa til prosjektet

# Det som gjenstår for e-post:
vercel env add RESEND_API_KEY production   # hemmelig: tastes inn, limes aldri i en chat
printf 'noreply@northwestcoast.no' | vercel env add RESEND_FROM_EMAIL production
printf 'arve@astep.no'             | vercel env add CONTACT_TO_EMAIL production

# Forhåndsvisninger trenger de samme to Supabase-variablene:
printf 'https://mlmzroxnvbocftiqwotd.supabase.co' | vercel env add NEXT_PUBLIC_SUPABASE_URL preview
printf 'sb_publishable_Pk-KbB9CuQn9eMPnmFjuWA_OHlQ9ABi' | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
```

Den publiserbare nøkkelen er ment å ligge åpent; den sendes uansett med i
nettleserbundelen.

### SUPABASE_SERVICE_ROLE_KEY brukes ikke

Appen bruker ikke service-role-nøkkelen, og den skal ikke settes. Ligger den
igjen i et miljø, fjern den:

```bash
vercel env rm SUPABASE_SERVICE_ROLE_KEY production
vercel env rm SUPABASE_SERVICE_ROLE_KEY preview
```

En nøkkel som omgår RLS og ikke er i bruk er bare en risiko. Har den ligget i
et miljø, vurder å rotere den i Supabase (Project Settings → API).

### NEXT_PUBLIC_SITE_URL – vent med denne

La den stå tom til `northwestcoast.no` faktisk er koblet til prosjektet.
`lib/site.ts` velger da selv: det stabile produksjonsdomenet i produksjon
(`VERCEL_PROJECT_PRODUCTION_URL`) og deploy-adressen i forhåndsvisninger
(`VERCEL_URL`). Settes variabelen før domenet er koblet til, peker
canonical-lenker, sitemap og lenkene i e-postene på et domene som ikke svarer.

## 3. Supabase

### Pro-nivå

Gratisnivået pauser prosjektet etter omtrent en uke uten trafikk. Da stopper
innlogging, bestilling og Min side av seg selv, og nettsiden faller tilbake på
reserveprislista. Prosjektet må stå på Pro i produksjon.

### Migrasjoner

```bash
npm run db:verify   # kjører alle migrasjoner på en tom, lokal Postgres og tester tilgangsreglene
npm run db:push     # legger nye migrasjoner på Supabase-prosjektet
npm run db:types    # genererer lib/supabase/database.types.ts
```

Kjør `db:verify` før `db:push`. Mangler en policy eller funksjon, er løsningen
en ny migrasjon – ikke en nøkkel med flere rettigheter.

### Adresser for innlogging

Supabase → Authentication → URL Configuration. Uten disse avvises lenken i
e-posten med «redirect not allowed»:

- **Site URL:** `https://northwestcoast-no.vercel.app` (byttes til
  `https://northwestcoast.no` når domenet er koblet til)
- **Redirect URLs:**
  - `https://northwestcoast-no.vercel.app/auth/callback`
  - `https://northwestcoast-no-*.vercel.app/auth/callback` – for forhåndsvisninger
  - `https://northwestcoast.no/auth/callback` – når domenet er koblet til

### Egen SMTP for innloggings-e-post

Supabase → Authentication → Emails → SMTP Settings, pek på Resend (samme
verifiserte avsenderdomene som over).

Innloggingslenken sendes av Supabase, ikke av appen, så dette gjelder selv om
`RESEND_API_KEY` er satt i Vercel. Den innebygde e-posten i Supabase leverer
bare til medlemmer av Supabase-organisasjonen og har en svært lav grense
(noen få i timen). Uten egen SMTP kan altså ingen kunder logge inn eller
opprette konto, og avsenderadressen blir ikke NWC sin.

### Innloggingslenke som virker på tvers av enheter

Standardlenken fra Supabase (`/auth/callback?code=…`) må åpnes i samme
nettleser som ba om den. Ber man om lenken på PC-en og åpner e-posten på
mobilen, feiler den. `app/auth/confirm/route.ts` tar i stedet imot en
token-hash, som kan løses inn hvor som helst.

Supabase → Authentication → Emails → Templates. Bytt lenken i malene
«Magic Link» og «Confirm signup» til:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Lenken bygges av Site URL, så den må peke på riktig domene. Inntil malene er
endret brukes `/auth/callback` som før.

## 4. Lokal utvikling

Se `supabase/local/README.md`: en lokal Postgres bygget fra migrasjonene, med
PostgREST, demodata og testbrukere. Det sendes ingen e-post, og ingenting
rører produksjon.

## 5. Områder og ruter

| Sti | Hvem | Merknad |
|---|---|---|
| `/`, `/produkt`, `/bestill`, `/nyheter` … | Alle | Norsk på rot, engelsk under `/en` |
| `/logg-inn` | Alle | Innlogging og ny konto i samme skjema (lenke på e-post) |
| `/auth/callback` | – | Veksler standardlenken (`code`) inn i en sesjon og sender videre |
| `/auth/confirm` | – | Det samme for token-hash-lenken, som virker på tvers av enheter |
| `/minside` | Innloggede | Kunder: selskap, fartøy, leidere, bestillinger, service |
| `/admin` | Administratorer | Bestillinger, kunder, priser, nyheter, ansatte |
| `/produksjon` | Produksjon og administratorer | Tavle, jobber, steg, produksjonsnummer, forsendelse |
| `/los/[token]` | Alle med lenken | Delt tilstandsrapport, uten innlogging |

Tre steder må kjenne til et nytt innlogget område, ellers gir det 404 eller
slipper uinnloggede inn på en tom side:

- `next.config.mjs` → `rewrites()`: lista `skip` holder områdene utenfor
  språkskallet. Uten `produksjon` der ville `/produksjon/<id>` blitt skrevet om
  til `/no/produksjon/<id>`.
- `middleware.ts` → `matcher`, og `PROTECTED` i `lib/supabase/middleware.ts`:
  uinnloggede sendes til `/logg-inn?neste=<stien>`.
- `app/auth/callback/route.ts`: uten et bestemt mål lander kunder på
  `/minside`, administratorer på `/admin` og produksjon på `/produksjon`.
  `/auth/confirm` sender alle til `/minside` (eller til `neste`); ansatte
  bytter område nederst i menyen.

Gamle adresser fra det forrige nettstedet (`/no/products`, `/en/news` osv.)
videresendes i `redirects()` i `next.config.mjs`.

## 6. Administratorer og produksjon

Rollene ligger i tabellen `staff_members`: e-postadresse og rolle (`admin`
eller `production`). Rollen gjelder bare når adressen er verifisert, altså
når personen har logget inn med lenken fra e-posten.

**De første administratorene** legges inn med SQL (Supabase → SQL Editor):

```sql
insert into public.staff_members (email, role)
values ('arve@astep.no', 'admin')
on conflict (email) do update set role = excluded.role;
```

Personen logger så inn på `/logg-inn` og havner på `/admin`. Det trengs ingen
ut- og innlogging etterpå; rollen leses fra databasen på hver forespørsel.

**Alle senere** legges til, endres og fjernes i **`/admin/ansatte`**.
Produksjonsansatte får rollen `production`: de ser `/produksjon`, men verken
bestillinger, kunder eller priser. Databasen nekter å fjerne eller nedgradere
den siste administratoren.

Kunder trenger ingen invitasjon. Alle kan opprette konto på `/logg-inn`,
registrere selskapet sitt og legge til leidere med produksjonsnummeret.

## 7. Verifisering etter deploy

Rekkefølgen er avhengighetsstyrt – hvert steg låser opp det neste.

1. **Innlogging.** `/logg-inn` → lenke i innboksen → lander på `/minside`.
   Prøv også å åpne lenken på en annen enhet enn den som ba om den.
   Feiler typisk på redirect-adresser, manglende egen SMTP eller e-postmaler
   som ikke peker på `/auth/confirm` (punkt 3).
2. **Administrator.** Legg adressen i `staff_members` (punkt 6), logg inn,
   åpne `/admin`. Legg til en produksjonsansatt i `/admin/ansatte`.
3. **Bestilling uten innlogging.** Send inn på `/bestill`. Bestillingen skal
   ligge i `/admin/bestillinger` med ordrenummer (`NWC-2026-0001`) og riktig
   sum, administratorene får varsel i portalen, og kunden får kvittering på
   e-post.
4. **Produksjon.** Bekreft bestillingen i admin. Jobben skal dukke opp på
   `/produksjon`. Kvitter ut stegene, registrer produksjonsnummeret, marker
   som sendt og levert. Bestillingen får status levert, og leideren finnes i
   registeret.
5. **Vedlikehold med bilde tatt på mobil.** Send inn på `/vedlikehold` med et
   bilde, uten å være innlogget. Rapporten og bildet skal ligge i
   `/admin/vedlikehold`. E-posten oppgir antall bilder og lenker til admin
   (bildene ligger i en privat bøtte og sendes ikke som lenker).
6. **Kunde.** Opprett en ny konto med en annen adresse, registrer selskap og
   be om tilgang til leideren fra steg 4 med produksjonsnummeret.
   Forespørselen skal havne hos den som styrer leideren, eller i
   `/admin/tilgang` når leideren ikke har en eier ennå.
7. **Nyhet.** Publiser et innlegg i `/admin/nyheter`. Det skal stå på
   `/nyheter` og forsiden uten ny deploy.
8. **Stikkprøve på isolasjon.** Logg inn som en kunde fra et annet selskap og
   bekreft at fartøy og leidere til det første ikke er synlige. Det samme
   testes i `npm run db:verify`, men fortjener én bekreftelse gjennom appen.

## 8. Priser og nyheter

- Prislista på nettsiden, i bestillingsskjemaet og i kalkulatoren leses fra
  `products` og vedlikeholdes i **`/admin/priser`**. Ordresummen regnes ut av
  `place_order()` i databasen, aldri av det klienten sender.
- Nyhetene leses fra `posts` og skrives i **`/admin/nyheter`**. Nye innlegg
  får sin egen side første gang noen åpner den.
- Begge mellomlagres i inntil en time og nullstilles når admin lagrer
  (`revalidateTag('catalog')` og `revalidateTag('posts')`).
- `lib/pricing.ts` og `lib/articles.ts` er bare RESERVE hvis databasen ikke
  svarer. Ikke endre priser eller skriv nyheter der. Reserveprislista kan ikke
  bestilles fra: uten databasen avviser `/api/order` bestillingen med beskjed
  om å ringe.
- Forsidebilder til nyheter ligger i bøtta `public-media`. `next.config.mjs`
  slipper bare `*.supabase.co/storage/v1/object/public/**` gjennom
  bildeoptimaliseringen.

## 9. Kjent status på prosjektet

- **Ingen egendefinert domene er koblet til ennå.** Prosjektet svarer bare på
  `northwestcoast-no.vercel.app`. `northwestcoast.no` må legges til under
  Settings → Domains.
- **Vercel Authentication (SSO) står på for alt utenom egendefinerte domener.**
  Forhåndsvisninger krever derfor Vercel-innlogging. Delingslenkene til los
  (`/los/[token]`) må kunne åpnes av utenforstående, så de testes på
  produksjonsdomenet, eller med SSO slått av for forhåndsvisninger.
- `next.config.mjs` tillater fortsatt `v0.dev` og `*.vercel.app` i
  `frame-ancestors`. Det var for v0-forhåndsvisninger og bør strammes inn når
  produksjonsdomenet er på plass.
- Sendte e-poster logges ikke lenger i `email_log` (det krevde service-role).
  Feilet utsending står i Vercel-loggen som `[mail] <mal> feilet`, og
  leveringsstatus ses i Resend.
