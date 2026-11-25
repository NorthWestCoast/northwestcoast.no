'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { DEMO_COOKIE } from '@/lib/portal/demo';

/** Logger ut og sender brukeren til innloggingssiden. Slår også av demovisningen. */
export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  (await cookies()).delete(DEMO_COOKIE);
  redirect('/logg-inn');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Merker varsler som lest. Uten id: alle. */
export async function markNotificationsRead(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;

  const id = formData.get('id');
  await supabase.rpc('mark_notifications_read', typeof id === 'string' && UUID.test(id) ? { p_ids: [id] } : {});
  // Varslene vises bare i de innloggede områdene. Den offentlige siden skal
  // ikke bygges på nytt av at noen leser et varsel.
  revalidatePath('/minside', 'layout');
  revalidatePath('/admin', 'layout');
  revalidatePath('/produksjon', 'layout');
}
