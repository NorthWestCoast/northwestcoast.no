# Portalen: Min side, Admin og Produksjon

Tre innloggede områder oppå samme database og samme designsystem.

| Område | Sti | Hvem | Vokter |
|---|---|---|---|
| Min side | `/minside` | Kunder (og ansatte) | `requireUser()` |
| Admin | `/admin` | Administratorer i NorthWest Coast | `requireAdmin()` |
| Media | `/admin/nyheter`, `/admin/galleri` | Media og administratorer | `requireMedia()` |
| Produksjon | `/produksjon` | Produksjon og administratorer | `requireProduction()` |
| Delt rapport | `/los/[token]` | Alle med lenken (uten innlogging) | token i URL |
| Kontroll av sertifikat | `/sertifikat/[token]` | Alle med lenken (uten innlogging) | token i URL |

## Arkitektur

- **Ingen service-role-nøkkel.** Alt går gjennom brukerens egen sesjon
  (`createServerSupabase()`), og RLS er autorisasjonslaget. Det som krever mer
  enn brukeren selv har lov til, gjøres av `SECURITY DEFINER`-funksjoner i
  databasen som autoriserer selv (kalles med `supabase.rpc(...)`).
- **Roller:** `staff_members` (e-post + `admin`/`production`/`media`). Rollen
  gjelder bare for en verifisert e-postadresse. `media` styrer nyheter og
  galleri og ser ingenting annet (`app.is_media()`); den kan gis til ansatte
  eller til eksterne, f.eks. et byrå. Kunder har rolle per selskap
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
   Admin-layouten slipper inn både administratorer og media, så den beskytter
   ingenting alene: hver side og action under `/admin` må kalle
   `requireAdmin()`/`requireStaff()` selv (nyheter og galleri: `requireMedia()`).
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
| `install_ladder(p_ladder, p_vessel, p_installed_at, p_project)` | styrer leider og fartøy/prosjekt | plasserer på fartøy og/eller i prosjekt (begge `null` tar den ned) |
| `place_cabinet(p_cabinet, p_vessel, p_project, p_installed_at, p_location)` | eier/admin i selskapet, eller admin | plasserer et oppbevaringsskap |
| `complete_ladder_task(p_task, p_notes, p_performed_at)` | tilgang til leideren | fullfører oppgave, skriver logg, lager neste forekomst |
| `create_ticket`, `reply_ticket`, `set_ticket_status` | kunde/admin | support |
| `request_service`, `cancel_service_booking` | tilgang til leideren | servicebestilling |
| `place_order(payload)` | alle (også uinnlogget) | bestilling; pris regnes ut i databasen. Linjer er `{product_id, qty, with_cabinet}` eller `{custom_length_m, qty, with_cabinet}` (spesiallengde, alltid på forespørsel) |
| `confirm_order(p_order, p_due_date)` | admin | bekrefter, lager én produksjonsjobb per leider og per skap bestilt alene |
| `set_production_step(p_step, p_done, p_note)` | produksjon | kvitterer ut steg |
| `assign_job_serial(p_job, p_serial)` | produksjon | registrerer produksjonsnummer, oppretter leideren (valgfritt for skapjobber) |
| `advance_job(p_job, p_status, p_carrier, p_tracking)` | produksjon (kansellering: admin) | sendt / levert / kansellert. Ved levering opprettes skapet i `cabinets` |
| `issue_ladder_certificate(p_ladder, p_service_report, p_valid_until, p_remarks)` | admin | utsteder servicesertifikat, erstatter det forrige, varsler kunden |
| `get_certificate(p_token)` | alle | kontroll av et sertifikat med lenken som står på det |
| `get_ladder_share(p_token)` | alle | henter delt rapport |
| `submit_contact_request`, `subscribe_newsletter`, `submit_maintenance_report`, `finish_maintenance_report` | alle | skjemaene på nettsiden |
| `mark_notifications_read(p_ids)` | innlogget | varsler lest |
| `orphan_maintenance_photos()` | admin | bilder i `maintenance-photos` som ikke hører til noen rapport (eldre enn et døgn) |

