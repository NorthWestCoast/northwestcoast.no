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

Skriv inn en av testadressene på `/logg-inn`. Det sendes ingen e-post:
innloggingslenken skrives ut i terminalen der `start.sh` kjører.

| Adresse | Rolle |
|---|---|
| `admin@nwc.test` | Administrator |
| `produksjon@nwc.test` | Produksjon |
| `kari@demo.test` | Eier av Demo Rederi AS |
| `mannskap@demo.test` | Mannskap på MS Demo Havørn |
| `los@demo.test` | Ingen tilgang (tester forespørsel via produksjonsnummer) |

En adresse som ikke finnes fra før, blir en ny bruker uten tilgang – slik en
ny kunde opplever det.

## Begrensninger

- Auth-delen dekker bare det appen bruker (magic link, økt, utlogging).
- Bilder lagres som de er; ingen størrelses- eller typekontroll som i Supabase.
- Skal aldri kjøre i produksjon: den logger inn hvem som helst.
