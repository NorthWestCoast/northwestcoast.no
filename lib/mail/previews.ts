import { SITE_URL } from '@/lib/site';
import { AUTH_TEMPLATES } from './auth-templates';
import { CONTACT_EMAIL, MAINTENANCE_EMAIL, ORDER_EMAIL } from './config';
import {
  type OrderLineView,
  accessInvitation,
  certificateIssued,
  contactInternal,
  contactReceipt,
  maintenanceInternal,
  maintenanceReceipt,
  newsletterNotice,
  orderConfirmed,
  orderDelivered,
  orderInternal,
  orderReceipt,
} from './templates';

/**
 * Alle e-postene med eksempeldata, til forhåndsvisningen i admin
 * (/admin/e-post). Viser nøyaktig det malene lager: endres en mal, endres
 * forhåndsvisningen med den.
 */
export type MailPreview = {
  id: string;
  group: 'Innlogging' | 'Bestilling' | 'Henvendelser' | 'Vedlikehold og service' | 'Min side';
  name: string;
  /** Hva som utløser e-posten. */
  when: string;
  /** Hvem som får den. */
  to: string;
  subject: string;
  html: string;
};

const LINES: OrderLineView[] = [
  { productName: 'Argostep – 6ML', productNumber: '400-034', steps: 19, qty: 2, cabinetName: 'ASC-LC5-6', lineTotal: 46998 },
  { productName: 'Argostep – spesiallengde', productNumber: 'ARG-SPES', customLength: 5.5, steps: null, qty: 1, cabinetName: null, lineTotal: 0, onRequest: true },
  { productName: 'Oppbevaringsskap ASC-LC3-5', productNumber: 'ASC-LC3-5', kind: 'cabinet', steps: null, qty: 1, cabinetName: null, lineTotal: 9000 },
];

const FOLLOW_UP = [
  { name: 'Argostep – 6ML', qty: 2, detail: 'med oppbevaringsskap' },
  { name: 'Argostep – 5,5 m (spesiallengde)', qty: 1 },
];

/** Verdiene Supabase setter inn i innloggingsmalene, byttet med eksempler. */
const fillAuth = (html: string) =>
  html
    .replaceAll('{{ .SiteURL }}', SITE_URL)
    .replaceAll('{{ .TokenHash }}', 'eksempel')
    .replaceAll('{{ .Token }}', '48392061')
    .replaceAll('{{ .Email }}', 'kari@rederi.no')
    .replaceAll('{{ .NewEmail }}', 'kari.hansen@rederi.no');

const AUTH_WHEN: Record<string, string> = {
  'magic-link.html': 'Noen med konto ber om innloggingslenke på /logg-inn.',
  'confirm-signup.html': 'Noen uten konto ber om innloggingslenke for første gang.',
  'email-change.html': 'En bruker ber om å bytte e-postadresse på kontoen.',
  'recovery.html': 'Noen ber om «glemt passord» rett mot Supabase. Min side har ikke passord, så e-posten logger bare inn.',
};