## Lagring

| Bøtte | Mappe | Skrive | Lese |
|---|---|---|---|
| `maintenance-photos` | loggføringens id | den som loggførte (1 døgn), admin, åpent skjema (30 min) | tilgang til leideren, admin |
| `ladder-state-photos` | delingens id | tilgang til leideren | tilgang til leideren, og alle mens delingen er aktiv |
| `service-reports` | leiderens id (`<leider>/<rapport>/<fil>` for bilder) | admin | tilgang til leideren |
| `public-media` | fritt (`galleri/` for galleribilder) | admin og media | offentlig |

Private bilder vises med `signedUrls()` fra `lib/portal/storage.ts`.

## Løpet fra bestilling til drift

1. Kunden bestiller (nettsiden eller Min side) → `orders` + `order_lines`.
   Halvmetere og andre lengder utenom standard går som spesiallengde på
   forespørsel (`order_lines.custom_length_m`, produktet `ARG-SPES`). Skap kan
   bestilles alene.
2. Admin bekrefter → `production_jobs`, én per leider og én per skap bestilt
   alene (`kind`), med steg kopiert fra `production_step_templates` (skapjobber
   får bare stegene merket `for_cabinet`) og spesifikasjonen kopiert fra
   produktet.
3. Produksjon kvitterer ut steg og registrerer produksjonsnummer →
   leideren opprettes (`ladders`, status `in_production`, eid av kundens selskap).
4. Sendt → `deliveries`. Levert → leideren får status `delivered`, og skapet
   (bestilt alene eller sammen med leideren) blir en egen enhet i `cabinets`.
5. Kunden plasserer leideren på et fartøy og/eller i et prosjekt → status
   `installed`, og servicefristen begynner å løpe
   (`ladder_status.next_service_due`). Skap plasseres på samme måte.
6. Drift: loggføringer (`maintenance_logs` med `kind`; administratorer kan
   også loggføre), planlagte oppgaver (`ladder_tasks`), servicebestillinger
   (`service_bookings`), servicerapporter (`service_reports`) med bilder
   (`service_report_photos`), servicesertifikat (`ladder_certificates`) og
   delte tilstandsrapporter (`ladder_state_shares`).

## Prosjekter og oppbevaringsskap

Ikke alt utstyr står på et fartøy. Et **prosjekt** (`projects`) er et sted
eller oppdrag som ikke er et fartøy: en kai, et anlegg på land, et
havbruksanlegg. Det eies av et selskap, og avsluttes i stedet for å slettes.
En leider eller et skap kan stå på et fartøy, i et prosjekt, begge deler eller
ingen av delene. Eierselskapet følger fartøyet, ellers prosjektet.

**Oppbevaringsskap** (`cabinets`) er egne enheter, fordi et skap kan stå et
annet sted enn leideren det kom med, og fordi skap kan kjøpes alene. De har
ingen servicehistorikk; de har eier, plassering og status.

## Servicesertifikat

Etter en godkjent service kan en administrator utstede et servicesertifikat.
Opplysningene om leideren kopieres inn i sertifikatet, så det står fast selv
om leideren flyttes. Et nytt sertifikat erstatter det forrige. Sertifikatet
har en kontrollenke (`/sertifikat/<token>`) som viser om det er gyldig, utløpt,
erstattet eller trukket tilbake. Navnet på dokumentet står ett sted:
`CERTIFICATE_NAME` i `lib/portal/labels.ts`.

## Oppslag i offentlige registre

| Rute | Kilde | Brukes til |
|---|---|---|
| `GET /api/vessels?q=` | Fiskeridirektoratets fartøyregister (åpent API, bare fiskefartøy) | kalkulatoren og skjema for nye fartøy |
| `GET /api/brreg?q=` (innlogget) | Enhetsregisteret | skjema for nye kunder |

