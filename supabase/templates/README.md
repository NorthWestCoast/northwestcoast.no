# Innloggings-e-postene i Supabase

Supabase sender selv e-postene for innlogging. Malene her har samme oppsett
som resten av e-posten fra nettstedet, og limes inn i Supabase-dashbordet:
**Authentication → Emails → Templates**.

Filene lages av `npm run mail:auth` fra `lib/mail/auth-templates.ts`. Rediger
aldri HTML-filene direkte: endre malen, kjør kommandoen og lim inn på nytt.
Forhåndsvisning med eksempeldata ligger i admin under **E-post**.

| Fil | Mal i Supabase | Emnefelt |
|---|---|---|
| `magic-link.html` | Magic Link | Innloggingskode {{ .Token }} til Min side |
| `confirm-signup.html` | Confirm signup | Velkommen til Min side. Innloggingskoden din er {{ .Token }} |
| `email-change.html` | Change Email Address | Bekreft ny e-postadresse hos NorthWest Coast |
| `recovery.html` | Reset Password | Logg inn på Min side hos NorthWest Coast |

For hver mal: lim hele filen inn i feltet for innholdet, og sett emnefeltet
som i tabellen. «Invite user» og «Reauthentication» brukes ikke av nettstedet.

De to e-postene med engangskode har koden i emnet (`{{ .Token }}` fylles inn
av Supabase). Da får hver e-post sitt eget emne. Med likt emne slår Gmail og
andre e-postene sammen til én tråd og skjuler teksten som gjentar seg, så
knappen og koden i den nyeste kan bli borte, og det er lett å bruke en gammel
kode. Koden vises dermed i varsler og på låst skjerm. Derfor er den kortlevd
(se «Email OTP Expiration» under).

## Hvorfor lenken ser ut som den gjør

Lenken i e-posten er `{{ .SiteURL }}/auth/confirm?token_hash=…`, ikke
Supabase sin standardlenke (`{{ .ConfirmationURL }}`):

- Den går til en side der brukeren selv trykker «Logg inn». Mange bedrifter
  har e-postfiltre som åpner alle lenker for å sjekke dem. En lenke som logget
  inn ved åpning, ville vært brukt opp før mottakeren rakk å klikke.
- Den virker på en annen enhet enn den som ba om lenken.
- Den bygges av Site URL alene. Standardlenken sender brukeren til adressen
  som sto i forespørselen (`redirect_to`), og den kan en angriper velge selv
  blant alle adresser som er tillatt under Redirect URLs.

E-posten viser også en engangskode. Den kan skrives inn på innloggingssiden
av den som leser e-posten på en annen enhet.

## Innstillinger som hører til

**Authentication → URL Configuration**

- **Site URL:** adressen den innloggede delen svarer på:
  `https://portal.northwestcoast.no` når portalen er flyttet dit
  (`https://northwestcoast-no.vercel.app` fram til da). Lenkene og logoen i
  e-postene bygges av den, så den må peke dit `/auth/confirm` faktisk ligger.
- **Redirect URLs:** bare hele, eksakte adresser, i praksis
  `https://portal.northwestcoast.no/auth/callback`. Ingen jokertegn på
  `vercel.app`: hvem som helst kan opprette et Vercel-prosjekt med et navn som
  passer mønsteret.

**Authentication → Providers → Email**

- **Email OTP Length:** 8. Engangskoden er den samme nøkkelen som lenken, og
  med seks sifre kan den gjettes med nok forsøk.
- **Email OTP Expiration:** 600 sekunder. Lenken og koden virker i 10
  minutter. Tekstene i e-postene og på innloggingssiden henter tallet fra
  `LOGIN_VALID_MINUTES` i `lib/site.ts`: endres den ene, må den andre følge,
  og malene må bygges (`npm run mail:auth`) og limes inn på nytt.
- **Confirm email** og **Secure email change:** på.

**Authentication → Emails → SMTP Settings**

- Vert `smtp.resend.com`, port 465, bruker `resend`, passord: en API-nøkkel
  fra Resend. Avsender: `noreply@northwestcoast.no`, navn «NorthWest Coast».
  Uten egen SMTP leverer Supabase bare til medlemmer av organisasjonen.
