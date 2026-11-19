'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, checked, err, fail, ok, uuid } from '@/lib/portal/forms';

/** Markerer en henvendelse som håndtert, eller åpner den igjen (`undo`). */
export async function setRequestHandled(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const id = uuid(formData.get('request_id'));
  if (!id) return err('Fant ikke henvendelsen.');
  const undo = checked(formData.get('undo'));

  const { error } = await supabase
    .from('contact_requests')
    .update({ handled_at: undo ? null : new Date().toISOString() })
    .eq('id', id);
  if (error) return fail(error);

  revalidatePath('/admin/henvendelser');
  return ok(undo ? 'Henvendelsen er åpnet igjen.' : 'Henvendelsen er markert som håndtert.');
}
