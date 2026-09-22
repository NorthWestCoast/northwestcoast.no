# Deploy – NorthWest Coast

Vercel-prosjekt: **`northwestcoast-no`** (team `tobias-remme-jensens-projects`).
Serverless-region: **`fra1` (Frankfurt)**, satt i `vercel.json` – samme sted som
Supabase-prosjektet, så databasekall ikke krysser Atlanteren.

> Regionen er satt i repoet framfor i prosjektinnstillingene med vilje:
> `vercel.json` er versjonskontrollert, går gjennom review, og overstyrer
> prosjektinnstillingen ved deploy.

## 1. Miljøvariabler

Secrets settes med `vercel env add` (verdien tastes inn interaktivt, så den
havner ikke i shell-historikk eller i en chatlogg).

### Ikke hemmelige – kan settes rett fra CLI

```bash
vercel link                       # én gang, knytter mappa til prosjektet

printf 'resend'   | vercel env add MAIL_PROVIDER production
printf 'resend'   | vercel env add MAIL_PROVIDER preview

printf 'https://mlmzroxnvbocftiqwotd.supabase.co' | vercel env add NEXT_PUBLIC_SUPABASE_URL production
printf 'https://mlmzroxnvbocftiqwotd.supabase.co' | vercel env add NEXT_PUBLIC_SUPABASE_URL preview

printf 'sb_publishable_Pk-KbB9CuQn9eMPnmFjuWA_OHlQ9ABi' | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
printf 'sb_publishable_Pk-KbB9CuQn9eMPnmFjuWA_OHlQ9ABi' | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview

printf 'noreply@northwestcoast.no' | vercel env add RESEND_FROM_EMAIL production
printf 'arve@astep.no'             | vercel env add CONTACT_TO_EMAIL production
```

Den publiserbare nøkkelen er ment å ligge åpent – den sendes uansett med i
nettleserbundelen. Det som beskytter dataene er RLS, som er verifisert:
to rederier ser kun sitt eget, og en bruker uten tilknytning ser ingenting.

### Hemmelige – må settes av deg

Disse har jeg ikke tilgang til, og de skal **ikke** limes inn i en chat:

```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY production   # Supabase → Project Settings → API
vercel env add RESEND_API_KEY production              # resend.com → API Keys
```

Gjenta med `preview` hvis previews skal kunne ta imot bestillinger.

`SUPABASE_SERVICE_ROLE_KEY` omgår RLS fullstendig. Den skal kun finnes som
server-variabel, aldri med `NEXT_PUBLIC_`-prefiks.

### NEXT_PUBLIC_SITE_URL – vent med denne

La den stå tom til `northwestcoast.no` faktisk er koblet til prosjektet.
`lib/site.ts` velger da selv:

| Miljø | Kilde |
|---|---|
| Produksjon | `VERCEL_PROJECT_PRODUCTION_URL` (stabilt domene) |
| Preview | `VERCEL_URL` (deploy-spesifikk, så OG-bilder treffer riktig preview) |

Settes `NEXT_PUBLIC_SITE_URL=https://northwestcoast.no` før domenet er koblet
til, peker canonical-lenker og sitemap på et domene som ikke svarer.

## 2. To ting som stopper innlogging hvis de glemmes

### a) Redirect-URL-er i Supabase

Supabase → Authentication → URL Configuration. Uten disse avvises
magic link-lenken med «redirect not allowed»:

- **Site URL:** `https://northwestcoast.no` (eller `.vercel.app`-domenet inntil videre)
- **Redirect URLs:**
  - `https://northwestcoast.no/auth/callback`
  - `https://northwestcoast-no.vercel.app/auth/callback`
  - `https://northwestcoast-no-*.vercel.app/auth/callback` – for previews

### b) Egen SMTP for auth-e-post

Supabase → Authentication → Emails → SMTP Settings, pek på Resend.

Den innebygde e-posten i Supabase har en svært lav ratelimit (noen få i timen)
og er ment for utvikling. Med den vil innlogging slutte å virke midt i første
testrunde, og avsenderadressen blir ikke NWC sin.

## 3. Kjent status på prosjektet

- **Ingen egendefinert domene er koblet til ennå.** Prosjektet svarer bare på
  `northwestcoast-no.vercel.app`. `northwestcoast.no` må legges til under
  Settings → Domains.
- **Vercel Authentication (SSO) står på for alt utenom egendefinerte domener.**
  Det betyr at preview-deployer krever Vercel-innlogging. Greit nå, men
  los-delingslenkene i fase 4 må kunne åpnes av utenforstående – de testes
  derfor på produksjonsdomenet, eller med SSO slått av for previews.
