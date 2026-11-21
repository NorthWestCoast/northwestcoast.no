import { fmt, fmtLength } from '@/lib/pricing';
import { PORTAL_URL, SITE_URL } from '@/lib/site';
import { CERTIFICATE_NAME, CERTIFICATE_NAME_LOWER } from '@/lib/portal/labels';
import { CONTACT_EMAIL, SUPPORT_PHONE } from './config';
import {
  type Safe,
  type TableLine,
  button,
  details,
  h2,
  html,
  lineTable,
  link,
  note,
  oneLine,
  p,
  safeLabel,
  safeName,
  shell,
  small,
  unlink,
} from './layout';

/**
 * E-postmaler.
 *
 * Rene funksjoner som returnerer { subject, text, html }. Bevisst uten
 * leverandørspesifikke biblioteker (ingen React Email e.l.), slik at et
 * bytte av leverandør ikke drar med seg en omskriving av alle malene.
 * HTML-en bygges av lib/mail/layout.ts, som escaper alt som settes inn.
 *
 * To slags mottakere, og to slags forsiktighet:
 *  - Interne e-poster går til NWCs egne postkasser og gjengir det kunden skrev.
 *  - Kvitteringer går til en adresse noen har oppgitt i et skjema, og vi vet
 *    ikke at den er avsenderens egen. De gjengir derfor ikke fritekst: ingen
 *    kommentar, ingen melding, og ingenting fra skjemaet i emnefeltet. Navn
 *    og fartøysnavn slipper bare gjennom et smalt tegnsett (safeName,
 *    safeLabel). Slik kan ikke skjemaene brukes til å sende andre en e-post
 *    «fra NorthWestCoast» med innhold avsenderen selv har valgt.
 *
 * Innloggings-e-postene (lenke og kode) sendes av Supabase, ikke herfra.
 * De lages av scripts/build-auth-mail.mts og ligger i supabase/templates/.
 */

export type Mail = { subject: string; text: string; html: string };
type MailLang = 'no' | 'en';

const brand = () => ({ siteUrl: SITE_URL, phone: SUPPORT_PHONE, email: CONTACT_EMAIL });
const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');

const SIGN = {
  no: ['Med vennlig hilsen', 'NorthWestCoast AS'],
  en: ['Kind regards', 'NorthWestCoast AS'],
} as const;

const signature = (lang: MailLang = 'no'): Safe => p(SIGN[lang].join('\n'));
const greeting = (name: string | null | undefined, lang: MailLang = 'no'): string => {
  const safe = safeName(name);
  const hi = lang === 'en' ? 'Hi' : 'Hei';
  return safe ? `${hi} ${safe},` : `${hi},`;
};

