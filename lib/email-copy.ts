import { CONTACT_PHONE, CONTACT_TO_EMAIL } from './email';
import type { Lang } from './i18n';

/**
 * Kvitteringer som går til kunden skrives på kundens språk. E-postene til
 * NorthWest Coast er alltid på norsk.
 */
export function orderReceipt(
  lang: Lang,
  { name, summary }: { name: string; summary: string },
): { subject: string; text: string } {
  if (lang === 'en') {
    return {
      subject: 'We have received your order – NorthWest Coast',
      text: [
        `Hi ${name},`,
        ``,
        `Thank you for your order. We are reviewing it and will come back with a`,
        `confirmation, price and delivery time – normally within one business day.`,
        ``,
        `This is what you ordered:`,
        summary,
        ``,
        `Prices are indicative and exclude VAT. The final quote is confirmed by us.`,
        ``,
        `Questions in the meantime? Reply to this email or call ${CONTACT_PHONE}.`,
        ``,
        `Kind regards`,
        `NorthWest Coast AS`,
      ].join('\n'),
    };
  }

  return {
    subject: 'Vi har mottatt bestillingen din – NorthWest Coast',
    text: [
      `Hei ${name},`,
      ``,
      `Takk for bestillingen! Vi går gjennom den og kommer tilbake med bekreftelse,`,
      `pris og leveringstid – normalt innen én virkedag.`,
      ``,
      `Dette har du bestilt:`,
      summary,
      ``,
      `Prisen er veiledende eks. mva. Endelig tilbud bekreftes av oss.`,
      ``,
      `Spørsmål i mellomtiden? Svar på denne e-posten eller ring ${CONTACT_PHONE}.`,
      ``,
      `Vennlig hilsen`,
      `NorthWest Coast AS`,
    ].join('\n'),
  };
}

export function maintenanceReceipt(
  lang: Lang,
  {
    name,
    boat,
    serial,
    record,
    reminder,
  }: { name: string; boat: string; serial: string; record: string; reminder: boolean },
): { subject: string; text: string } {
  if (lang === 'en') {
    return {
      subject: `Receipt for logged maintenance – ${boat} (${serial})`,
      text: [
        `Hi ${name},`,
        ``,
        `Thank you – the maintenance has been logged with NorthWest Coast. Keep this`,
        `email as documentation of the maintenance carried out on the vessel.`,
        ``,
        record,
        ``,
        reminder
          ? 'We will send you a reminder before the next recommended maintenance.'
          : 'Would you like a reminder before the next maintenance? Just reply to this email.',
        ``,
        `Need spare parts or service? Reply to this email or call ${CONTACT_PHONE}.`,
        ``,
        `Kind regards`,
        `NorthWest Coast AS`,
      ].join('\n'),
    };
  }

  return {
    subject: `Kvittering på registrert vedlikehold – ${boat} (${serial})`,
    text: [
      `Hei ${name},`,
      ``,
      `Takk – vedlikeholdet er registrert hos NorthWest Coast. Ta vare på denne`,
      `e-posten som dokumentasjon på utført vedlikehold for fartøyet.`,
      ``,
      record,
      ``,
      reminder
        ? 'Vi sender deg en påminnelse før neste anbefalte vedlikehold.'
        : 'Vil du ha påminnelse før neste vedlikehold? Svar på denne e-posten.',
      ``,
      `Trenger du reservedeler eller service? Svar på denne e-posten eller ring ${CONTACT_PHONE}.`,
      ``,
      `Vennlig hilsen`,
      `NorthWest Coast AS`,
    ].join('\n'),
  };
}

export { CONTACT_TO_EMAIL };
