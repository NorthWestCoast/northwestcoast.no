import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { MEDIA_HOME, staffHome } from './landing';

/**
 * Hvem er innlogget, og hva har de tilgang til.
 *
 * Alt hentes i ett kall til portal_bootstrap(), som også oppretter profilen
 * og gir invitasjonene som venter på svar. `cache` gjør at layout, side og
 * komponenter i samme forespørsel deler ett kall.
 *
 * Rollen her styrer bare hva som vises. Det som faktisk beskytter dataene er
 * RLS og funksjonene i databasen, som gjør den samme vurderingen selv.
 */
export type StaffRole = 'admin' | 'production' | 'media' | null;

const STAFF_ROLES = ['admin', 'production', 'media'] as const;

const isStaffRole = (value: unknown): value is NonNullable<StaffRole> =>
  STAFF_ROLES.some((role) => role === value);

export type PortalCompany = { id: string; name: string; role: 'owner' | 'admin' | 'member' };

/** En invitasjon brukeren ikke har svart på ennå. */
export type PortalInvitation = {
  id: string;
  scope: 'company' | 'vessel' | 'ladder';
  role: string;
  /** Navnet på selskapet eller fartøyet, eller serienummeret på leideren. */
  target: string | null;
  invitedByName: string | null;
  expiresAt: string | null;
};

function parseInvitations(value: unknown): PortalInvitation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string') return [];
    const scope = row.scope === 'vessel' || row.scope === 'ladder' ? row.scope : 'company';
    const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
    return [{
      id: row.id,
      scope,
      role: str(row.role) ?? '',
      target: str(row.target),
      invitedByName: str(row.invited_by_name),
      expiresAt: str(row.expires_at),
    }];
  });
}

export type PortalContext = {
  userId: string;
  email: string;
  fullName: string | null;
  /** Navn hvis det finnes, ellers e-post. Til «utført av» og lignende. */
  displayName: string;
  staffRole: StaffRole;
  companies: PortalCompany[];
  /** Har tilgang til minst ett selskap, fartøy eller en leider. */
  hasAccess: boolean;
  unread: number;
  /** Invitasjoner som venter på at brukeren godtar eller avslår. */
  invitations: PortalInvitation[];
};

export const getPortalContext = cache(async (): Promise<PortalContext | null> => {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc('portal_bootstrap');
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    if (error) console.error('[portal] portal_bootstrap feilet:', error.message);
    // Innlogget, men uten kontekst: vis en tom portal framfor en feilside.
    return {
      userId: user.id,
      email: user.email ?? '',
      fullName: null,
      displayName: user.email ?? '',
      staffRole: null,
      companies: [],
      hasAccess: false,
      unread: 0,
      invitations: [],
    };
  }

  const ctx = data as Record<string, unknown>;
  const fullName = typeof ctx.full_name === 'string' && ctx.full_name.trim() ? ctx.full_name : null;
  const email = typeof ctx.email === 'string' ? ctx.email : user.email ?? '';
  const staffRole = isStaffRole(ctx.staff_role) ? ctx.staff_role : null;

  return {
    userId: user.id,
    email,
    fullName,
    displayName: fullName ?? email,
    staffRole,
    companies: Array.isArray(ctx.companies) ? (ctx.companies as PortalCompany[]) : [],
    hasAccess: ctx.has_access === true,
    unread: typeof ctx.unread === 'number' ? ctx.unread : 0,
    invitations: parseInvitations(ctx.invitations),
  };
});

/** Krever innlogging. Returnerer klienten (brukerens egen sesjon) og konteksten. */
export async function requireUser(next = '/minside') {
  const ctx = await getPortalContext();
  if (!ctx) redirect(`/logg-inn?neste=${encodeURIComponent(next)}`);
  const supabase = await createServerSupabase();
  return { supabase, ctx };
}

/** Dit en bruker sendes når rollen ikke gir tilgang til siden hun ba om. */
const homeFor = (role: StaffRole) => staffHome(role) ?? '/minside';

/** Krever administrator hos NorthWestCoast. */
export async function requireAdmin(next = '/admin') {
  const { supabase, ctx } = await requireUser(next);
  if (ctx.staffRole !== 'admin') redirect(homeFor(ctx.staffRole));
  return { supabase, ctx };
}

/** Krever media eller administrator: nyheter og galleri, ingenting annet. */
export async function requireMedia(next = MEDIA_HOME) {
  const { supabase, ctx } = await requireUser(next);
  if (ctx.staffRole !== 'admin' && ctx.staffRole !== 'media') redirect(homeFor(ctx.staffRole));
  return { supabase, ctx };
}

/** Krever produksjon eller administrator. Media har en ansattrolle, men ikke denne. */
export async function requireProduction(next = '/produksjon') {
  const { supabase, ctx } = await requireUser(next);
  if (ctx.staffRole !== 'admin' && ctx.staffRole !== 'production') redirect(homeFor(ctx.staffRole));
  return { supabase, ctx };
}

/** Selskapene brukeren kan administrere (eier eller administrator). */
export function managedCompanies(ctx: PortalContext): PortalCompany[] {
  return ctx.companies.filter((c) => c.role === 'owner' || c.role === 'admin');
}
