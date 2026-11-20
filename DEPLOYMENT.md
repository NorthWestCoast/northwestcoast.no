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

Unntak: når portalen flyttes til eget vertsnavn settes den til adressen som
svarer i dag, sammen med `NEXT_PUBLIC_PORTAL_URL` (se punkt 10).

Ellers: la den stå tom til `northwestcoast.no` faktisk er koblet til prosjektet.
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

Med portalen på eget vertsnavn gjelder adressene i punkt 10 i stedet for dem
under.

Supabase → Authentication → URL Configuration. Uten disse avvises lenken i
e-posten med «redirect not allowed»:

- **Site URL:** `https://northwestcoast-no.vercel.app` (byttes til
  `https://northwestcoast.no` når domenet er koblet til)
- **Redirect URLs:**
  - `https://northwestcoast-no.vercel.app/auth/callback`
  - `https://northwestcoast.no/auth/callback` – når domenet er koblet til

  Bare hele, eksakte adresser. Ikke legg inn jokertegn som
  `https://northwestcoast-no-*.vercel.app/…` for forhåndsvisninger: hvem som
  helst kan opprette et Vercel-prosjekt med et navn som passer mønsteret, og
  da kan en innloggingslenke sendes dit. Forhåndsvisninger logger man inn på
  ved å åpne lenken fra e-posten på produksjonsadressen.

### Egen SMTP for innloggings-e-post

Supabase → Authentication → Emails → SMTP Settings, pek på Resend (samme
verifiserte avsenderdomene som over).

Innloggingslenken sendes av Supabase, ikke av appen, så dette gjelder selv om
`RESEND_API_KEY` er satt i Vercel. Den innebygde e-posten i Supabase leverer
bare til medlemmer av Supabase-organisasjonen og har en svært lav grense
(noen få i timen). Uten egen SMTP kan altså ingen kunder logge inn eller
opprette konto, og avsenderadressen blir ikke NWC sin.

### Malene for innloggings-e-post

Malene ligger i `supabase/templates/` og limes inn i Supabase →
Authentication → Emails → Templates. Framgangsmåten, emnefeltene og
innstillingene som hører til (lengde på engangskoden, Redirect URLs, SMTP)
står i `supabase/templates/README.md`.

Lenken i malene går til `/auth/confirm`, der brukeren selv trykker «Logg
inn». Den virker på tvers av enheter, og den brukes ikke opp av e-postfiltre
som åpner lenker. Inntil malene er limt inn brukes Supabase sine
standardmaler og `/auth/callback`, som må åpnes i samme nettleser som ba om
lenken.

### E-post og DNS for northwestcoast.no

Domenet er verifisert som avsender i Resend (19.11.2026). Disse postene
ligger i Cloudflare og må bli stående også når nettstedet flyttes:

