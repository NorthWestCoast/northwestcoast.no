/** Norske navn og fargetone for statusene i portalen. */
export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

type Label = { label: string; tone: Tone };

const pick = (map: Record<string, Label>, key: string | null | undefined): Label =>
  (key && map[key]) || { label: key ?? '–', tone: 'neutral' };

const ORDER: Record<string, Label> = {
  new: { label: 'Ny', tone: 'info' },
  quoted: { label: 'Tilbud sendt', tone: 'info' },
  confirmed: { label: 'Bekreftet', tone: 'ok' },
  in_production: { label: 'I produksjon', tone: 'warn' },
  delivered: { label: 'Levert', tone: 'ok' },
  cancelled: { label: 'Kansellert', tone: 'neutral' },
};

const JOB: Record<string, Label> = {
  queued: { label: 'I kø', tone: 'neutral' },
  in_progress: { label: 'Pågår', tone: 'warn' },
  ready: { label: 'Klar for forsendelse', tone: 'ok' },
  shipped: { label: 'Sendt', tone: 'info' },
  delivered: { label: 'Levert', tone: 'ok' },
  cancelled: { label: 'Kansellert', tone: 'neutral' },
};

const TICKET: Record<string, Label> = {
  open: { label: 'Åpen', tone: 'info' },
  in_progress: { label: 'Under arbeid', tone: 'warn' },
  waiting_customer: { label: 'Venter på deg', tone: 'warn' },
  resolved: { label: 'Løst', tone: 'ok' },
  closed: { label: 'Lukket', tone: 'neutral' },
};

const BOOKING: Record<string, Label> = {
  requested: { label: 'Bestilt', tone: 'info' },
  scheduled: { label: 'Avtalt', tone: 'ok' },
  completed: { label: 'Utført', tone: 'ok' },
  cancelled: { label: 'Avlyst', tone: 'neutral' },
};

const LADDER: Record<string, Label> = {
  in_production: { label: 'I produksjon', tone: 'warn' },
  // «Tatt i bruk» dekker både fartøy og prosjekt (kai, anlegg på land).
  delivered: { label: 'Levert, ikke tatt i bruk', tone: 'info' },
  installed: { label: 'I bruk', tone: 'ok' },
  retired: { label: 'Utrangert', tone: 'neutral' },
};

const SERVICE_STATE: Record<string, Label> = {
  ok: { label: 'Service à jour', tone: 'ok' },
  due_soon: { label: 'Service snart', tone: 'warn' },
  overdue: { label: 'Service forfalt', tone: 'danger' },
  unknown: { label: 'Ingen frist', tone: 'neutral' },
};

const SERVICE_RESULT: Record<string, Label> = {
  ok: { label: 'Godkjent', tone: 'ok' },
  ok_with_remarks: { label: 'Godkjent med anmerkning', tone: 'warn' },
  failed: { label: 'Ikke godkjent', tone: 'danger' },
};

const REQUEST: Record<string, Label> = {
  pending: { label: 'Venter på svar', tone: 'warn' },
  approved: { label: 'Godkjent', tone: 'ok' },
  rejected: { label: 'Avslått', tone: 'danger' },
  cancelled: { label: 'Trukket', tone: 'neutral' },
};

const CABINET: Record<string, Label> = {
  in_production: { label: 'I produksjon', tone: 'warn' },
  delivered: { label: 'Levert, ikke plassert', tone: 'info' },
  installed: { label: 'Plassert', tone: 'ok' },
  retired: { label: 'Utrangert', tone: 'neutral' },
};

const PROJECT_KIND: Record<string, Label> = {
  quay: { label: 'Kai', tone: 'neutral' },
  onshore: { label: 'Anlegg på land', tone: 'neutral' },
  aquaculture: { label: 'Havbruksanlegg', tone: 'neutral' },
  other: { label: 'Annet', tone: 'neutral' },
};

const PROJECT_STATUS: Record<string, Label> = {
  active: { label: 'Aktivt', tone: 'ok' },
  closed: { label: 'Avsluttet', tone: 'neutral' },
};