/** Norsk dato fra «2026-12-01». Tom streng ved ugyldig verdi. */
function dateText(iso: string | null | undefined, lang: MailLang = 'no'): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(lang === 'en' ? 'en-GB' : 'nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/* ── Bestillingslinjer ────────────────────────────────────────────────────── */

export type OrderLineView = {
  productName: string;
  productNumber: string;
  /** Leider, skap bestilt alene eller reservedel. Uten verdi: leider. */
  kind?: 'ladder' | 'cabinet' | 'spare_part';
  /** Ønsket lengde i meter når linja er en spesiallengde (halvmeter). */
  customLength?: number | null;
  steps: number | null;
  qty: number;
  /** Skapet som følger leideren på linja. */
  cabinetName: string | null;
  lineTotal: number;
  /** Pris avtales på forespørsel – vises uten sum. */
  onRequest?: boolean;
};

const TEXT = {
  no: {
    steps: 'trinn',
    cabinet: 'Oppbevaringsskap',
    onRequest: 'pris på forespørsel',
    withoutLadder: 'uten leider',
    amount: (amount: number) => `${fmt(amount)} kr`,
    sum: (amount: number) => `Sum: ${fmt(amount)} kr`,
  },
  en: {
    steps: 'steps',
    cabinet: 'Storage cabinet',
    onRequest: 'price on request',
    withoutLadder: 'without ladder',
    amount: (amount: number) => `NOK ${fmt(amount)}`,
    sum: (amount: number) => `Sum: NOK ${fmt(amount)}`,
  },
} as const;

/** Produktnavnet slik det står i databasen, eller på engelsk i kvitteringen. */
function lineName(line: OrderLineView, lang: MailLang): string {
  if (lang === 'no') return line.productName;
  if (typeof line.customLength === 'number') {
    return `Argostep – ${fmtLength(line.customLength, 'en')} m (custom length)`;
  }
  return line.productName.replace(/^Oppbevaringsskap\s+/i, 'Storage cabinet ');
}

/**
 * Det som står i parentes etter navnet. Skapet heter det samme som
 * produktnummeret sitt, og leidere på forespørsel har ikke et endelig
 * produktnummer å vise.
 */
function lineDetail(line: OrderLineView, lang: MailLang): string {
  const t = TEXT[lang];
  if ((line.kind ?? 'ladder') === 'cabinet') return t.withoutLadder;
  if (line.onRequest || typeof line.customLength === 'number') return '';
  return [line.productNumber, line.steps ? `${line.steps} ${t.steps}` : ''].filter(Boolean).join(', ');
}

/** Én linje i bestillingen som tekst: leider, skap bestilt alene eller reservedel. */
function lineSummary(line: OrderLineView, lang: MailLang): string {
  const t = TEXT[lang];
  const detail = lineDetail(line, lang);
  const head = `${line.qty} × ${lineName(line, lang)}${detail ? ` (${detail})` : ''}`;

  if (line.onRequest) {
    return [
      `${head} – ${t.onRequest}`,
      line.cabinetName ? `  + ${t.cabinet} ${line.cabinetName} (${t.onRequest})` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    head,
    line.cabinetName ? `  + ${t.cabinet} ${line.cabinetName}` : null,
    `  ${t.sum(line.lineTotal)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

const orderSummary = (lines: OrderLineView[], lang: MailLang = 'no') =>
  lines.map((line) => lineSummary(line, lang)).join('\n\n');

/** De samme linjene til HTML-tabellen. */
const orderRows = (lines: OrderLineView[], lang: MailLang = 'no'): TableLine[] =>
  lines.map((line) => {
    const t = TEXT[lang];
    const detail = lineDetail(line, lang);
    return {
      title: `${line.qty} × ${lineName(line, lang)}`,
      sub: [detail, line.cabinetName ? `+ ${t.cabinet} ${line.cabinetName}` : ''].filter(Boolean),
      amount: line.onRequest ? t.onRequest : t.amount(line.lineTotal),
    };
  });

/** «2 leidere, 1 skap» – hva bestillingen består av, til emnefelt og overskrift. */
function unitsText(lines: OrderLineView[]): string {
  const count = (kind: NonNullable<OrderLineView['kind']>) =>
    lines.reduce((sum, line) => sum + ((line.kind ?? 'ladder') === kind ? line.qty : 0), 0);
  const ladders = count('ladder');
  const cabinets = count('cabinet');
  const parts = count('spare_part');

  return [
    ladders ? `${ladders} ${ladders === 1 ? 'leider' : 'leidere'}` : '',
    cabinets ? `${cabinets} skap` : '',
    parts ? `${parts} ${parts === 1 ? 'reservedel' : 'reservedeler'}` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/* ── Bestilling ───────────────────────────────────────────────────────────── */

/** Til NWC: ny bestilling fra nettsiden. */
export function orderInternal(args: {
  orderNumber: string;
  name: string;
  email: string;
  phone?: string;
  vessel?: string;
  notes?: string;
  lines: OrderLineView[];
  total: number;
  /** Lenke rett til bestillingen i admin. */
  adminUrl?: string;
}): Mail {
  args = { ...args, name: oneLine(args.name), email: oneLine(args.email), phone: oneLine(args.phone, 60), vessel: oneLine(args.vessel) };
  const what = unitsText(args.lines);
  const onRequest = args.lines.some((line) => line.onRequest);
  // Uten fast pris på noe er «0 kr» misvisende i emnefeltet.
  const amount = onRequest
    ? args.total > 0 ? `${fmt(args.total)} kr + forespørsel` : 'pris på forespørsel'
    : `${fmt(args.total)} kr`;
  const subject = oneLine(
    `Bestilling ${args.orderNumber}: ${what} – ${amount} – ${args.vessel || args.name}`,
  );

  return {
    subject,
    text: [
      `Ny bestillingsforespørsel fra nettsiden`,
      ``,
      `Ordrenr:   ${args.orderNumber}`,
      `Kunde:     ${args.name}`,
      `E-post:    ${args.email}`,
      `Telefon:   ${args.phone || '–'}`,
      `Fartøy/Rederi: ${args.vessel || '–'}`,
      ``,
      `--- Bestilling (${what}) ---`,
      ``,
      orderSummary(args.lines),
      ``,
      `TOTALSUM: ${fmt(args.total)} kr eks. mva.`,
      ...(onRequest ? [`Linjer med pris på forespørsel er ikke med i summen.`] : []),
      ``,
      `--- Kommentar ---`,
      args.notes || '–',
      ...(args.adminUrl ? [``, `Åpne bestillingen: ${args.adminUrl}`] : []),
    ].join('\n'),
    html: shell({
      title: subject,
      preheader: `${what} – ${amount} – ${oneLine(args.vessel || args.name, 80)}`,
      heading: `Ny bestilling ${args.orderNumber}`,
      body: [
        details([
          ['Kunde', args.name],
          ['E-post', args.email],
          ['Telefon', args.phone],
          ['Fartøy/rederi', args.vessel],
        ]),
        h2(`Bestillingen (${what})`),
        lineTable(orderRows(args.lines), {
          label: 'Totalsum eks. mva.',
          amount: `${fmt(args.total)} kr`,
          hint: onRequest ? 'Linjer med pris på forespørsel er ikke med i summen.' : undefined,
        }),
        ...(args.notes ? [h2('Kommentar fra kunden'), note(args.notes)] : []),
        ...(args.adminUrl ? [button('Åpne bestillingen i admin', args.adminUrl)] : []),
        small('Svar på denne e-posten for å svare kunden direkte.'),
      ],
      reason: `Sendt automatisk fra bestillingsskjemaet på ${SITE_HOST}.`,
      brand: brand(),
    }),
  };
}

/** Til kunden: kvittering for mottatt bestilling. */
export function orderReceipt(args: {
  orderNumber: string;
  name: string;
  lines: OrderLineView[];
  total: number;
  lang?: MailLang;
}): Mail {
  const lang = args.lang ?? 'no';
  const onRequest = args.lines.some((line) => line.onRequest);
  const hello = greeting(args.name, lang);

  if (lang === 'en') {
    const subject = `We have received your order (${args.orderNumber})`;
    const hint = 'Lines marked "price on request" are not included in the total. We will send you a quote.';
    return {
      subject,
      text: [
        hello,
        ``,
        `Thank you for your request. We have registered it as ${args.orderNumber} and`,
        `will be in touch with confirmation and delivery time.`,
        ``,
        orderSummary(args.lines, 'en'),
        ``,
        `Total: NOK ${fmt(args.total)} excl. VAT.`,
        ...(onRequest ? [hint] : []),
        ``,
        `Prices are indicative. The final quote is confirmed by us.`,
        ``,
        `Need us quickly? Call ${SUPPORT_PHONE} or reply to this email.`,
        ``,
        ...SIGN.en,
        `PO Box 79, 6281 Søvik, Norway`,
      ].join('\n'),
      html: shell({
        lang,
        title: subject,
        preheader: `Registered as ${args.orderNumber}. We will be in touch with confirmation and delivery time.`,
        heading: 'We have received your order',
        body: [
          p(hello),
          p(html`Thank you for your request. We have registered it as <strong>${args.orderNumber}</strong> and will be in touch with confirmation and delivery time.`),
          lineTable(orderRows(args.lines, 'en'), {
            label: 'Total excl. VAT',
            amount: `NOK ${fmt(args.total)}`,
            hint: onRequest ? hint : undefined,
          }),
          small('Prices are indicative. The final quote is confirmed by us.'),
          p(`Need us quickly? Call ${SUPPORT_PHONE} or reply to this email.`),
          signature('en'),
        ],
        reason: `You are receiving this email because an order request was sent with this address from ${SITE_HOST}. If that was not you, you can ignore it; nothing is ordered until we have confirmed it with you.`,
        brand: brand(),
      }),
    };
  }

  const subject = `Vi har mottatt bestillingen din (${args.orderNumber})`;
  const hint = 'Linjer med pris på forespørsel er ikke med i summen. Du får tilbud fra oss.';
  return {
    subject,
    text: [
      hello,
      ``,
      `Takk for forespørselen. Vi har registrert den som ${args.orderNumber} og`,
      `tar kontakt for bekreftelse og leveringstid.`,
      ``,
      orderSummary(args.lines),
      ``,
      `Totalsum: ${fmt(args.total)} kr eks. mva.`,
      ...(onRequest ? [hint] : []),
      ``,
      `Prisene er veiledende. Endelig tilbud bekreftes av oss.`,
      ``,
      `Trenger du oss raskt? Ring ${SUPPORT_PHONE} eller svar på denne e-posten.`,
      ``,
      ...SIGN.no,
      `Postboks 79, 6281 Søvik`,
    ].join('\n'),
    html: shell({
      title: subject,
      preheader: `Registrert som ${args.orderNumber}. Vi tar kontakt for bekreftelse og leveringstid.`,
      heading: 'Vi har mottatt bestillingen din',
      body: [
        p(hello),
        p(html`Takk for forespørselen. Vi har registrert den som <strong>${args.orderNumber}</strong> og tar kontakt for bekreftelse og leveringstid.`),
        lineTable(orderRows(args.lines), {
          label: 'Totalsum eks. mva.',
          amount: `${fmt(args.total)} kr`,
          hint: onRequest ? hint : undefined,
        }),
        small('Prisene er veiledende. Endelig tilbud bekreftes av oss.'),
        p(`Trenger du oss raskt? Ring ${SUPPORT_PHONE} eller svar på denne e-posten.`),
        signature(),
      ],
      reason: `Du får denne e-posten fordi det ble sendt en bestillingsforespørsel med denne adressen fra ${SITE_HOST}. Var det ikke deg, kan du se bort fra den: ingenting er bestilt før vi har bekreftet det med deg.`,
      brand: brand(),
    }),
  };
}

/** Linjer i en oppfølgings-e-post: bare hva og hvor mange, uten priser. */
export type FollowUpLine = { name: string; qty: number; detail?: string | null };

const followUpRows = (lines: FollowUpLine[]): TableLine[] =>
  lines.map((line) => ({
    title: `${line.qty} × ${line.name}`,
    sub: line.detail ? [line.detail] : [],
    amount: '',
  }));

const followUpText = (lines: FollowUpLine[]) =>
  lines.map((line) => `${line.qty} × ${line.name}${line.detail ? ` (${line.detail})` : ''}`).join('\n');

/**
 * Til kunden: bestillingen er bekreftet og lagt til produksjon.
 *
 * Bestillingen har ikke noe språk lagret, så e-posten er norsk med et kort
 * engelsk sammendrag til slutt.
 */
export function orderConfirmed(args: {
  orderNumber: string;
  name: string;
  lines: FollowUpLine[];
  /** Forventet ferdig, «2026-12-01». */
  expected?: string | null;
}): Mail {
  const hello = greeting(args.name);
  const expected = dateText(args.expected);
  const expectedEn = dateText(args.expected, 'en');
  const subject = `Bestilling ${args.orderNumber} er bekreftet`;
  const english = `In English: your order ${args.orderNumber} has been confirmed and scheduled for production.${
    expectedEn ? ` Expected completion: ${expectedEn}.` : ''
  } Questions? Reply to this email or call ${SUPPORT_PHONE}.`;

  return {
    subject,
    text: [
      hello,
      ``,
      `Vi har bekreftet bestilling ${args.orderNumber}, og den er lagt inn til produksjon.`,
      ...(expected ? [`Forventet ferdig: ${expected}`] : []),
      ``,
      followUpText(args.lines),
      ``,
      `Har du konto på Min side, kan du følge bestillingen der:`,
      `${PORTAL_URL}/minside/bestillinger`,
      ``,
      `Spørsmål? Svar på denne e-posten eller ring ${SUPPORT_PHONE}.`,
      ``,
      ...SIGN.no,
      ``,
      english,
    ].join('\n'),
    html: shell({
      title: subject,
      preheader: expected ? `Lagt inn til produksjon. Forventet ferdig ${expected}.` : 'Lagt inn til produksjon.',
      heading: 'Bestillingen er bekreftet',
      body: [
        p(hello),
        p(html`Vi har bekreftet bestilling <strong>${args.orderNumber}</strong>, og den er lagt inn til produksjon.`),
        details([
          ['Ordrenummer', args.orderNumber],
          ['Forventet ferdig', expected],
        ]),
        lineTable(followUpRows(args.lines)),
        p(html`Har du konto på Min side, kan du ${link('følge bestillingen der', `${PORTAL_URL}/minside/bestillinger`)}.`),
        p(`Spørsmål? Svar på denne e-posten eller ring ${SUPPORT_PHONE}.`),
        signature(),
        small(english),
      ],
      reason: `Du får denne e-posten fordi du står som kontaktperson på bestilling ${args.orderNumber} hos NorthWestCoast.`,
      brand: brand(),
    }),
  };
}

/** Til kunden: alt i bestillingen er levert. */
export function orderDelivered(args: {
  orderNumber: string;
  name: string;
  lines: FollowUpLine[];
  /** Serienumrene på leiderne i leveransen. */
  serials?: string[];
}): Mail {
  const hello = greeting(args.name);
  const serials = (args.serials ?? []).filter(Boolean);
  const subject = `Bestilling ${args.orderNumber} er levert`;
  const english = `In English: everything in order ${args.orderNumber} is now registered as delivered. Service deadlines and the maintenance log for each ladder are available on Min side at ${SITE_HOST}.`;

  return {
    subject,
    text: [
      hello,
      ``,
      `Alt i bestilling ${args.orderNumber} er nå registrert som levert.`,
      ``,
      followUpText(args.lines),
      ...(serials.length ? [``, `Serienummer: ${serials.join(', ')}`] : []),
      ``,
      `På Min side finner du leiderne med serienummer, servicefrister og`,
      `vedlikeholdslogg. Der loggfører dere også egne kontroller:`,
      `${PORTAL_URL}/minside`,
      ``,
      `Er noe ikke som det skal? Svar på denne e-posten eller ring ${SUPPORT_PHONE}.`,
      ``,
      ...SIGN.no,
      ``,
      english,
    ].join('\n'),
    html: shell({
      title: subject,
      preheader: 'Leiderne ligger på Min side med serienummer, servicefrister og vedlikeholdslogg.',
      heading: 'Bestillingen er levert',
      body: [
        p(hello),
        p(html`Alt i bestilling <strong>${args.orderNumber}</strong> er nå registrert som levert.`),
        lineTable(followUpRows(args.lines)),
        details([['Serienummer', serials.join(', ')]]),
        p('På Min side finner du leiderne med serienummer, servicefrister og vedlikeholdslogg. Der loggfører dere også egne kontroller.'),
        button('Åpne Min side', `${PORTAL_URL}/minside`),
        p(`Er noe ikke som det skal? Svar på denne e-posten eller ring ${SUPPORT_PHONE}.`),
        signature(),
        small(english),
      ],
      reason: `Du får denne e-posten fordi du står som kontaktperson på bestilling ${args.orderNumber} hos NorthWestCoast.`,
      brand: brand(),
    }),
  };
}

/* ── Kontaktskjema ────────────────────────────────────────────────────────── */

/** Til NWC: ny henvendelse fra kontaktskjemaet. */
export function contactInternal(args: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  product?: string;
  message?: string;
}): Mail {
  args = {
    ...args,
    name: oneLine(args.name),
    email: oneLine(args.email),
    phone: oneLine(args.phone, 60),
    company: oneLine(args.company),
    product: oneLine(args.product),
  };
  const subject = oneLine(`Ny forespørsel fra ${args.name} – ${args.company || 'ukjent firma'}`);
  return {
    subject,
    text: [
      `Navn: ${args.name}`,
      `E-post: ${args.email}`,
      `Telefon: ${args.phone || '–'}`,
      `Fartøy/Rederi: ${args.company || '–'}`,
      `Produkt: ${args.product || '–'}`,
      ``,
      `Melding:`,
      args.message || '–',
    ].join('\n'),
    html: shell({
      title: subject,
      preheader: oneLine(args.message || args.product || '', 120),
      heading: 'Ny henvendelse fra nettsiden',
      body: [
        details([
          ['Navn', args.name],
          ['E-post', args.email],
          ['Telefon', args.phone],
          ['Fartøy/rederi', args.company],
          ['Gjelder', args.product],
        ]),
        ...(args.message ? [h2('Melding'), note(args.message)] : []),
        small('Svar på denne e-posten for å svare avsenderen direkte. Henvendelsen ligger også i admin.'),
      ],
      reason: `Sendt automatisk fra kontaktskjemaet på ${SITE_HOST}.`,
      brand: brand(),
    }),
  };
}

/**
 * Til avsenderen: bekreftelse på at henvendelsen er mottatt.
 *
 * Gjengir bevisst ikke meldingen: e-posten går til en adresse vi ikke har
 * bekreftet, og skal ikke kunne fylles med andres tekst.
 */
export function contactReceipt(args: { name: string; lang?: MailLang }): Mail {
  const lang = args.lang ?? 'no';
  const hello = greeting(args.name, lang);

  if (lang === 'en') {
    const subject = 'We have received your message';
    return {
      subject,
      text: [
        hello,
        ``,
        `Thank you for getting in touch. Your message has been registered, and we`,
        `will reply as soon as we can.`,
        ``,
        `Is it urgent? Call us on ${SUPPORT_PHONE}.`,
        ``,
        ...SIGN.en,
      ].join('\n'),
      html: shell({
        lang,
        title: subject,
        preheader: 'Your message has been registered, and we will reply as soon as we can.',
        heading: 'We have received your message',
        body: [
          p(hello),
          p('Thank you for getting in touch. Your message has been registered, and we will reply as soon as we can.'),
          p(`Is it urgent? Call us on ${SUPPORT_PHONE}.`),
          signature('en'),
        ],
        reason: `You are receiving this email because this address was entered in the contact form at ${SITE_HOST}. If that was not you, you can ignore it.`,
        brand: brand(),
      }),
    };
  }

  const subject = 'Vi har mottatt henvendelsen din';
  return {
    subject,
    text: [
      hello,
      ``,
      `Takk for at du tok kontakt. Henvendelsen er registrert, og vi svarer så`,
      `snart vi kan.`,
      ``,
      `Haster det? Ring oss på ${SUPPORT_PHONE}.`,
      ``,
      ...SIGN.no,
    ].join('\n'),
    html: shell({
      title: subject,
      preheader: 'Henvendelsen er registrert, og vi svarer så snart vi kan.',
      heading: 'Vi har mottatt henvendelsen din',
      body: [
        p(hello),
        p('Takk for at du tok kontakt. Henvendelsen er registrert, og vi svarer så snart vi kan.'),
        p(`Haster det? Ring oss på ${SUPPORT_PHONE}.`),
        signature(),
      ],
      reason: `Du får denne e-posten fordi adressen ble oppgitt i kontaktskjemaet på ${SITE_HOST}. Var det ikke deg, kan du se bort fra den.`,
      brand: brand(),
    }),
  };
}

/**
 * Til den som meldte seg på nyhetsbrevet: bekreft påmeldingen.
 *
 * Påmeldingen gjelder først når lenken er brukt, så ingen kan melde på en
 * adresse som ikke er deres egen. Bare fast tekst.
 */
export function newsletterConfirm(args: { confirmUrl: string; lang?: MailLang }): Mail {
  const lang = args.lang ?? 'no';

  if (lang === 'en') {
    const subject = 'Confirm your newsletter subscription';
    return {
      subject,
      text: [
        'Hi,',
        '',
        'Please confirm that you want the newsletter from NorthWestCoast:',
        args.confirmUrl,
        '',
        'The link is valid for seven days. If you did not ask for this, you can',
        'ignore this email, and you will not be subscribed.',
        '',
        ...SIGN.en,
      ].join('\n'),
      html: shell({
        lang,
        title: subject,
        preheader: 'One click, and you are subscribed.',
        heading: 'Confirm your subscription',
        body: [
          p('Hi,'),
          p('Please confirm that you want the newsletter from NorthWestCoast: maritime safety, Argostep and Norwegian maritime regulations.'),
          button('Confirm subscription', args.confirmUrl),
          small('The link is valid for seven days. If you did not ask for this, you can ignore this email, and you will not be subscribed.'),
          signature('en'),
        ],
        reason: `You are receiving this email because this address was entered in the newsletter form at ${SITE_HOST}.`,
        brand: brand(),
      }),
    };
  }

  const subject = 'Bekreft påmeldingen til nyhetsbrevet';
  return {
    subject,
    text: [
      'Hei,',
      '',
      'Bekreft at du vil ha nyhetsbrevet fra NorthWestCoast:',
      args.confirmUrl,
      '',
      'Lenken virker i sju dager. Ba du ikke om dette, kan du se bort fra',
      'e-posten, og du blir ikke påmeldt.',
      '',
      ...SIGN.no,
    ].join('\n'),
    html: shell({
      title: subject,
      preheader: 'Ett klikk, så er du påmeldt.',
      heading: 'Bekreft påmeldingen',
      body: [
        p('Hei,'),
        p('Bekreft at du vil ha nyhetsbrevet fra NorthWestCoast: maritim sikkerhet, Argostep og norske sjøfartsforskrifter.'),
        button('Bekreft påmeldingen', args.confirmUrl),
        small('Lenken virker i sju dager. Ba du ikke om dette, kan du se bort fra e-posten, og du blir ikke påmeldt.'),
        signature(),
      ],
      reason: `Du får denne e-posten fordi adressen ble oppgitt i påmeldingen til nyhetsbrev på ${SITE_HOST}.`,
      brand: brand(),
    }),
  };
}

/* ── Vedlikehold ──────────────────────────────────────────────────────────── */

export type MaintenanceFields = {
  name: string;
  boat: string;
  imo?: string;
  serial: string;
  email?: string;
  notes?: string;
  photoCount: number;
};

/** Til NWC: vedlikehold meldt inn fra det åpne skjemaet. */
export function maintenanceInternal(args: MaintenanceFields & { matchedLadder: boolean; adminUrl: string }): Mail {
  args = {
    ...args,
    name: oneLine(args.name),
    boat: oneLine(args.boat),
    imo: oneLine(args.imo, 30),
    serial: oneLine(args.serial, 80),
    email: oneLine(args.email),
  };
  const subject = oneLine(`Vedlikehold registrert – ${args.boat} (${args.serial})`);
  const matched = args.matchedLadder
    ? 'ja'
    : 'NEI – serienummeret finnes ikke i registeret';
  const photos = args.photoCount > 0
    ? `${args.photoCount === 1 ? 'Bildet' : `De ${args.photoCount} bildene`} som ble lastet opp, ligger i admin under «Vedlikeholdsrapporter».`
    : 'Ingen bilder ble lastet opp. Rapporten ligger i admin under «Vedlikeholdsrapporter».';

  return {
    subject,
    text: [
      `Navn: ${args.name}`,
      `Navn på båt: ${args.boat}`,
      `IMO nr: ${args.imo || '–'}`,
      `Serienummer på leider: ${args.serial}`,
      `E-post: ${args.email || '–'}`,
      `Koblet til registrert leider: ${matched}`,
      ``,
      `Kommentar:`,
      args.notes || '–',
      ``,
      `Antall vedlagte bilder: ${args.photoCount}`,
      ``,
      photos,
      args.adminUrl,
    ].join('\n'),
    html: shell({
      title: subject,
      preheader: oneLine(args.notes || `${args.photoCount} bilder`, 120),
      heading: 'Vedlikehold registrert',
      body: [
        details([
          ['Navn', args.name],
          ['Fartøy', args.boat],
          ['IMO-nummer', args.imo],
          ['Serienummer på leider', args.serial],
          ['E-post', args.email],
          ['Koblet til registrert leider', matched],
          ['Bilder', String(args.photoCount)],
        ]),
        ...(args.notes ? [h2('Kommentar'), note(args.notes)] : []),
        p(photos),
        button('Åpne vedlikeholdsrapporter', args.adminUrl),
      ],
      reason: `Sendt automatisk fra vedlikeholdsskjemaet på ${SITE_HOST}.`,
      brand: brand(),
    }),
  };
}

/** Serienummer slik de ser ut på leiderne: bokstaver, tall og bindestrek. */
const SERIAL = /^[A-Za-z0-9][A-Za-z0-9-]{2,29}$/;

/**
 * Til den som meldte inn: kvittering som kan vises ved tilsyn.
 *
 * Kvitteringen går til en adresse fra et åpent skjema, så den gjengir ikke
 * kommentaren og har ingenting fra skjemaet i emnefeltet. Fartøysnavn og
 * serienummer tas bare med når de ser ut som nettopp det. Selve rapporten,
 * med kommentar og bilder, ligger hos NWC og på leiderens side på Min side.
 */
export function maintenanceReceipt(args: MaintenanceFields & { lang?: MailLang; receivedAt?: Date }): Mail {
  const lang = args.lang ?? 'no';
  const boat = safeLabel(args.boat, 50);
  const serialRaw = oneLine(args.serial, 30);
  const serial = SERIAL.test(serialRaw) ? serialRaw : '';
  const reporter = safeName(args.name);
  const hello = greeting(args.name, lang);
  const received = (args.receivedAt ?? new Date()).toLocaleDateString(lang === 'en' ? 'en-GB' : 'nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Oslo',
  });

  if (lang === 'en') {
    const subject = 'Receipt: maintenance logged';
    return {
      subject,
      text: [
        hello,
        ``,
        `We have registered the maintenance carried out on your Argostep ladder.`,
        `Keep this email as documentation.`,
        ``,
        `Registered: ${received}`,
        ...(reporter ? [`Reported by: ${reporter}`] : []),
        ...(boat ? [`Vessel: ${boat}`] : []),
        ...(serial ? [`Ladder serial number: ${serial}`] : []),
        `Attached photos: ${args.photoCount}`,
        ``,
        `The report itself, with your comment and photos, is stored with us.`,
        `Questions? Reply to this email or call ${SUPPORT_PHONE}.`,
        ``,
        ...SIGN.en,
      ].join('\n'),
      html: shell({
        lang,
        title: subject,
        preheader: 'Keep this email as documentation of the maintenance carried out.',
        heading: 'Maintenance logged',
        body: [
          p(hello),
          p('We have registered the maintenance carried out on your Argostep ladder. Keep this email as documentation.'),
          details([
            ['Registered', received],
            ['Reported by', reporter],
            ['Vessel', boat],
            ['Ladder serial number', serial],
            ['Attached photos', String(args.photoCount)],
          ]),
          small(`The report itself, with your comment and photos, is stored with us. Questions? Reply to this email or call ${SUPPORT_PHONE}.`),
          signature('en'),
        ],
        reason: `You are receiving this email because this address was entered in the maintenance form at ${SITE_HOST}. If that was not you, you can ignore it.`,
        brand: brand(),
      }),
    };
  }

  const subject = 'Kvittering: vedlikehold registrert';
  return {
    subject,
    text: [
      hello,
      ``,
      `Vi har registrert utført vedlikehold på Argostep-leideren deres.`,
      `Ta vare på denne e-posten som dokumentasjon.`,
      ``,
      `Registrert: ${received}`,
      ...(reporter ? [`Meldt inn av: ${reporter}`] : []),
      ...(boat ? [`Fartøy: ${boat}`] : []),
      ...(serial ? [`Serienummer på leider: ${serial}`] : []),
      `Antall vedlagte bilder: ${args.photoCount}`,
      ``,
      `Selve rapporten, med kommentaren og bildene, ligger hos oss.`,
      `Spørsmål? Svar på denne e-posten eller ring ${SUPPORT_PHONE}.`,
      ``,
      ...SIGN.no,
    ].join('\n'),
    html: shell({
      title: subject,
      preheader: 'Ta vare på denne e-posten som dokumentasjon på utført vedlikehold.',
      heading: 'Vedlikehold registrert',
      body: [
        p(hello),
        p('Vi har registrert utført vedlikehold på Argostep-leideren deres. Ta vare på denne e-posten som dokumentasjon.'),
        details([
          ['Registrert', received],
          ['Meldt inn av', reporter],
          ['Fartøy', boat],
          ['Serienummer på leider', serial],
          ['Vedlagte bilder', String(args.photoCount)],
        ]),
        small(`Selve rapporten, med kommentaren og bildene, ligger hos oss. Spørsmål? Svar på denne e-posten eller ring ${SUPPORT_PHONE}.`),
        signature(),
      ],
      reason: `Du får denne e-posten fordi adressen ble oppgitt i vedlikeholdsskjemaet på ${SITE_HOST}. Var det ikke deg, kan du se bort fra den.`,
      brand: brand(),
    }),
  };
}

/* ── Min side ─────────────────────────────────────────────────────────────── */

/**
 * Til den inviterte: tilgang til et selskap, et fartøy eller en leider.
 *
 * Invitasjonen sendes av en innlogget bruker til en adresse hun selv velger,
 * og alle kan opprette konto. E-posten viser derfor hvem som inviterer med
 * den bekreftede e-postadressen til kontoen, ikke med et navn hun har skrevet
 * selv, og den gjengir ikke meldingen: den ser mottakeren etter innlogging.
 */
export function accessInvitation(args: {
  /** Den bekreftede e-postadressen til kontoen som inviterer. */
  inviterEmail: string;
  inviterName?: string | null;
  targetName: string;
}): Mail {
  const inviterName = safeName(args.inviterName);
  const inviterEmail = oneLine(args.inviterEmail, 120);
  // Adressen vises som tekst, ikke som lenke.
  const inviter = inviterName ? `${inviterName} (${unlink(inviterEmail)})` : unlink(inviterEmail);
  const target = safeLabel(args.targetName, 60);
  const subject = 'Du er invitert til Min side hos NorthWestCoast';
  const loginUrl = `${PORTAL_URL}/logg-inn`;

  return {
    subject,
    text: [
      'Hei,',
      '',
      `${inviter} har invitert deg til Min side hos NorthWestCoast${target ? `, med tilgang til ${target}` : ''}.`,
      '',
      'Der finner du leiderens historikk, servicefrister og vedlikeholdslogg,',
      'og du kan loggføre kontroller og dele tilstandsrapporter.',
      '',
      'Logg inn eller opprett konto med denne e-postadressen, og godta',
      'invitasjonen på Min side:',
      loginUrl,
      '',
      'Du trenger ikke passord. Vi sender deg en innloggingslenke.',
      '',
      `Kjenner du ikke til dette, kan du se bort fra e-posten. Spørsmål: ${SUPPORT_PHONE}`,
      '',
      ...SIGN.no,
    ].join('\n'),
    html: shell({
      title: subject,
      preheader: 'Logg inn med denne e-postadressen. Du trenger ikke passord.',
      heading: 'Du er invitert til Min side',
      body: [
        p('Hei,'),
        p(html`<strong>${inviter}</strong> har invitert deg til Min side hos NorthWestCoast${target ? html`, med tilgang til <strong>${target}</strong>` : ''}.`),
        p('Der finner du leiderens historikk, servicefrister og vedlikeholdslogg, og du kan loggføre kontroller og dele tilstandsrapporter.'),
        button('Logg inn på Min side', loginUrl),
        small('Logg inn med denne e-postadressen og godta invitasjonen på Min side. Du trenger ikke passord: vi sender deg en innloggingslenke, og kontoen opprettes første gang du bruker den.'),
        signature(),
      ],
      reason: `Du får denne e-posten fordi en bruker på ${SITE_HOST} har invitert denne adressen til Min side. Kjenner du ikke til dette, kan du se bort fra den.`,
      brand: brand(),
    }),
  };
}

/** Til kunden: nytt servicesertifikat er utstedt for en leider. */
export function certificateIssued(args: {
  certificateNumber: string;
  serial: string;
  /** Fartøyet eller prosjektet leideren står på. */
  place?: string | null;
  validUntil: string;
  /** Den åpne kontrollsiden for sertifikatet. */
  verifyUrl: string;
  /** Leiderens side på Min side, der PDF-en ligger. */
  ladderUrl: string;
}): Mail {
  const validUntil = dateText(args.validUntil);
  const place = safeLabel(args.place, 60);
  const where = place ? ` på ${place}` : '';
  const subject = oneLine(`${CERTIFICATE_NAME} ${args.certificateNumber} er utstedt – leider ${args.serial}`);

  return {
    subject,
    text: [
      'Hei,',
      '',
      `Det er utstedt nytt ${CERTIFICATE_NAME_LOWER} for leider ${args.serial}${where}.`,
      '',
      `Sertifikatnummer: ${args.certificateNumber}`,
      ...(validUntil ? [`Gyldig til: ${validUntil}`] : []),
      '',
      'Kontrollsiden viser om sertifikatet gjelder, og kan vises ved tilsyn:',
      args.verifyUrl,
      '',
      'PDF-en ligger på leiderens side på Min side:',
      args.ladderUrl,
      '',
      ...SIGN.no,
    ].join('\n'),
    html: shell({
      title: subject,
      preheader: validUntil ? `Leider ${args.serial}. Gyldig til ${validUntil}.` : `Leider ${args.serial}.`,
      heading: `Nytt ${CERTIFICATE_NAME_LOWER}`,
      body: [
        p('Hei,'),
        p(html`Det er utstedt nytt ${CERTIFICATE_NAME_LOWER} for leider <strong>${args.serial}</strong>${where}.`),
        details([
          ['Sertifikatnummer', args.certificateNumber],
          ['Leider', args.serial],
          ['Står på', place],
          ['Gyldig til', validUntil],
        ]),
        button('Se sertifikatet', args.verifyUrl),
        p(html`Kontrollsiden viser om sertifikatet gjelder, og kan vises ved tilsyn. PDF-en ligger på ${link('leiderens side på Min side', args.ladderUrl)}.`),
        signature(),
      ],
      reason: `Du får denne e-posten fordi du har tilgang til leideren på Min side hos NorthWestCoast. Varsler på e-post slår du av under Profil på Min side.`,
      brand: brand(),
    }),
  };
}
