import { redirect } from 'next/navigation';
import { createServerSupabase } from './server';

/**
 * Vokter for admin-sidene.
 *
 * Staff-flagget ligger i app_metadata, ikke user_metadata. Forskjellen er
 * viktig: user_metadata kan brukeren endre selv gjennom auth-API-et, mens
 * app_metadata kun kan settes med service-role. Hadde flagget ligget i
 * user_metadata kunne hvem som helst gjort seg selv til ansatt.
 *
 * Databasen stoler ikke på denne sjekken alene – app.is_staff() leser samme
 * claim fra JWT-en i hver RLS-policy. Dette er bare for å slippe å rendre en
 * side brukeren uansett ikke får data til.
 */
export async function requireStaff() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/logg-inn?neste=/admin');
  if (!isStaffUser(user.app_metadata)) redirect('/minside');

  return { supabase, user };
}

export function isStaffUser(appMetadata: Record<string, unknown> | undefined) {
  return appMetadata?.staff === true;
}