- `next.config.mjs` tillater fortsatt `v0.dev` og `*.vercel.app` i
  `frame-ancestors`. Det var for v0-previews og bør strammes inn når
  produksjonsdomenet er på plass.

## 4. Verifisering etter deploy

Rekkefølgen er avhengighetsstyrt – hvert steg låser opp det neste. Alt dette
er verifisert mot databasen eller lokalt, men aldri kjørt gjennom en ekte
deploy, fordi service-role-nøkkelen ikke er tilgjengelig i utviklingsmiljøet.

**1. Innlogging.** `/logg-inn` → lenke i innboksen → lander på `/minside`.
Beviser at Resend virker, at redirect-URL-ene er godkjent i Supabase, og at
sesjonscookie og middleware fungerer.
*Feiler typisk på:* redirect-URL ikke godkjent, eller manglende egen SMTP
(den innebygde ratelimiten stopper etter noen forsøk).

**2. Staff-flagget.** Sett flagget (punkt 5), logg ut og inn, åpne `/admin`.
Beviser at app_metadata-claimet faktisk havner i JWT-en der `app.is_staff()`
leser det.
*Feiler typisk på:* glemt å logge ut og inn – det gamle tokenet kjenner ikke
det nye flagget.

**3. Legg inn data.** `/admin/selskap` → rederi → fartøy → `/admin/leidere` →
produksjonsparti → koble til fartøy. Beviser at staff-policyene for skriving
virker gjennom en ekte sesjon.

**4. Bestilling.** Send inn på `/bestill` → sjekk rad i `orders` og
`order_lines`, ordrenummer på formen `NWC-2026-0001`, og to rader i
`email_log`. Beviser skriveveien med service-role, prisberegning og
e-postabstraksjonen.

**5. Vedlikehold med bilde tatt på mobil.** Det viktigste steget. Sjekk at
filen havner i `maintenance-photos`, at `captured_at` er satt fra EXIF og
IKKE er lik opplastingstidspunktet, og at e-posten har signerte bildelenker.
Beviser hele den signerte opplastingsrunden og komprimering i en ekte
nettleser – ingen av delene lar seg kjøre uten mobil og service-role.
`captured_at` er dessuten bærende for 24-timersregelen i los-delingen.

**6. Invitasjon.** Inviter fra `/admin/selskap/<id>` → personen får e-post →
logger inn → ser rederiet sitt. Beviser innløsningen i `/auth/callback`.
Uten den ville en invitert person logget inn og tilhørt ingenting.

**7. PDF.** Åpne `/minside/leider/<id>/pdf`. Sjekk at den laster ned, at
sidetallet står nederst til høyre, og at bildene er med. Beviser at
@react-pdf kjører i produksjonsbygget – bundlingen er en annen der enn i dev.

**8. Stikkprøve på isolasjon.** Logg inn som en kunde fra et annet rederi og
bekreft at fartøyene til det første ikke er synlige. Er verifisert i SQL, men
fortjener én bekreftelse gjennom appen.

## 5. Gi noen tilgang til /admin

Admin-verktøyet er gjerdet inn av `app_metadata.staff`. Flagget må settes med
service-role – det er hele poenget: `app_metadata` kan ikke endres av brukeren
selv, i motsetning til `user_metadata`. Lå flagget der, kunne hvem som helst
gjort seg selv til ansatt.

Personen må ha logget inn med magic link minst én gang først, slik at raden
finnes i `auth.users`. Kjør så i Supabase SQL Editor:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"staff": true}'::jsonb
where email = 'arve@astep.no';
```

Ta bort tilgangen igjen:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data - 'staff'
where email = 'arve@astep.no';
```

**Personen må logge ut og inn igjen** etterpå. Claimet ligger i JWT-en, og den
gamle tokenet vet ingenting om det nye flagget før det fornyes.

Databasen stoler ikke på nettsiden her: hver eneste RLS-policy for
admin-skriving kaller `app.is_staff()` og leser samme claim. Verifisert at en
innlogget kunde uten flagget verken kan opprette selskap, registrere leidere
eller endre vedlikeholdsrapporter.

## 6. Første ansatt, første kunde

Rekkefølgen som får data inn i systemet:

1. Logg inn på `/logg-inn` med din egen adresse.
2. Sett `staff`-flagget (over), logg inn på nytt.
3. `/admin/selskap` → opprett rederiet, åpne det, legg til fartøy.
4. `/admin/leidere` → lim inn serienumrene for et produksjonsparti, koble dem
   til fartøyet med installasjonsdato.
5. `/admin/selskap/<id>` → inviter kundens kontaktperson.
6. `/admin/service` → registrer servicerapport. Neste frist beregnes fra
   leiderens serviceintervall om du ikke setter den selv.
