/**
 * Adresser og avsender for e-post. Egen fil uten importer, så malene kan
 * lastes uten at e-postleverandøren følger med.
 *
 * Mottakere (interne postkasser):
 *   CONTACT_TO_EMAIL      henvendelser fra kontaktskjemaet og nyhetsbrevpåmeldinger
 *   ORDER_TO_EMAIL        bestillinger            (faller tilbake på CONTACT_TO_EMAIL)
 *   MAINTENANCE_TO_EMAIL  vedlikehold og service  (faller tilbake på CONTACT_TO_EMAIL)
 *
 * Avsender:
 *   RESEND_FROM_EMAIL     adressen e-postene sendes fra. Domenet må være
 *                         verifisert hos leverandøren. Kan stå med navn:
 *                         «NorthWestCoast <post@northwestcoast.no>».
 *
 * Kundene svarer aldri til avsenderadressen: hver e-post får Reply-To satt til
 * postkassen som behandler saken, så et svar havner hos et menneske uansett
 * om avsenderadressen har en innboks eller ikke.
 */
const env = (name: string) => process.env[name]?.trim() || undefined;

export const CONTACT_EMAIL = env('CONTACT_TO_EMAIL') ?? 'arve@astep.no';
export const ORDER_EMAIL = env('ORDER_TO_EMAIL') ?? CONTACT_EMAIL;
export const MAINTENANCE_EMAIL = env('MAINTENANCE_TO_EMAIL') ?? CONTACT_EMAIL;
export const SUPPORT_PHONE = '+47 904 07 341';

const SENDER_NAME = 'NorthWestCoast';

/** Avsenderen slik den står i From-feltet, alltid med navn foran adressen. */
export function sender(): string {
  const from = env('RESEND_FROM_EMAIL') ?? 'noreply@northwestcoast.no';
  return from.includes('<') ? from : `${SENDER_NAME} <${from}>`;
}
