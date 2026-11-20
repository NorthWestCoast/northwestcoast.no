'use server';

import { revalidatePath } from 'next/cache';
import { requireProduction } from '@/lib/portal/context';
import type { ActionResult } from '@/lib/portal/forms';
import { type ManualKind, postCount, postMovement } from '@/components/lager/register';

/**
 * Det produksjon får føre på lageret: varemottak, svinn og varetelling.
 * Kontrollen av det som sendes inn er den samme som i admin
 * (components/lager/register.ts); her er bare vokteren og utvalget av slag.
 * Salg og retur føres av administratorer.
 */

const KINDS: readonly ManualKind[] = ['receipt', 'scrap'];

function refresh() {
  revalidatePath('/produksjon/lager', 'layout');
  revalidatePath('/admin/lager', 'layout');
}

/** Varemottak eller svinn. */
export async function registerMovement(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireProduction('/produksjon/lager');

  const result = await postMovement(supabase, formData, KINDS);
  if (result.ok) refresh();
  return result;
}

/** Varetelling: forskjellen mot beholdningen føres som én justering. */
export async function registerCount(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireProduction('/produksjon/lager');

  const result = await postCount(supabase, formData);
  if (result.ok) refresh();
  return result;
}
