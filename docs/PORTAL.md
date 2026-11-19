# Portalen: Min side, Admin og Produksjon

Tre innloggede områder oppå samme database og samme designsystem.

| Område | Sti | Hvem | Vokter |
|---|---|---|---|
| Min side | `/minside` | Kunder (og ansatte) | `requireUser()` |
| Admin | `/admin` | Administratorer i NorthWest Coast | `requireAdmin()` |
| Produksjon | `/produksjon` | Produksjon og administratorer | `requireProduction()` |
| Delt rapport | `/los/[token]` | Alle med lenken (uten innlogging) | token i URL |

## Arkitektur

- **Ingen service-role-nøkkel.** Alt går gjennom brukerens egen sesjon
  (`createServerSupabase()`), og RLS er autorisasjonslaget. Det som krever mer
  enn brukeren selv har lov til, gjøres av `SECURITY DEFINER`-funksjoner i
  databasen som autoriserer selv (kalles med `supabase.rpc(...)`).
- **Roller:** `staff_members` (e-post + `admin`/`production`). Rollen gjelder
  bare for en verifisert e-postadresse. Kunder har rolle per selskap
  (`company_members`: owner/admin/member), per fartøy (`vessel_members`:
  master/crew/viewer) eller per leider (`ladder_members`: manager/viewer).
- **Kontekst:** `getPortalContext()` i `lib/portal/context.ts` kaller
  `portal_bootstrap()`, som oppretter profil, løser inn invitasjoner og
  returnerer rolle, selskap og antall uleste varsler.
- **Varsler:** tabellen `notifications`. Databasen skriver varslene selv
  (i funksjonene og i triggere), så ingen kode trenger å huske det.
- **E-post** er et tillegg: uten `RESEND_API_KEY` virker alt, men varsler
  kommer bare i portalen.

## Regler for kode i portalen

1. Sider er serverkomponenter. Start med vokteren:
   `const { supabase, ctx } = await requireUser();`
2. Skriving skjer i server actions (`actions.ts` ved siden av siden) med
   signaturen `(formData: FormData) => Promise<ActionResult>`. Bruk hjelperne i
   `lib/portal/forms.ts` (`text`, `optional`, `uuid`, `isoDate`, `int`,
   `checked`, `ok`, `err`, `fail`). `fail(error)` oversetter databasefeil;
   meldinger fra databasefunksjonene (P0001) er allerede på norsk.
3. Kall vokteren i hver action også. Avslutt med `revalidatePath(...)`.
4. Aldri `createServiceSupabase`, aldri service-role. Mangler en policy eller
   funksjon, er løsningen en ny migrasjon, ikke en omvei.
5. Brukergrensesnittet bygges av `components/portal/ui.tsx` (PageHeader, Card,
   Stats/Stat, Badge, Alert, Empty, KV, Td, Tabs, Progress, Disclosure,
   Timeline) og `components/portal/forms.tsx` (PortalForm, ActionButton,
   CopyField). Bilder lastes opp med `components/portal/photo-uploader.tsx`.
   Klassene ligger i `app/(portal)/portal.css` (prefiks `pt-`).
6. Tabeller: `<table className="pt-table">` med `<Td label="…">` i hver celle.
   På mobil blir radene kort, og `label` er ledeteksten.
7. Skjemafelt: `<div className="pt-field"><label htmlFor>…</label><input …/></div>`,
   flere i bredden med `<div className="pt-form-row">`.
8. Statuser vises med `Badge` og tekst/tone fra `lib/portal/labels.ts`.
   Datoer med `dato()` / `datoTid()` og beløp med `nok()` fra `lib/format.ts`.
9. All tekst er på norsk bokmål, kort og konkret. Portalen er ikke oversatt.

## Databasefunksjoner (RPC)

Typene ligger i `lib/supabase/database.types.ts` (generert, `npm run db:types`).

| Funksjon | Hvem | Gjør |
|---|---|---|
| `portal_bootstrap()` | innlogget | profil, invitasjoner, kontekst |
| `create_my_company(p_name, p_org_number, …)` | innlogget | oppretter selskap, gjør brukeren til eier |
| `request_ladder_access(p_serial, p_message)` | innlogget | ber om tilgang via produksjonsnummer; svar `{status: not_found\|already\|pending\|requested}` |
| `decide_ladder_access(p_request, p_approve, p_role, p_note)` | den som styrer leideren, eller admin | godkjenner/avslår |
| `install_ladder(p_ladder, p_vessel, p_installed_at)` | styrer leider og fartøy | monterer (eller tar av med `p_vessel = null`) |
| `complete_ladder_task(p_task, p_notes, p_performed_at)` | tilgang til leideren | fullfører oppgave, skriver logg, lager neste forekomst |
| `create_ticket`, `reply_ticket`, `set_ticket_status` | kunde/admin | support |
| `request_service`, `cancel_service_booking` | tilgang til leideren | servicebestilling |
| `place_order(payload)` | alle (også uinnlogget) | bestilling; pris regnes ut i databasen |
| `confirm_order(p_order, p_due_date)` | admin | bekrefter, lager én produksjonsjobb per leider |
| `set_production_step(p_step, p_done, p_note)` | produksjon | kvitterer ut steg |
| `assign_job_serial(p_job, p_serial)` | produksjon | registrerer produksjonsnummer, oppretter leideren |
| `advance_job(p_job, p_status, p_carrier, p_tracking)` | produksjon (kansellering: admin) | sendt / levert / kansellert |
| `get_ladder_share(p_token)` | alle | henter delt rapport |
| `submit_contact_request`, `subscribe_newsletter`, `submit_maintenance_report`, `finish_maintenance_report` | alle | skjemaene på nettsiden |
| `mark_notifications_read(p_ids)` | innlogget | varsler lest |

## Lagring

| Bøtte | Mappe | Skrive | Lese |
|---|---|---|---|
| `maintenance-photos` | loggføringens id | den som loggførte (1 døgn), admin, åpent skjema (30 min) | tilgang til leideren, admin |
| `ladder-state-photos` | delingens id | tilgang til leideren | tilgang til leideren, og alle mens delingen er aktiv |
| `service-reports` | leiderens id | admin | tilgang til leideren |
| `public-media` | fritt | admin | offentlig |

Private bilder vises med `signedUrls()` fra `lib/portal/storage.ts`.

## Løpet fra bestilling til drift

1. Kunden bestiller (nettsiden eller Min side) → `orders` + `order_lines`.
2. Admin bekrefter → `production_jobs`, én per leider, med steg kopiert fra
   `production_step_templates` og spesifikasjonen kopiert fra produktet.
3. Produksjon kvitterer ut steg og registrerer produksjonsnummer →
   leideren opprettes (`ladders`, status `in_production`, eid av kundens selskap).
4. Sendt → `deliveries`. Levert → leideren får status `delivered`.
5. Kunden monterer leideren på et fartøy → status `installed`, og servicefristen
   begynner å løpe (`ladder_status.next_service_due`).
6. Drift: loggføringer (`maintenance_logs` med `kind`), planlagte oppgaver
   (`ladder_tasks`), servicebestillinger (`service_bookings`), servicerapporter
   (`service_reports`), delte tilstandsrapporter (`ladder_state_shares`).
