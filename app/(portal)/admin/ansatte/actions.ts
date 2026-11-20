'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, err, fail, isEmail, ok, optional, text } from '@/lib/portal/forms';
import { staffRoleLabel } from '@/lib/portal/labels';
import { STAFF_ROLE_VALUES, type StaffRoleValue } from './roles';

/**
 * Ansattlista styrer hvem som er administrator, produksjon eller media. Den
 * gjelder også eksterne (et byrå som skriver nyheter): rollen følger
 * e-postadressen. Databasen nekter å fjerne eller nedgradere den siste
 * administratoren; meldingen derfra vises som den er.
 */

const isRole = (value: string): value is StaffRoleValue =>
  STAFF_ROLE_VALUES.some((role) => role === value);

const roleName = (role: StaffRoleValue) => staffRoleLabel(role).label.toLowerCase();

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
  return ok(`${email} er lagt til som ${roleName(role)}. Tilgangen gjelder fra neste innlogging.`);
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
  return ok(`Rollen er endret til ${roleName(role)}.`);
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