export function mailPreviews(): MailPreview[] {
  const order = { orderNumber: 'NWC-2026-0042', name: 'Kari Hansen' };

  return [
    ...AUTH_TEMPLATES.map((template) => ({
      id: template.file.replace('.html', ''),
      group: 'Innlogging' as const,
      name: template.supabaseName,
      when: AUTH_WHEN[template.file] ?? '',
      to: 'Brukeren. Sendes av Supabase, malen ligger i supabase/templates/.',
      subject: template.subject,
      html: fillAuth(template.html),
    })),
    {
      id: 'order-receipt',
      group: 'Bestilling',
      name: 'Kvittering for bestilling',
      when: 'En bestilling sendes fra nettsiden eller kalkulatoren. Finnes også på engelsk.',
      to: 'Den som bestilte',
      ...orderReceipt({ ...order, lines: LINES, total: 55998 }),
    },
    {
      id: 'order-internal',
      group: 'Bestilling',
      name: 'Ny bestilling',
      when: 'Samtidig med kvitteringen.',
      to: `NWC (${ORDER_EMAIL})`,
      ...orderInternal({
        ...order,
        email: 'kari@rederi.no',
        phone: '400 00 000',
        vessel: 'MS Nordlys',
        notes: 'Ønsker levering til kai i Ålesund før jul.',
        lines: LINES,
        total: 55998,
        adminUrl: `${SITE_URL}/admin/bestillinger`,
      }),
    },
    {
      id: 'order-confirmed',
      group: 'Bestilling',
      name: 'Bestillingen er bekreftet',
      when: 'En administrator bekrefter bestillingen.',
      to: 'Kontaktpersonen på bestillingen',
      ...orderConfirmed({ ...order, lines: FOLLOW_UP, expected: '2026-12-18' }),
    },
    {
      id: 'order-delivered',
      group: 'Bestilling',
      name: 'Bestillingen er levert',
      when: 'Den siste leveransen i bestillingen markeres som levert.',
      to: 'Kontaktpersonen på bestillingen',
      ...orderDelivered({ ...order, lines: FOLLOW_UP, serials: ['NWC-2026-0117', 'NWC-2026-0118', 'NWC-2026-0119'] }),
    },
    {
      id: 'contact-receipt',
      group: 'Henvendelser',
      name: 'Bekreftelse på mottatt henvendelse',
      when: 'Kontaktskjemaet sendes inn. Finnes også på engelsk.',
      to: 'Den som tok kontakt',
      ...contactReceipt({ name: 'Kari Hansen' }),
    },
    {
      id: 'contact-internal',
      group: 'Henvendelser',
      name: 'Ny henvendelse',
      when: 'Samtidig med bekreftelsen.',
      to: `NWC (${CONTACT_EMAIL})`,
      ...contactInternal({
        name: 'Kari Hansen',
        email: 'kari@rederi.no',
        phone: '400 00 000',
        company: 'Nordlys Rederi AS',
        product: 'Argostep 8 m',
        message: 'Hei. Vi skal bytte losleider på to fartøy i vinter.\nKan dere gi et tilbud på to stykker med skap?',
      }),
    },
    {
      id: 'newsletter-notice',
      group: 'Henvendelser',
      name: 'Ny påmelding til nyhetsbrevet',
      when: 'Noen melder seg på nyhetsbrevet.',
      to: `NWC (${CONTACT_EMAIL})`,
      ...newsletterNotice({ email: 'kari@rederi.no' }),
    },
    {
      id: 'maintenance-receipt',
      group: 'Vedlikehold og service',
      name: 'Kvittering for vedlikehold',
      when: 'Vedlikeholdsskjemaet på nettsiden sendes inn med e-postadresse. Finnes også på engelsk.',
      to: 'Den som meldte inn',
      ...maintenanceReceipt({
        name: 'Ola Nordmann',
        boat: 'MS Nordlys',
        serial: 'NWC-2026-0117',
        photoCount: 3,
        receivedAt: new Date('2026-11-19T10:00:00Z'),
      }),
    },
    {
      id: 'maintenance-internal',
      group: 'Vedlikehold og service',
      name: 'Vedlikehold meldt inn',
      when: 'Samtidig med kvitteringen.',
      to: `NWC (${MAINTENANCE_EMAIL})`,
      ...maintenanceInternal({
        name: 'Ola Nordmann',
        boat: 'MS Nordlys',
        imo: '9123456',
        serial: 'NWC-2026-0117',
        email: 'ola@rederi.no',
        notes: 'Byttet to trinn og kontrollert sidetauene. Ingen avvik.',
        photoCount: 3,
        matchedLadder: true,
        adminUrl: `${SITE_URL}/admin/vedlikehold`,
      }),
    },
    {
      id: 'certificate-issued',
      group: 'Vedlikehold og service',
      name: 'Nytt servicesertifikat',
      when: 'En administrator utsteder sertifikat etter service.',
      to: 'De som har tilgang til leideren og ikke har slått av e-postvarsler',
      ...certificateIssued({
        certificateNumber: 'SS-2026-0042',
        serial: 'NWC-2026-0117',
        place: 'MS Nordlys',
        validUntil: '2027-11-19',
        verifyUrl: `${SITE_URL}/sertifikat/eksempel`,
        ladderUrl: `${SITE_URL}/minside`,
      }),
    },
    {
      id: 'access-invitation',
      group: 'Min side',
      name: 'Invitasjon til Min side',
      when: 'En bruker inviterer noen til et selskap, et fartøy eller en leider.',
      to: 'Den inviterte',
      ...accessInvitation({ inviterEmail: 'kari@rederi.no', inviterName: 'Kari Hansen', targetName: 'Nordlys Rederi AS' }),
    },
  ];
}