const CERTIFICATE: Record<string, Label> = {
  valid: { label: 'Gyldig', tone: 'ok' },
  expired: { label: 'Utløpt', tone: 'danger' },
  replaced: { label: 'Erstattet', tone: 'neutral' },
  revoked: { label: 'Trukket tilbake', tone: 'danger' },
};

const STAFF_ROLE: Record<string, Label> = {
  admin: { label: 'Administrator', tone: 'ok' },
  production: { label: 'Produksjon', tone: 'info' },
  media: { label: 'Media', tone: 'info' },
};

/**
 * Dokumentet som utstedes etter godkjent service. Navnet står bare her, så
 * det byttes ett sted hvis NorthWest Coast kaller det noe annet.
 */
export const CERTIFICATE_NAME = 'Servicesertifikat';
export const CERTIFICATE_NAME_LOWER = 'servicesertifikat';

export type CertificateState = 'valid' | 'expired' | 'replaced' | 'revoked';

/** Samme regel som get_certificate() i databasen. `today` er en ISO-dato (ÅÅÅÅ-MM-DD). */
export function certificateState(
  cert: { revoked_at: string | null; replaced_by: string | null; valid_until: string },
  today: string = new Date().toISOString().slice(0, 10),
): CertificateState {
  if (cert.revoked_at) return 'revoked';
  if (cert.replaced_by) return 'replaced';
  return cert.valid_until < today ? 'expired' : 'valid';
}

export const cabinetStatus = (s: string | null | undefined) => pick(CABINET, s);
export const projectKind = (s: string | null | undefined) => pick(PROJECT_KIND, s);
export const projectStatus = (s: string | null | undefined) => pick(PROJECT_STATUS, s);
export const certificateStatus = (s: string | null | undefined) => pick(CERTIFICATE, s);
export const staffRoleLabel = (s: string | null | undefined) => pick(STAFF_ROLE, s);
export const PROJECT_KINDS = Object.keys(PROJECT_KIND);

export const orderStatus = (s: string | null | undefined) => pick(ORDER, s);
export const jobStatus = (s: string | null | undefined) => pick(JOB, s);
export const ticketStatus = (s: string | null | undefined) => pick(TICKET, s);
export const bookingStatus = (s: string | null | undefined) => pick(BOOKING, s);
export const ladderStatus = (s: string | null | undefined) => pick(LADDER, s);
export const serviceState = (s: string | null | undefined) => pick(SERVICE_STATE, s);
export const serviceResult = (s: string | null | undefined) => pick(SERVICE_RESULT, s);
export const requestStatus = (s: string | null | undefined) => pick(REQUEST, s);

/** Sett fra NorthWest Coast venter saken på kunden, ikke «på deg». */
export const ticketStatusStaff = (s: string | null | undefined): Label =>
  s === 'waiting_customer' ? { label: 'Venter på kunde', tone: 'neutral' } : pick(TICKET, s);

export const LOG_KINDS: Record<string, string> = {
  maintenance: 'Vedlikehold',
  inspection: 'Inspeksjon',
  test: 'Test',
  usage: 'Bruk',
  repair: 'Reparasjon',
  note: 'Notat',
};
export const logKind = (k: string | null | undefined) => (k && LOG_KINDS[k]) || 'Vedlikehold';

export const TICKET_CATEGORIES: Record<string, string> = {
  support: 'Spørsmål og hjelp',
  service: 'Service',
  spare_parts: 'Reservedeler',
  warranty: 'Reklamasjon',
  other: 'Annet',
};

export const COMPANY_ROLES: Record<string, string> = {
  owner: 'Eier',
  admin: 'Administrator',
  member: 'Medlem',
};

export const VESSEL_ROLES: Record<string, string> = {
  master: 'Skipper (kan gi tilgang)',
  crew: 'Mannskap',
  viewer: 'Kun lesetilgang',
};

export const LADDER_ROLES: Record<string, string> = {
  manager: 'Kan administrere',
  viewer: 'Kan se og loggføre',
};


export const PRODUCT_KINDS: Record<string, string> = {
  ladder: 'Leider',
  cabinet: 'Oppbevaringsskap',
  spare_part: 'Reservedel',
};
