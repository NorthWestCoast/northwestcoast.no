import { fmt } from '@/lib/pricing';
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
  steps: number | null;
  qty: number;
  cabinetName: string | null;
  lineTotal: number;
  /** Pris avtales på forespørsel – vises uten sum. */
  onRequest?: boolean;
};

function orderSummary(lines: OrderLineView[]): string {
  return lines
    .map((line) =>
      line.onRequest
        ? `${line.qty} × ${line.productName} – pris på forespørsel`
        : [
        `${line.qty} × ${line.productName} (${line.productNumber}${
          line.steps ? `, ${line.steps} trinn` : ''
        })`,
        line.cabinetName ? `  + Oppbevaringsskap ${line.cabinetName}` : null,
        `  Sum: ${fmt(line.lineTotal)} kr`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

function orderSummaryEn(lines: OrderLineView[]): string {
  return lines
    .map((line) =>
      line.onRequest
        ? `${line.qty} × ${line.productName} – price on request`
        : [
            `${line.qty} × ${line.productName} (${line.productNumber}${
              line.steps ? `, ${line.steps} steps` : ''
            })`,
            line.cabinetName ? `  + Storage cabinet ${line.cabinetName}` : null,
            `  Sum: NOK ${fmt(line.lineTotal)}`,
          ]
            .filter(Boolean)
            .join('\n'),
    )
    .join('\n\n');
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
  units: number;
}) {
  return {
    subject: `Bestilling ${args.orderNumber}: ${args.units} leider(e) – ${fmt(
      args.total,
    )} kr – ${args.vessel || args.name}`,
    text: [
      `Ny bestillingsforespørsel fra nettsiden`,
      ``,
      `Ordrenr:   ${args.orderNumber}`,
      `Kunde:     ${args.name}`,
      `E-post:    ${args.email}`,
      `Telefon:   ${args.phone || '–'}`,
      `Fartøy/Rederi: ${args.vessel || '–'}`,
      ``,
      `--- Bestilling (${args.units} leider(e)) ---`,
      ``,
      orderSummary(args.lines),
      ``,
      `TOTALSUM: ${fmt(args.total)} kr eks. mva.`,
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
  if (args.lang === 'en') {
    return {
      subject: `We have received your order (${args.orderNumber}) – NorthWest Coast`,
      text: [
        `Hi ${args.name},`,
        ``,
        `Thank you for your request. We have registered it as ${args.orderNumber} and`,
        `will be in touch with confirmation and delivery time.`,
        ``,
        orderSummaryEn(args.lines),
        ``,
        `Total: NOK ${fmt(args.total)} excl. VAT.`,
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