| Navn | Type | Verdi | Til hva |
|---|---|---|---|
| `resend._domainkey` | TXT | `p=MIGf…` | DKIM: signaturen på e-post fra Resend |
| `send` | MX | `feedback-smtp.eu-west-1.amazonses.com` (10) | Returadresse for avvisninger |
| `send` | TXT | `v=spf1 include:amazonses.com ~all` | SPF for returadressen |
| `rsend` | CNAME | `send.forge.rmta.net` (kun DNS) | Resend sin alternative returadresse |
| `@` | TXT | `v=spf1 -all` | Ingen sender e-post direkte fra roten |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=…cloudflare.net` | DMARC, rapporter til Cloudflare |

Når domenet får innbokser (Cloudflare Email Routing eller Microsoft 365) må
SPF-posten på roten byttes til leverandørens, ellers avvises e-post de
sender. `p=none` i DMARC betyr «bare overvåk»: sett `p=quarantine` når den
første e-posten fra Resend er levert og bestått, og `p=reject` senere.

### Nøkkelen for de åpne skjemaene

Skjemafunksjonene i databasen (bestilling, kontakt, vedlikehold, nyhetsbrev)
kan kalles av alle med den offentlige nøkkelen. For at ingen skal kunne
stenge et skjema for andre ved å bruke opp grensen, viser nettstedet med en
egen nøkkel at kallet kommer derfra, og oppgir hvem den besøkende er. Da
teller hvert skjema per besøkende, og kall utenom nettstedet får sin egen
lille kvote.

1. Lag en tilfeldig nøkkel og legg den i Vercel som `FORM_GATE_SECRET`
   (Production og Preview, type Sensitive). Deploy på nytt.
2. Legg sjekksummen i databasen, i Supabase sin SQL-editor (nøkkelen selv
   lagres aldri der):

   ```sql
   insert into app.gates (name, secret_hash)
   values ('forms', encode(sha256(convert_to('<nøkkelen>', 'UTF8')), 'hex'))
   on conflict (name) do update set secret_hash = excluded.secret_hash;
   ```

Rekkefølgen er viktig: når raden finnes i `app.gates`, regnes alle kall uten
riktig nøkkel som «utenom nettstedet» (20 i timen per skjema). Nettstedet må
derfor sende nøkkelen før raden legges inn. Uten rad gjelder den gamle,
felles grensen. Bekreftelses-e-posten for nyhetsbrev sendes også bare til
kall med nøkkelen når raden finnes.

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
- Sendte e-poster logges ikke lenger i `email_log` (det krevde service-role).
  Feilet utsending står i Vercel-loggen som `[mail] <mal> feilet`, og
  leveringsstatus ses i Resend.

## 10. Portalen på eget vertsnavn

Den innloggede delen kan ligge på `portal.northwestcoast.no`, mens nettstedet
ligger på hovedadressen. Det er samme kode og samme Vercel-prosjekt. Poenget
er at innloggingen ikke deler opprinnelse med det offentlige nettstedet:
sesjonscookien sendes aldri til de offentlige sidene, og portalen får en
strengere innholdsregel (CSP) enn nettstedet kan ha.

Oppsettet er to miljøvariabler, `NEXT_PUBLIC_SITE_URL` og
`NEXT_PUBLIC_PORTAL_URL`. Delingen er bare slått på når begge er satt og
vertsnavnene er ulike. Ellers ligger alt på én adresse, som i lokal utvikling
og i forhåndsvisninger, og ingenting av det som står under gjelder.

### Hva som skjer når det er slått på

| Vertsnavn | Forespørsel | Svar |
|---|---|---|
| Nettstedet | `/minside`, `/admin`, `/produksjon`, `/logg-inn`, `/auth/…`, `/los/…`, `/sertifikat/…` | 307 til samme sti på portalen. Spørringen følger med |
| Nettstedet | alt annet | som før |
| Portalen | `/` | 307 til `/minside` |
| Portalen | stiene over, `/personvern`, `/api/…`, `/_next/…`, `/images/…`, `/icons/…`, favikon, ikoner og manifest | svarer selv |
| Portalen | alt annet | 307 til samme sti på nettstedet |
| Andre (forhåndsvisninger, `localhost`, `vercel.app` etter lansering) | alt | som før, uten videresending |

- Alle svar på portalens vertsnavn har `X-Robots-Tag: noindex, nofollow` og
  portalens egen CSP. Nettstedets CSP er uendret. Et svar får aldri begge.
- `/personvern` svarer på begge vertsnavnene. Den kanoniske adressen er
  nettstedets, og det er bare der siden kan indekseres.
- `/robots.txt` og `/sitemap.xml` beskriver nettstedet. På portalen
  videresendes de dit.
- Lenker fra nettstedet til innloggingen går rett til portalen
  (`portalHref()` i `lib/site.ts`). Lenker som skrives ut eller deles, altså
  kontrollsiden på et sertifikat og lenken til en delt rapport, får
  portalens adresse (`portalOrigin()` i `lib/portal/landing.ts`).

Reglene står i `next.config.mjs` (`portalHosts()`, `hostRedirects()` og
`portalCsp()`), ikke i middleware. De offentlige sidene er statiske, og hver
middleware-kjøring faktureres. `node tests/portal-hosts.test.mts` kjører
reglene uten å starte en server.

### Slå det på

Rekkefølgen er valgt slik at innloggingen virker hele veien.

1. **Vercel.** Settings → Domains i prosjektet `northwestcoast-no`: legg til
   `portal.northwestcoast.no` på produksjon. Vercel viser da hvilken verdi
   DNS-posten skal ha.
2. **DNS.** I Cloudflare: navn `portal`, type CNAME, verdien Vercel viser,
   **kun DNS** (grå sky). Med Cloudflare som mellomledd (oransje sky) kan
   ikke Vercel utstede og fornye sertifikatet selv. Vent til domenet står
   som gyldig i Vercel. Fra da svarer hele appen også der, foreløpig uten
   vertsreglene.
3. **Supabase** → Authentication → URL Configuration:
   - **Site URL:** `https://portal.northwestcoast.no`. Lenken i
     innloggings-e-postene bygges av denne (`{{ .SiteURL }}/auth/confirm…`),
     så malene trenger ikke limes inn på nytt.
   - **Redirect URLs:** legg til `https://portal.northwestcoast.no/auth/callback`.
     La de gamle adressene stå til neste steg er ute.

   Dette erstatter adressene under «Adresser for innlogging» i punkt 3.
