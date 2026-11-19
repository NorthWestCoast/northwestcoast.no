import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Hvem er innlogget, og hva har de tilgang til.
 *
 * Alt hentes i ett kall til portal_bootstrap(), som også oppretter profilen
 * og løser inn ventende invitasjoner. `cache` gjør at layout, side og
 * komponenter i samme forespørsel deler ett kall.
 *
 * Rollen her styrer bare hva som vises. Det som faktisk beskytter dataene er
 * RLS og funksjonene i databasen, som gjør den samme vurderingen selv.
 */
export type StaffRole = 'admin' | 'production' | null;

export type PortalCompany = { id: string; name: string; role: 'owner' | 'admin' | 'member' };

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
    };
  }

  const ctx = data as Record<string, unknown>;
  const fullName = typeof ctx.full_name === 'string' && ctx.full_name.trim() ? ctx.full_name : null;
  const email = typeof ctx.email === 'string' ? ctx.email : user.email ?? '';
  const staffRole = ctx.staff_role === 'admin' || ctx.staff_role === 'production' ? ctx.staff_role : null;

  return {
    userId: user.id,
    email,
    fullName,
    displayName: fullName ?? email,
    staffRole,
    companies: Array.isArray(ctx.companies) ? (ctx.companies as PortalCompany[]) : [],
    hasAccess: ctx.has_access === true,
    unread: typeof ctx.unread === 'number' ? ctx.unread : 0,
  };
});

/** Krever innlogging. Returnerer klienten (brukerens egen sesjon) og konteksten. */
export async function requireUser(next = '/minside') {
  const ctx = await getPortalContext();
  if (!ctx) redirect(`/logg-inn?neste=${encodeURIComponent(next)}`);
  const supabase = await createServerSupabase();
  return { supabase, ctx };
}

/** Krever administrator hos NorthWest Coast. */
export async function requireAdmin(next = '/admin') {
  const { supabase, ctx } = await requireUser(next);
  if (ctx.staffRole !== 'admin') redirect(ctx.staffRole === 'production' ? '/produksjon' : '/minside');
  return { supabase, ctx };
}

/** Krever produksjon eller administrator. */
export async function requireProduction(next = '/produksjon') {
  const { supabase, ctx } = await requireUser(next);
  if (!ctx.staffRole) redirect('/minside');
  return { supabase, ctx };
}

/** Selskapene brukeren kan administrere (eier eller administrator). */
export function managedCompanies(ctx: PortalContext): PortalCompany[] {
  return ctx.companies.filter((c) => c.role === 'owner' || c.role === 'admin');
}
