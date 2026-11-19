'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, checked, err, fail, int, ok, optional, text, uuid } from '@/lib/portal/forms';

/**
 * Malen for stegene i en produksjonsjobb. Stegene kopieres til jobben når den
 * opprettes, så endringer her gjelder bare nye jobber.
 */

function fields(formData: FormData) {
  return {
    position: int(formData.get('position'), 1, 999),
    title: text(formData.get('title'), 160),
    description: optional(formData.get('description'), 500),
  };
}

export async function addStep(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const { position, title, description } = fields(formData);
  if (title.length < 2) return err('Skriv en tittel på steget.');
  if (position === null) return err('Rekkefølgen må være et tall fra 1 til 999.');

  const { error } = await supabase.from('production_step_templates').insert({ position, title, description });
  if (error) return fail(error);

  revalidatePath('/admin/produksjonssteg');
  return ok(`«${title}» er lagt til. Gjelder nye jobber.`);
}

export async function updateStep(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const id = uuid(formData.get('step_id'));
  const { position, title, description } = fields(formData);
  if (!id) return err('Fant ikke steget.');
  if (title.length < 2) return err('Skriv en tittel på steget.');
  if (position === null) return err('Rekkefølgen må være et tall fra 1 til 999.');

  const { error } = await supabase
    .from('production_step_templates')
    .update({ position, title, description, active: checked(formData.get('active')) })
    .eq('id', id);
  if (error) return fail(error);

  revalidatePath('/admin/produksjonssteg');
  return ok('Steget er lagret. Gjelder nye jobber.');
}

/** Slår et steg av eller på uten å åpne skjemaet. */
export async function setStepActive(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const id = uuid(formData.get('step_id'));
  if (!id) return err('Fant ikke steget.');
  const active = checked(formData.get('active'));

  const { error } = await supabase.from('production_step_templates').update({ active }).eq('id', id);
  if (error) return fail(error);

  revalidatePath('/admin/produksjonssteg');
  return ok(active ? 'Steget er aktivt igjen.' : 'Steget er deaktivert.');
}

export async function deleteStep(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const id = uuid(formData.get('step_id'));
  if (!id) return err('Fant ikke steget.');

  const { error } = await supabase.from('production_step_templates').delete().eq('id', id);
  if (error) return fail(error);

  revalidatePath('/admin/produksjonssteg');
  return ok('Steget er slettet.');
}