4. **Miljøvariabler i Vercel, bare for Production:**

   ```bash
   # Før nettstedet lanseres på northwestcoast.no er vercel.app nettstedet:
   printf 'https://northwestcoast-no.vercel.app' | vercel env add NEXT_PUBLIC_SITE_URL production
   printf 'https://portal.northwestcoast.no'     | vercel env add NEXT_PUBLIC_PORTAL_URL production
   ```

   Deploy deretter på nytt. `NEXT_PUBLIC_*` skrives inn i koden når den
   bygges, så variablene gjør ingenting før det finnes en ny deploy.

   Ikke sett dem for Preview. Der skal en forhåndsvisning lenke til seg selv,
   ikke sende innloggingen til produksjon. Dette er også unntaket fra «vent
   med denne» i punkt 2: `NEXT_PUBLIC_SITE_URL` settes til adressen som
   faktisk svarer i dag.
5. **Kontroller:**

   ```bash
   curl -sI https://northwestcoast-no.vercel.app/logg-inn | grep -iE '^(HTTP|location)'
   #   307, location: https://portal.northwestcoast.no/logg-inn
   curl -sI https://portal.northwestcoast.no/ | grep -iE '^(HTTP|location)'
   #   307, location: /minside
   curl -sI https://portal.northwestcoast.no/produkter | grep -iE '^(HTTP|location)'
   #   307, location: https://northwestcoast-no.vercel.app/produkter
   curl -sI https://portal.northwestcoast.no/logg-inn | grep -iE '^(HTTP|x-robots-tag|content-security-policy)'
   #   200, noindex, og nøyaktig én content-security-policy som begynner med default-src 'self'
   ```

   Logg så inn på portalen og gå gjennom punkt 7. Se særlig på det CSP-en
   kan stoppe: bilder i loggføringer og delte rapporter, opplasting av
   bilder, sertifikatet som PDF, og forhåndsvisningen av e-postene i admin.
   Feil vises i nettleserens konsoll som «Content Security Policy».
6. **Rydd i Supabase.** Fjern `https://northwestcoast-no.vercel.app/auth/callback`
   fra Redirect URLs når innloggingen er bekreftet på portalen.

De som var innlogget på den gamle adressen må logge inn én gang til.
Sesjonscookien gjelder bare vertsnavnet den ble satt på. En innloggingslenke
som ble bestilt på den gamle adressen rett før byttet kan gi «ugyldig
lenke»; da ber man om en ny.

### Når nettstedet lanseres på northwestcoast.no

1. Legg `northwestcoast.no` til i Vercel. La `www.northwestcoast.no`
   videresende til roten: vertsreglene gjelder bare det ene vertsnavnet i
   `NEXT_PUBLIC_SITE_URL`.
2. Bytt `NEXT_PUBLIC_SITE_URL` til `https://northwestcoast.no` (Production)
   og deploy på nytt. `NEXT_PUBLIC_PORTAL_URL` står som den er.
3. Supabase trenger ingen endring. Site URL er fortsatt portalen, og
   `https://northwestcoast.no/auth/callback` skal ikke inn i Redirect URLs:
   innloggingen ligger ikke der.
4. Kjør kontrollen i steg 5 over med `northwestcoast.no` som nettsted.

`northwestcoast-no.vercel.app` er etter dette et «annet vertsnavn»: der
svarer alt på én adresse, uten videresending.

### Verdt å vite

- **Portalens CSP** slipper bare til portalen selv, Supabase (innlogging,
  opplasting, bilder i lagringen) og bilder fra nettstedets adresse (logoen i
  forhåndsvisningen av e-postene). Skal portalen hente noe annet utenfra, må
  det legges til i `portalCsp()` i `next.config.mjs`. En bildeadresse fra et
  annet nettsted som limes inn i admin (forsidebilde, galleri) vises derfor
  ikke i forhåndsvisningen der, men virker på nettstedet.
- **Nytt innlogget område:** i tillegg til de tre stedene i punkt 5 må det
  inn i `PORTAL_AREAS` i `next.config.mjs` og `PORTAL_PAGE` i `lib/site.ts`.
  Ellers sender portalens vertsnavn området videre til nettstedet.
- **Lenker fra portalen til nettstedet** må ha nettstedets adresse
  (`siteHref()` i `lib/site.ts`). På portalen er «/» Min side, ikke forsiden.
- **Prøve lokalt:** start Next med
  `NEXT_PUBLIC_SITE_URL=http://localhost:3200` og
  `NEXT_PUBLIC_PORTAL_URL=http://portal.localhost:3200` på port 3200, mot det
  lokale testmiljøet (punkt 4). Nettlesere slår opp `portal.localhost` av seg
  selv.
- **Slå det av:** fjern `NEXT_PUBLIC_PORTAL_URL`, deploy på nytt, og sett
  Site URL og Redirect URLs i Supabase tilbake til nettstedets adresse.
