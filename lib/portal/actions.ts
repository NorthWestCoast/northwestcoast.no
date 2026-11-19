'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

/** Logger ut og sender brukeren til innloggingssiden. */
export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/logg-inn');
}

/** Merker varsler som lest. Uten id-er: alle. */
export async function markNotificationsRead(formData: FormData) {
  const supabase = await createServerSupabase();
  const id = formData.get('id');
  await supabase.rpc('mark_notifications_read', typeof id === 'string' && id ? { p_ids: [id] } : {});
  revalidatePath('/', 'layout');
}
