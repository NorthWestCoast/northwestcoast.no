import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { PORTAL_HAS_OWN_HOST, PORTAL_URL, SITE_URL } from '@/lib/site';

export const DEFAULT_NEXT = '/minside';

/**
 * Bare relative stier på eget domene. `neste` kommer fra URL-en og kan peke
 * hvor som helst, så alt annet ville vært en åpen omdirigering.
 */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_NEXT;
  // Nettlesere leser en omvendt skråstrek som en vanlig («/\\» blir «//»), og kontrolltegn
  // hører ikke hjemme i en sti.
  if (/[\\\u0000-\u001f]/.test(value)) return DEFAULT_NEXT;
  return value;
}

/** Første side for medierollen. Oversikten i Admin er bare for administratorer. */
export const MEDIA_HOME = '/admin/nyheter';

/**
 * Området en ansattrolle hører hjemme i: administratorer i /admin, produksjon
 * i /produksjon, media på nyhetene. Null for alle uten ansattrolle.
 */
export function staffHome(role: unknown): string | null {
  if (role === 'admin') return '/admin';
  if (role === 'production') return '/produksjon';
  if (role === 'media') return MEDIA_HOME;
  return null;
}

/**
 * Hvor en nettopp innlogget bruker skal lande.
 *
 * portal_bootstrap() oppretter profilen og løser inn ventende invitasjoner.
 * Svaret brukes bare til å sende ansatte til riktig område når de ikke var
 * på vei et bestemt sted (se staffHome). Rollen styrer bare hvor man lander;
 * tilgangen avgjøres av RLS.
 */
export async function landingPath(supabase: SupabaseClient<Database>, next: string): Promise<string> {
  if (next !== DEFAULT_NEXT) return next;

  try {
    const { data } = await supabase.rpc('portal_bootstrap');
    const role = data && typeof data === 'object' && !Array.isArray(data) ? data.staff_role : null;
    return staffHome(role) ?? next;
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

/**
 * Adressen lenker inn i portalen skal ha når de skrives ut eller sendes
 * videre: kontrollsiden på et sertifikat, lenken til en delt rapport.
 *
 * Med portalen på eget vertsnavn er det den adressen som er satt opp, ikke
 * noe som leses ut av forespørselen. Ellers er det adressen brukeren faktisk
 * er på, så forhåndsvisninger og localhost lager lenker til seg selv.
 */
export function portalOrigin(headers: Headers): string {
  return PORTAL_HAS_OWN_HOST ? PORTAL_URL : requestOrigin(headers, SITE_URL);
}
