'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, err, fail, ok, text, uuid } from '@/lib/portal/forms';

/**
 * Godkjenner eller avslår en forespørsel om tilgang til en leider.
 * Databasen gir tilgangen og varsler den som spurte.
 */
export async function decideAccess(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const requestId = uuid(formData.get('request_id'));
  const decision = text(formData.get('decision'), 10);
  const role = text(formData.get('role'), 10) || 'viewer';
  const note = text(formData.get('note'), 300);

  if (!requestId) return err('Fant ikke forespørselen.');
  if (decision !== 'approve' && decision !== 'reject') return err('Velg godkjenn eller avslå.');
  if (role !== 'viewer' && role !== 'manager') return err('Velg en rolle.');

  const { error } = await supabase.rpc('decide_ladder_access', {
    p_request: requestId,
    p_approve: decision === 'approve',
    p_role: role,
    ...(note ? { p_note: note } : {}),
  });
  if (error) return fail(error);

  revalidatePath('/admin/tilgang');
  revalidatePath('/admin', 'layout');
  return ok(decision === 'approve' ? 'Tilgangen er gitt.' : 'Forespørselen er avslått.');
}
