# Lokalt Supabase-miljø (uten Docker)

Et lite, lokalt miljø for å utvikle og teste portalen uten å røre produksjon
og uten å opprette kontoer der.

| Del | Hva som kjører |
|---|---|
| Database | Postgres bygget fra `supabase/migrations`, med demodata |
| REST | Ekte PostgREST, så RLS og funksjonene oppfører seg som i Supabase |
| Auth | `server.mjs` utsteder økter uten e-post |
| Lagring | Filer på disk; hver opplasting, signering og sletting sjekkes mot policyene på `storage.objects` |

## Start

```bash
brew install postgresql@17 postgrest   # én gang
bash supabase/local/start.sh           # skriver ut linjene til .env.local
npm run dev
```

`bash supabase/local/start.sh --reset` bygger databasen på nytt fra migrasjonene.

## Logge inn

Skriv inn en av testadressene på `/logg-inn`. Det sendes ingen e-post. Det
som ville stått i e-posten, skrives ut i terminalen der `start.sh` kjører:

- lenken til `/auth/confirm`, den samme siden med «Logg inn»-knapp som
  brukerne får
- engangskoden, som lokalt alltid er `12345678`, til kodefeltet på
  innloggingssiden
- en direkte lenke til `/auth/callback`, som logger inn uten mellomsteg

Prøv innloggingen med nettsted og portal på hvert sitt vertsnavn før en
endring i den rulles ut (`NEXT_PUBLIC_SITE_URL=http://localhost:<port>` og
`NEXT_PUBLIC_PORTAL_URL=http://portal.localhost:<port>`), og gjør det mot
`next build` og `next start`, ikke bare `next dev`. Det er der produksjon
skiller seg fra utvikling.

| Adresse | Rolle |
|---|---|
| `admin@nwc.test` | Administrator |
| `produksjon@nwc.test` | Produksjon |
| `media@nwc.test` | Media (nyheter og galleri) |
| `kari@demo.test` | Eier av Demo Rederi AS |
| `mannskap@demo.test` | Mannskap på MS Demo Havørn |
| `los@demo.test` | Ingen tilgang (tester forespørsel via produksjonsnummer) |

En adresse som ikke finnes fra før, blir en ny bruker uten tilgang – slik en
ny kunde opplever det.

Til curl og skript finnes en ferdig innlogget økt som Cookie-hode:

```bash
curl -H "Cookie: $(node supabase/local/server.mjs --print-cookie admin@nwc.test)" http://localhost:3000/admin
```

## Begrensninger

- Auth-delen dekker bare det appen bruker (magic link, økt, utlogging).
- Bilder lagres som de er; ingen størrelses- eller typekontroll som i Supabase.
- Skal aldri kjøre i produksjon: den logger inn hvem som helst.