Begge fyller bare ut felt. Alt kan fortsatt legges inn for hånd.

## E-post

All e-post bygges i `lib/mail/`: `layout.ts` er den felles rammen og
byggeklossene (alt som settes inn escapes), `templates.ts` er malene, og
`events.ts` sender oppfølging til kunden når en ansatt bekrefter eller leverer
en bestilling eller utsteder et sertifikat. Innloggings-e-postene sendes av
Supabase og ligger i `auth-templates.ts` (se `supabase/templates/README.md`).
Admin har en forhåndsvisning av alle e-postene under **E-post**.

Regelen som holder skjemaene trygge: en e-post til en adresse vi ikke har
bekreftet (kvitteringer, invitasjoner) gjengir ikke fritekst, har ingenting
fra skjemaet i emnefeltet, og navn slipper bare gjennom et smalt tegnsett.
Ellers kunne skjemaene brukes til å sende andre en e-post «fra NorthWest
Coast» med innhold avsenderen selv har valgt.

Oppfølgings-e-postene sendes med den ansattes egen sesjon. Rollen produksjon
kan ikke lese bestillinger, så «levert» fra produksjonssiden gir bare varsel
i portalen; e-posten går når en administrator markerer leveransen som levert.

## Etter sikkerhetsgjennomgangen 19.11.2026

Fire migrasjoner (`anon_app_usage` og `security_hardening_access`, `_forms`,
`_consent`) strammet inn det en innlogget bruker, eller en anonym med den
offentlige nøkkelen, kunne gjøre rett mot API-et. Hver regel har en test i
`supabase/verify/flows.sql` som prøver angrepet og forventer avslag. Det som
endret hvordan portalen oppfører seg:

- **Invitasjoner må godtas.** En invitasjon gir ingen tilgang før mottakeren
  selv har godtatt den på Min side (`accept_invitation`, `decline_invitation`).
  `portal_bootstrap()` gir lista over ventende invitasjoner og løser ikke inn
  noe selv. Medlemmer settes aldri inn direkte i `company_members`.
- **Eierrollen** i et selskap kan bare gis og tas av en eier, og den siste
  eieren kan ikke fjernes.
- **Meldinger fra det åpne vedlikeholdsskjemaet** (`source = 'web'`) teller
  ikke som «siste vedlikehold» og vises ikke i rapporter til los før en
  administrator har bekreftet dem under Vedlikeholdsrapporter (`verified_at`).
  Å koble en melding til en leider er også en bekreftelse.
- **Delte rapporter**: bare «trukket tilbake» kan endres, og en lenke varer
  høyst 15 dager. Bildene hentes bare av den som har tilgang til leideren,
  eller som sender nøkkelen fra lenken i hodet `x-share-token` (det gjør
  `/los/[token]`).
- **Nyhetsbrev**: en påmelding er ventende til mottakeren har bekreftet den
  med lenken i e-posten (`/api/newsletter/confirm`). Samme side melder av med
  `&a=avmeld` og abonnentens `unsubscribe_token`.
- **Grenser på de åpne skjemaene**: med `FORM_GATE_SECRET` satt i nettlaget og
  sjekksummen i `app.gates` teller kall gjennom nettstedet per besøkende, og
  kall rett mot API-et har en egen liten kvote. Uten nøkkelen gjelder én
  felles grense per skjema, som før.
- **Ingen passord**: en trigger på `auth.users` tømmer passordfeltet, så
  innlogging med passord aldri virker, heller ikke rett mot Auth-API-et.

## Etter gjennomgangen 23.11.2026

Én migrasjon (`security_hardening_followup`) tok med det som manglet. Testene
står sist i `supabase/verify/flows.sql`.

- **Medlemmer på fartøy og leidere** settes heller aldri inn direkte. Tilgang
  kommer bare ved at mottakeren godtar en invitasjon, eller ved at en
  forespørsel blir godkjent. På et medlemskap kan bare rollen endres.
