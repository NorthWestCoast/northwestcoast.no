import { fmt, fmtLength } from '@/lib/pricing';
import { CONTACT_EMAIL, SUPPORT_PHONE } from './index';

/**
 * E-postmaler.
 *
 * Rene funksjoner som returnerer { subject, text }. Bevisst uten
 * leverandørspesifikke biblioteker (ingen React Email e.l.), slik at et
 * bytte av leverandør ikke drar med seg en omskriving av alle malene.
 */

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

type MailLang = 'no' | 'en';

const TEXT = {
  no: {
    steps: 'trinn',
    cabinet: 'Oppbevaringsskap',
    onRequest: 'pris på forespørsel',
    withoutLadder: 'uten leider',
    sum: (amount: number) => `Sum: ${fmt(amount)} kr`,
  },
  en: {
    steps: 'steps',
    cabinet: 'Storage cabinet',
    onRequest: 'price on request',
    withoutLadder: 'without ladder',
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
 * Én linje i bestillingen som tekst. Tre slag:
 *  - leider (med eller uten skap, standardlengde eller spesiallengde)
 *  - skap bestilt alene
 *  - reservedel
 */
function lineSummary(line: OrderLineView, lang: MailLang): string {
  const t = TEXT[lang];
  const name = lineName(line, lang);
  const kind = line.kind ?? 'ladder';

  // Skapet heter det samme som produktnummeret sitt; ikke gjenta det. Leidere
  // på forespørsel har ikke et endelig produktnummer å vise.
  const detail =
    kind === 'cabinet'
      ? t.withoutLadder
      : line.onRequest || typeof line.customLength === 'number'
        ? ''
        : [line.productNumber, line.steps ? `${line.steps} ${t.steps}` : ''].filter(Boolean).join(', ');

  const head = `${line.qty} × ${name}${detail ? ` (${detail})` : ''}`;

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

export function orderInternal(args: {
  orderNumber: string;
  name: string;
  email: string;
  phone?: string;
  vessel?: string;
  notes?: string;
  lines: OrderLineView[];
  total: number;
}) {
  const what = unitsText(args.lines);
  const onRequest = args.lines.some((line) => line.onRequest);
  // Uten fast pris på noe er «0 kr» misvisende i emnefeltet.
  const amount = onRequest
    ? args.total > 0 ? `${fmt(args.total)} kr + forespørsel` : 'pris på forespørsel'
    : `${fmt(args.total)} kr`;

  return {
    subject: `Bestilling ${args.orderNumber}: ${what} – ${amount} – ${args.vessel || args.name}`,
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
    ].join('\n'),
  };
}

export function orderReceipt(args: {
  orderNumber: string;
  name: string;
  lines: OrderLineView[];
  total: number;
  lang?: 'no' | 'en';
}) {
  const onRequest = args.lines.some((line) => line.onRequest);

  if (args.lang === 'en') {
    return {
      subject: `We have received your order (${args.orderNumber}) – NorthWest Coast`,
      text: [
        `Hi ${args.name},`,
        ``,
        `Thank you for your request. We have registered it as ${args.orderNumber} and`,
        `will be in touch with confirmation and delivery time.`,
        ``,
        orderSummary(args.lines, 'en'),
        ``,
        `Total: NOK ${fmt(args.total)} excl. VAT.`,
        ...(onRequest ? [`Lines marked "price on request" are not included in the total. We will send you a quote.`] : []),
        ``,
        `Prices are indicative. The final quote is confirmed by us.`,
        ``,
        `Need us quickly: ${SUPPORT_PHONE} / ${CONTACT_EMAIL}`,
        ``,
        `Kind regards`,
        `NorthWest Coast AS`,
        `PO Box 79, 6281 Søvik, Norway`,
      ].join('\n'),
    };
  }

  return {
    subject: `Vi har mottatt bestillingen din (${args.orderNumber}) – NorthWest Coast`,
    text: [
      `Hei ${args.name},`,
      ``,
      `Takk for forespørselen! Vi har registrert den som ${args.orderNumber} og`,
      `tar kontakt for bekreftelse og leveringstid.`,
      ``,
      orderSummary(args.lines),
      ``,
      `Totalsum: ${fmt(args.total)} kr eks. mva.`,
      ...(onRequest ? [`Linjer med pris på forespørsel er ikke med i summen. Du får tilbud fra oss.`] : []),
      ``,
      `Prisene er veiledende. Endelig tilbud bekreftes av oss.`,
      ``,
      `Trenger du oss raskt: ${SUPPORT_PHONE} / ${CONTACT_EMAIL}`,
      ``,
      `Med vennlig hilsen`,
      `NorthWest Coast AS`,
      `Postboks 79, 6281 Søvik`,
    ].join('\n'),
  };
}

export function contactInternal(args: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  product?: string;
  message?: string;
}) {
  return {
    subject: `Ny forespørsel fra ${args.name} – ${args.company || 'ukjent firma'}`,
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
  };
}

export function maintenanceReport(args: {
  name: string;
  boat: string;
  imo?: string;
  serial: string;
  email?: string;
  notes?: string;
  photoCount: number;
  matchedLadder: boolean;
  lang?: 'no' | 'en';
}) {
  if (args.lang === 'en') {
    return [
      `Name: ${args.name}`,
      `Vessel name: ${args.boat}`,
      `IMO no.: ${args.imo || '–'}`,
      `Ladder serial number: ${args.serial}`,
      `Email: ${args.email || '–'}`,
      ``,
      `Comment:`,
      args.notes || '–',
      ``,
      `Attached photos: ${args.photoCount}`,
    ].join('\n');
  }

  return [
    `Navn: ${args.name}`,
    `Navn på båt: ${args.boat}`,
    `IMO nr: ${args.imo || '–'}`,
    `Serienummer på leider: ${args.serial}`,
    `E-post: ${args.email || '–'}`,
    args.matchedLadder
      ? `Koblet til registrert leider: ja`
      : `Koblet til registrert leider: NEI – serienummeret finnes ikke i registeret`,
    ``,
    `Kommentar:`,
    args.notes || '–',
    ``,
    `Antall vedlagte bilder: ${args.photoCount}`,
  ].join('\n');
}

export function maintenanceReceipt(args: {
  name: string;
  boat: string;
  serial: string;
  report: string;
  lang?: 'no' | 'en';
}) {
  if (args.lang === 'en') {
    return {
      subject: `Receipt: maintenance logged – ${args.boat} (${args.serial})`,
      text: [
        `Hi ${args.name},`,
        ``,
        `We have registered the maintenance carried out on your Argostep ladder.`,
        `Keep this email as documentation.`,
        ``,
        args.report,
        ``,
        `Kind regards`,
        `NorthWest Coast AS`,
      ].join('\n'),
    };
  }

  return {
    subject: `Kvittering: vedlikehold registrert – ${args.boat} (${args.serial})`,
    text: [
      `Hei ${args.name},`,
      ``,
      `Vi har registrert utført vedlikehold på Argostep-leideren deres.`,
      `Ta vare på denne e-posten som dokumentasjon.`,
      ``,
      args.report,
      ``,
      `Med vennlig hilsen`,
      `NorthWest Coast AS`,
    ].join('\n'),
  };
}
