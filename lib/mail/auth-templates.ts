/**
 * Innloggings-e-postene som Supabase sender.
 *
 * Supabase sender selv e-postene for innlogging (via SMTP til Resend) og har
 * malene sine i dashbordet: Authentication → Emails → Templates. Her bygges
 * de med det samme oppsettet som resten av e-posten fra appen. `npm run
 * mail:auth` skriver dem til supabase/templates/, og derfra limes de inn i
 * dashbordet (se supabase/templates/README.md). Verdiene i {{ … }} fylles inn
 * av Supabase når e-posten sendes.
 *
 * Importene har filendelse fordi fila også lastes av plain node.
 */
import { CONTACT_EMAIL, SUPPORT_PHONE } from './config.ts';
import { LOGIN_VALID_MINUTES } from '../site.ts';
import { button, code, fallbackUrl, html, p, shell, small } from './layout.ts';

export type AuthTemplate = {
  /** Filnavnet i supabase/templates/. */
  file: string;
  /** Navnet malen har i Supabase-dashbordet. */
  supabaseName: string;
  /**
   * Emnefeltet, som settes i dashbordet ved siden av malen. Der e-posten har
   * en engangskode, står koden også i emnet. Da får hver e-post sitt eget
   * emne: Gmail og andre slår ellers sammen like e-poster til én tråd og
   * skjuler teksten som gjentar seg, og da forsvinner knappen og koden i den
   * nyeste. Koden kan dessuten leses uten å åpne e-posten.
   */
  subject: string;
  html: string;
};

const SITE = '{{ .SiteURL }}';
// Kontaktadressen i bunnteksten er den samme som appen bruker
// (CONTACT_TO_EMAIL). Bygg malene på nytt når den endres. Bunnteksten lenker
// til Site URL, altså portalen der mottakeren logger inn, ikke til
// PUBLIC_SITE_URL som e-postene fra appen.
const brand = { siteUrl: SITE, homeUrl: SITE, phone: SUPPORT_PHONE, email: CONTACT_EMAIL };

/**
 * Lenken går til en side i appen der brukeren selv trykker «Logg inn».
 * Mange bedrifter har e-postfiltre som åpner alle lenker for å sjekke dem;
 * en lenke som logget inn med en gang ville vært brukt opp før mottakeren
 * rakk å klikke. Token-hashen kan dessuten løses inn på en annen enhet enn
 * den som ba om lenken.
 */
const confirmUrl = (type: string) => `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}`;

const once = `Lenken og koden kan brukes én gang og virker i ${LOGIN_VALID_MINUTES} minutter.`;
const ignore = 'Ba du ikke om dette, kan du se bort fra e-posten. Ingen kommer inn uten lenken eller koden.';

