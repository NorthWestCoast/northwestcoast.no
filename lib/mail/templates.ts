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
};

function orderSummary(lines: OrderLineView[]): string {
  return lines
    .map((line) =>
      [
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
}) {
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
}) {
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

export function maintenanceReceipt(args: { name: string; boat: string; serial: string; report: string }) {
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
