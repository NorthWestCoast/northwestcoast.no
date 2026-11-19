'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, err, fail, isEmail, ok, optional, text } from '@/lib/portal/forms';
import { STAFF_ROLES } from '@/lib/portal/labels';

/**
 * Ansattlista styrer hvem som er administrator eller produksjon. Databasen
 * nekter å fjerne eller nedgradere den siste administratoren; meldingen
 * derfra vises som den er.
 */

const isRole = (value: string): value is 'admin' | 'production' => value === 'admin' || value === 'production';

function refresh() {
  revalidatePath('/admin/ansatte');
  revalidatePath('/admin/brukere');
}

export async function addStaff(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();

  const email = text(formData.get('email'), 160).toLowerCase();
  const role = text(formData.get('role'), 12);
  if (!isEmail(email)) return err('E-postadressen ser ikke gyldig ut.');
  if (!isRole(role)) return err('Velg en rolle.');

  const { error } = await supabase.from('staff_members').insert({
    email,
    role,
    full_name: optional(formData.get('full_name'), 120),
    added_by: user.id,
  });
  if (error) return error.code === '23505' ? err(`${email} står allerede på lista.`) : fail(error);

  refresh();
  return ok(`${email} er lagt til som ${STAFF_ROLES[role].toLowerCase()}. Tilgangen gjelder fra neste innlogging.`);
}

export async function setStaffRole(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const email = text(formData.get('email'), 160).toLowerCase();
  const role = text(formData.get('role'), 12);
  if (!email) return err('Fant ikke den ansatte.');
  if (!isRole(role)) return err('Velg en rolle.');

  const { error } = await supabase.from('staff_members').update({ role }).eq('email', email);
  if (error) return fail(error);

  refresh();
  return ok(`Rollen er endret til ${STAFF_ROLES[role].toLowerCase()}.`);
}

export async function removeStaff(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const email = text(formData.get('email'), 160).toLowerCase();
  if (!email) return err('Fant ikke den ansatte.');

  const { error } = await supabase.from('staff_members').delete().eq('email', email);
  if (error) return fail(error);

  refresh();
  return ok(`${email} er fjernet fra ansattlista.`);
}