- **Verifiserte selskap** (`companies.verified_at`, `verified_by`): en
  administrator merker et selskap som kontrollert på selskapssiden i admin.
  Selskap ansatte oppretter, er verifisert med en gang. Kunden kan aldri
  endre organisasjonsnummeret, og heller ikke navnet når selskapet er
  verifisert. Velgeren «Knytt til selskap» på en bestilling viser hvilke
  selskap som ikke er verifisert.
- **Nyhetene**: besøkende ser ikke `author_id` eller `author_name`.
- **Bilder fra det åpne vedlikeholdsskjemaet**: høyst 10 per rapport og
  200 MB per døgn til sammen. Når kvoten er brukt opp, lagres rapporten uten
  bilder. Filer som aldri ble knyttet til en rapport, vises nederst under
  Vedlikeholdsrapporter, og bare de kan en administrator slette.
- **Bestillinger fra nettsiden**: høyst 5 i timen per besøkende når
  skjemanøkkelen er satt opp (se DEPLOYMENT.md).

## Lager

Lageret holder rede på deler og ferdigvarer, hva som er bestilt, og hva som
har gått til produksjon mot direkte salg. Sidene ligger under `/admin/lager`
(oversikt, vare, innkjøp, stykklister, forbruk) og `/produksjon/lager`.

- **Vare** (`stock_items`): alt det telles opp av. En del eller en
  ferdigvare, som kjøpes ferdig, produseres hos ekstern part eller settes
  sammen hos NWC. En vare kan være knyttet til produktet den selges som:
  en reservedel, en ferdig leider eller et skap.
- **Bevegelser** (`stock_movements`): det eneste som endrer beholdningen.
  De endres og slettes aldri; en feil rettes med en ny bevegelse
  (varetelling). Slaget sier hva som skjedde: varemottak, ferdig montert,
  brukt i produksjon, solgt, svinn, retur eller telling.
- **Stykkliste** (`product_components`): delene et produkt består av, med
  mengde per enhet og eventuelt mengde per meter (for spesiallengder).
- **Slik skaffes produktet** (`products.sourcing`): «bygges selv» eller
  «videresalg».
- **Innkjøp** (`purchase_orders`): bestillinger hos leverandør, både vanlig
  innkjøp og deler satt i produksjon hos ekstern part. Varemottak
  (`receive_purchase_line`) legger varene inn, også delvis.

Lageret føres av seg selv der det går an:

| Hendelse | Bevegelse |
|---|---|
| Produksjonsjobb for et produkt som bygges selv blir «klar» | Delene i stykklista trekkes (brukt i produksjon), og enheten legges inn (ferdig montert) hvis produktet har en lagervare. Én gang per jobb. |
| Produksjonsjobb blir levert | Enheten går ut som solgt, også for videresalg. Skapet som følger en leider, går ut samtidig. |
| Bestilling med reservedeler blir levert | Reservedelene går ut som solgt. |
| Varemottak på et innkjøp | Varene legges inn. |

**Bygget til lager.** En jobb uten bestilling kan avsluttes som «på lager»
(`advance_job(…, 'stocked')`); leideren får status `in_stock`. Når den selges,
tar jobben plassen til jobben som ble opprettet for bestillingen
(`fulfil_job_from_stock`), så produksjonsnummeret og historikken følger med,
og delene trekkes ikke en gang til.

Beholdningen kan bli negativ: produksjonen stoppes aldri av at en telling er
feil. Oversikten merker slike varer med «Må telles». «Bundet» er det åpne
jobber kommer til å bruke etter stykklista, og minimum måles mot det som er
tilgjengelig etter at det er trukket fra.

Administratorer styrer varer, stykklister og innkjøp. Produksjon ser alt, og
kan registrere varemottak, svinn og telling. Kunder og medierollen ser
ingenting av lageret.

