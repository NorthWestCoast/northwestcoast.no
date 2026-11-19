'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, err, fail, ok, uuid } from '@/lib/portal/forms';
import { readProject } from '@/components/portal/project-values';

/**
 * Prosjekter i admin. Opprettelse for en kunde ligger her; endring og
 * avslutning skjer på prosjektsiden (app/(portal)/minside/prosjekter), der
 * RLS slipper administratorer til på lik linje med kundens egne.
 */
export async function createProject(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const companyId = uuid(formData.get('company_id'));
  if (!companyId) return err('Velg hvilken kunde prosjektet tilhører.');

  const parsed = readProject(formData);
  if (parsed.error !== null) return err(parsed.error);

  const { error } = await supabase.from('projects').insert({ company_id: companyId, ...parsed.values });
  if (error) return fail(error, 'Prosjektet kunne ikke lagres.');

  revalidatePath('/admin/prosjekter');
  revalidatePath(`/admin/selskap/${companyId}`);
  revalidatePath('/minside', 'layout');
  return ok(`${parsed.values.name} er opprettet.`);
}
