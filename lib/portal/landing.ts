import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export const DEFAULT_NEXT = '/minside';

/**
 * Bare relative stier på eget domene. `neste` kommer fra URL-en og kan peke
 * hvor som helst, så alt annet ville vært en åpen omdirigering.
 */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_NEXT;
  return value;
}

/**
 * Hvor en nettopp innlogget bruker skal lande.
 *
 * portal_bootstrap() oppretter profilen og løser inn ventende invitasjoner.
 * Svaret brukes bare til å sende ansatte til riktig område når de ikke var
 * på vei et bestemt sted: administratorer til /admin, produksjon til
 * /produksjon. Rollen styrer bare hvor man lander; tilgangen avgjøres av RLS.
 */
export async function landingPath(supabase: SupabaseClient<Database>, next: string): Promise<string> {
  if (next !== DEFAULT_NEXT) return next;

  try {
    const { data } = await supabase.rpc('portal_bootstrap');
    const role = data && typeof data === 'object' && !Array.isArray(data) ? data.staff_role : null;
    if (role === 'admin') return '/admin';
    if (role === 'production') return '/produksjon';
  } catch (error) {
    // Innloggingen er uansett i orden; da lander man bare på Min side.
    console.error('[auth] portal_bootstrap feilet etter innlogging:', error);
  }
  return next;
}

/**
 * Adressen brukeren faktisk er på (https://northwestcoast-no.vercel.app,
 * eget domene senere, localhost i utvikling). Brukes til lenker som skal
 * sendes videre, så de alltid peker dit siden virkelig svarer.
 */
export function requestOrigin(headers: Headers, fallback: string): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) return fallback;
  const proto = headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto.split(',')[0]}://${host}`;
}
