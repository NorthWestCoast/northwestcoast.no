'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { managedCompanies, requireUser } from '@/lib/portal/context';
import { type ActionResult, err, fail, ok, text, uuid } from '@/lib/portal/forms';
import { readProject } from '@/components/portal/project-values';

/**
 * Prosjekter: steder og oppdrag som ikke er et fartøy (kai, anlegg på land).
 *
 * RLS avgjør hvem som får opprette og endre: eiere og administratorer i
 * selskapet, og administratorer i NorthWest Coast. Et prosjekt slettes ikke;
 * det avsluttes.
 */

function refresh() {
  revalidatePath('/minside', 'layout');
  revalidatePath('/admin/prosjekter');
}

export async function createProject(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireUser();

  const companyId = uuid(formData.get('company_id'));
  if (!companyId) return err('Velg hvilket selskap prosjektet tilhører.');
  if (ctx.staffRole !== 'admin' && !managedCompanies(ctx).some((c) => c.id === companyId)) {
    return err('Bare eiere og administratorer i selskapet kan opprette prosjekter.');
  }

  const parsed = readProject(formData);
  if (parsed.error !== null) return err(parsed.error);

  const { data: project, error } = await supabase
    .from('projects')
    .insert({ company_id: companyId, ...parsed.values })
    .select('id')
    .single();
  if (error || !project) return fail(error, 'Prosjektet kunne ikke lagres.');

  refresh();
  redirect(`/minside/prosjekter/${project.id}`);
}

export async function updateProject(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const projectId = uuid(formData.get('project_id'));
  if (!projectId) return err('Fant ikke prosjektet.');

  const parsed = readProject(formData);
  if (parsed.error !== null) return err(parsed.error);

  const { data, error } = await supabase
    .from('projects')
    .update(parsed.values)
    .eq('id', projectId)
    .select('id');
  if (error) return fail(error, 'Endringene kunne ikke lagres.');
  // RLS filtrerer bort raden framfor å kaste feil når man mangler rettigheter.
  if (!data?.length) return err('Bare eiere og administratorer i selskapet kan endre prosjektet.');

  refresh();
  return ok('Opplysningene er lagret.');
}

/** Avslutter et prosjekt, eller åpner det igjen. Utstyret blir stående. */
export async function setProjectStatus(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const projectId = uuid(formData.get('project_id'));
  const status = text(formData.get('status'), 10);
  if (!projectId) return err('Fant ikke prosjektet.');
  if (status !== 'active' && status !== 'closed') return err('Ugyldig status.');

  const { data, error } = await supabase
    .from('projects')
    .update({ status })
    .eq('id', projectId)
    .select('id');
  if (error) return fail(error, 'Statusen kunne ikke endres.');
  if (!data?.length) return err('Bare eiere og administratorer i selskapet kan avslutte prosjektet.');

  refresh();
  return ok(status === 'closed' ? 'Prosjektet er avsluttet.' : 'Prosjektet er åpnet igjen.');
}
