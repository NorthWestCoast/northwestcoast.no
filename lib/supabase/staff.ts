import { requireAdmin } from '@/lib/portal/context';

/**
 * Vokter for admin-sidene og admin-actions.
 *
 * Rollen kommer fra public.staff_members via app.staff_role(): en verifisert
 * e-postadresse som står på ansattlista. Sjekken her er bare for å slippe å
 * rendre en side brukeren uansett ikke får data til – RLS-policyene kaller
 * den samme funksjonen i databasen for hver rad.
 */
export async function requireStaff() {
  const { supabase, ctx } = await requireAdmin();
  return { supabase, ctx, user: { id: ctx.userId, email: ctx.email } };
}
