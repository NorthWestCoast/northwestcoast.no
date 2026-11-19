import type { requireUser } from '@/lib/portal/context';
import { LOG_KINDS, type Tone } from '@/lib/portal/labels';
import type { Enums, Tables } from '@/lib/supabase/database.types';

/** Klienten sidene får fra requireUser(): brukerens egen sesjon. */
export type PortalSupabase = Awaited<ReturnType<typeof requireUser>>['supabase'];

type Label = { label: string; tone: Tone };

/** Legger dager til en ISO-dato (YYYY-MM-DD) uten å blande inn tidssoner. */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Antall hele dager fra `from` til `to` (begge ISO-datoer). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function invitationStatus(invitation: {
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}): Label & { open: boolean } {
  if (invitation.accepted_at) return { label: 'Tatt i bruk', tone: 'ok', open: false };
  if (invitation.revoked_at) return { label: 'Trukket tilbake', tone: 'neutral', open: false };
  if (Date.parse(invitation.expires_at) <= Date.now()) return { label: 'Utløpt', tone: 'neutral', open: false };
  return { label: 'Venter', tone: 'warn', open: true };
}

export function shareStatus(share: { revoked_at: string | null; expires_at: string }): Label & { active: boolean } {
  if (share.revoked_at) return { label: 'Trukket tilbake', tone: 'neutral', active: false };
  if (Date.parse(share.expires_at) <= Date.now()) return { label: 'Utløpt', tone: 'neutral', active: false };
  return { label: 'Aktiv', tone: 'ok', active: true };
}

/** Punktene mannskapet krysser av når de deler en tilstandsrapport. */
export const SHARE_CHECKLIST = [
  'Trinn og sidetau er kontrollert',
  'Festepunkt er kontrollert',
  'Leideren er ren og uten skader',
  'Rigget etter gjeldende krav',
] as const;

/** Hvor lenge en delt lenke kan være gyldig (dager). */
export const SHARE_DAYS = [1, 3, 7, 14] as const;

export function gjentasTekst(months: number | null | undefined): string | null {
  if (!months) return null;
  return months === 1 ? 'gjentas hver måned' : `gjentas hver ${months}. måned`;
}

/** «7,5 m» – norsk desimalkomma. */
export function meter(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return `${value.toLocaleString('nb-NO')} m`;
}

/** Én rad fra ladder_status der id-en er kjent (viewet gir nullbare kolonner). */
export type LadderView = Tables<'ladder_status'> & { ladder_id: string };

/** Er verdien en gyldig loggtype (maintenance, inspection, …)? */
export const isLogKind = (value: string | null | undefined): value is Enums<'log_kind'> =>
  typeof value === 'string' && Object.hasOwn(LOG_KINDS, value);
