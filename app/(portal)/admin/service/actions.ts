'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, err, fail, isoDate, ok, optional, uuid } from '@/lib/portal/forms';
import { dato } from '@/lib/format';

/**
 * Servicebestillinger fra kundene. Databasen varsler kunden når en bestilling
 * blir avtalt, flyttet eller avlyst.
 */

function refresh(ladderId: string) {
  revalidatePath('/admin/service');
  revalidatePath('/admin', 'layout');
  revalidatePath(`/minside/leider/${ladderId}`);
}

/** Avtaler (eller flytter) en servicebestilling: dato, tekniker og melding til kunden. */
export async function scheduleBooking(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const bookingId = uuid(formData.get('booking_id'));
  const date = isoDate(formData.get('scheduled_date'));
  if (!bookingId) return err('Fant ikke bestillingen.');
  if (!date) return err('Velg en dato.');

  const { data, error } = await supabase
    .from('service_bookings')
    .update({
      status: 'scheduled',
      scheduled_date: date,
      technician: optional(formData.get('technician'), 120),
      staff_note: optional(formData.get('staff_note'), 1000),
    })
    .eq('id', bookingId)
    .in('status', ['requested', 'scheduled'])
    .select('ladder_id')
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return err('Bestillingen er allerede utført eller avlyst.');

  refresh(data.ladder_id);
  return ok(`Service er avtalt ${dato(date)}. De som har tilgang til leideren får varsel.`);
}

export async function cancelBooking(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const bookingId = uuid(formData.get('booking_id'));
  if (!bookingId) return err('Fant ikke bestillingen.');

  const { data, error } = await supabase
    .from('service_bookings')
    .update({ status: 'cancelled', staff_note: optional(formData.get('staff_note'), 1000) })
    .eq('id', bookingId)
    .in('status', ['requested', 'scheduled'])
    .select('ladder_id')
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return err('Bestillingen er allerede utført eller avlyst.');

  refresh(data.ladder_id);
  return ok('Servicebestillingen er avlyst.');
}
