# Innloggings-e-postene i Supabase

Supabase sender selv e-postene for innlogging. Malene her har samme oppsett
som resten av e-posten fra nettstedet, og limes inn i Supabase-dashbordet:
**Authentication → Emails → Templates**.

Filene lages av `npm run mail:auth` fra `lib/mail/auth-templates.ts`. Rediger
aldri HTML-filene direkte: endre malen, kjør kommandoen og lim inn på nytt.
Forhåndsvisning med eksempeldata ligger i admin under **E-post**.

| Fil | Mal i Supabase | Emnefelt |
|---|---|---|
| `magic-link.html` | Magic Link | Logg inn på Min side hos NorthWest Coast |
| `confirm-signup.html` | Confirm signup | Velkommen til Min side hos NorthWest Coast |
| `email-change.html` | Change Email Address | Bekreft ny e-postadresse hos NorthWest Coast |
| `recovery.html` | Reset Password | Logg inn på Min side hos NorthWest Coast |

For hver mal: lim hele filen inn i feltet for innholdet, og sett emnefeltet
som i tabellen. «Invite user» og «Reauthentication» brukes ikke av nettstedet.

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
- **Email OTP Expiration:** 3600 sekunder (tekstene sier 60 minutter; endres
  den ene, må den andre følge).
- **Confirm email** og **Secure email change:** på.

**Authentication → Emails → SMTP Settings**

- Vert `smtp.resend.com`, port 465, bruker `resend`, passord: en API-nøkkel
  fra Resend. Avsender: `noreply@northwestcoast.no`, navn «NorthWest Coast».
  Uten egen SMTP leverer Supabase bare til medlemmer av organisasjonen.