export const AUTH_TEMPLATES: AuthTemplate[] = [
  {
    file: 'magic-link.html',
    supabaseName: 'Magic Link',
    subject: 'Innloggingskode {{ .Token }} til Min side',
    html: shell({
      title: 'Logg inn på Min side hos NorthWestCoast',
      preheader: 'Trykk på knappen for å logge inn. Du trenger ikke passord.',
      heading: 'Logg inn på Min side',
      body: [
        p('Trykk på knappen for å logge inn. Du trenger ikke passord.'),
        button('Logg inn', confirmUrl('email')),
        p('Åpner du e-posten på en annen enhet, kan du i stedet skrive inn denne koden på innloggingssiden:'),
        code('{{ .Token }}'),
        small(`${once} ${ignore}`),
        fallbackUrl('Virker ikke knappen? Kopier denne adressen inn i nettleseren:', confirmUrl('email')),
        small(`In English: use the button above to sign in to Min side at NorthWestCoast, or enter the code on the sign-in page. The link and the code can be used once and expire after ${LOGIN_VALID_MINUTES} minutes. If you did not ask for this, you can ignore this email.`),
      ],
      reason: html`Du får denne e-posten fordi noen ba om innlogging med adressen {{ .Email }} på ${SITE}.`.value,
      brand,
    }),
  },
  {
    file: 'confirm-signup.html',
    supabaseName: 'Confirm signup',
    subject: 'Velkommen til Min side. Innloggingskoden din er {{ .Token }}',
    html: shell({
      title: 'Velkommen til Min side hos NorthWestCoast',
      preheader: 'Bekreft e-postadressen og logg inn. Kontoen opprettes samtidig.',
      heading: 'Velkommen til Min side',
      body: [
        p('Trykk på knappen for å bekrefte e-postadressen og logge inn. Kontoen opprettes samtidig, og du trenger ikke passord.'),
        button('Bekreft og logg inn', confirmUrl('email')),
        p('Åpner du e-posten på en annen enhet, kan du i stedet skrive inn denne koden på innloggingssiden:'),
        code('{{ .Token }}'),
        p('På Min side registrerer du selskapet ditt og legger til leiderne med serienummeret som står på leideren. Da får du servicefrister, vedlikeholdslogg og dokumentasjon samlet på ett sted.'),
        small(`${once} ${ignore}`),
        fallbackUrl('Virker ikke knappen? Kopier denne adressen inn i nettleseren:', confirmUrl('email')),
        small(`In English: use the button above to confirm your email address and sign in to Min side at NorthWestCoast. Your account is created at the same time, and no password is needed. The link and the code can be used once and expire after ${LOGIN_VALID_MINUTES} minutes.`),
      ],
      reason: html`Du får denne e-posten fordi noen ba om en konto med adressen {{ .Email }} på ${SITE}.`.value,
      brand,
    }),
  },
  {
    file: 'email-change.html',
    supabaseName: 'Change Email Address',
    subject: 'Bekreft ny e-postadresse hos NorthWestCoast',
    html: shell({
      title: 'Bekreft ny e-postadresse hos NorthWestCoast',
      preheader: 'Bekreft at kontoen din på Min side skal bruke den nye adressen.',
      heading: 'Bekreft ny e-postadresse',
      body: [
        p(html`Det er bedt om å bytte e-postadresse på kontoen din på Min side, fra <strong>{{ .Email }}</strong> til <strong>{{ .NewEmail }}</strong>.`),
        button('Bekreft ny adresse', confirmUrl('email_change')),
        small('Lenken kan brukes én gang. Ba du ikke om dette, skal du ikke trykke på knappen. Gi oss gjerne beskjed, så ser vi på kontoen.'),
        fallbackUrl('Virker ikke knappen? Kopier denne adressen inn i nettleseren:', confirmUrl('email_change')),
        small('In English: a change of email address has been requested for your account at NorthWestCoast. Use the button above to confirm it. If you did not ask for this, do not use the link.'),
      ],
      reason: html`Du får denne e-posten fordi det er bedt om å endre e-postadressen på en konto på ${SITE}.`.value,
      brand,
    }),
  },
  {
    file: 'recovery.html',
    supabaseName: 'Reset Password',
    subject: 'Logg inn på Min side hos NorthWestCoast',
    html: shell({
      title: 'Logg inn på Min side hos NorthWestCoast',
      preheader: 'Min side bruker ikke passord. Trykk på knappen for å logge inn.',
      heading: 'Logg inn på Min side',
      body: [
        p('Min side bruker ikke passord. Trykk på knappen for å logge inn.'),
        button('Logg inn', confirmUrl('recovery')),
        small(`Lenken kan brukes én gang og virker i ${LOGIN_VALID_MINUTES} minutter. ${ignore}`),
        fallbackUrl('Virker ikke knappen? Kopier denne adressen inn i nettleseren:', confirmUrl('recovery')),
        small(`In English: Min side at NorthWestCoast does not use passwords. Use the button above to sign in. The link can be used once and expires after ${LOGIN_VALID_MINUTES} minutes. If you did not ask for this, you can ignore this email.`),
      ],
      reason: html`Du får denne e-posten fordi noen ba om tilgang med adressen {{ .Email }} på ${SITE}.`.value,
      brand,
    }),
  },
];
