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
