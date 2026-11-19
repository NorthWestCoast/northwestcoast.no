'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, err, fail, int, isoDate, ok, optional, text, uuid } from '@/lib/portal/forms';
import { LOG_KINDS, ladderStatus } from '@/lib/portal/labels';
import type { Enums } from '@/lib/supabase/database.types';

/**
 * Admin-verktøyene på leidersiden (components/admin/ladder-admin-panel.tsx).
 * Registrering av service og flytting ligger i ../actions.ts.
 */

const STATUSES: Enums<'ladder_lifecycle_status'>[] = ['in_production', 'delivered', 'installed', 'retired'];

function refresh(ladderId: string) {
  revalidatePath(`/minside/leider/${ladderId}`);
  revalidatePath('/admin/leidere');
  revalidatePath('/admin/service');
  revalidatePath('/admin');
}

export async function setServiceInterval(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const ladderId = uuid(formData.get('ladder_id'));
  const months = int(formData.get('service_interval_months'), 1, 120);
  if (!ladderId) return err('Fant ikke leideren.');
  if (months === null) return err('Intervallet må være mellom 1 og 120 måneder.');

  const { error } = await supabase
    .from('ladders')
    .update({ service_interval_months: months })
    .eq('id', ladderId);
  if (error) return fail(error);

  refresh(ladderId);
  return ok(`Serviceintervallet er satt til ${months} måneder.`);
}

export async function setLadderStatus(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const ladderId = uuid(formData.get('ladder_id'));
  const status = STATUSES.find((value) => value === text(formData.get('status'), 20));
  if (!ladderId) return err('Fant ikke leideren.');
  if (!status) return err('Velg en status.');

  if (status === 'installed') {
    const { data: ladder } = await supabase
      .from('ladders')
      .select('vessel_id, project_id')
      .eq('id', ladderId)
      .maybeSingle();
    if (!ladder) return err('Fant ikke leideren.');
    if (!ladder.vessel_id && !ladder.project_id) {
      return err('Leideren må stå på et fartøy eller i et prosjekt før den kan settes til «I bruk».');
    }
  }

  const { error } = await supabase.from('ladders').update({ status }).eq('id', ladderId);
  if (error) return fail(error);

  refresh(ladderId);
  return ok(`Status er satt til «${ladderStatus(status).label}».`);
}

export async function addLadderTask(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();

  const ladderId = uuid(formData.get('ladder_id'));
  const title = text(formData.get('title'), 160);
  const dueDate = isoDate(formData.get('due_date'));
  const kind = text(formData.get('kind'), 20) as Enums<'log_kind'>;
  const recurrenceRaw = text(formData.get('recurrence_months'), 4);
  const recurrence = recurrenceRaw ? int(recurrenceRaw, 1, 120) : null;

  if (!ladderId) return err('Fant ikke leideren.');
  if (title.length < 2) return err('Skriv en tittel på oppgaven.');
  if (!dueDate) return err('Velg en frist.');
  if (!(kind in LOG_KINDS)) return err('Velg en type.');
  if (recurrenceRaw && recurrence === null) return err('Gjentakelse må være mellom 1 og 120 måneder.');

  const { error } = await supabase.from('ladder_tasks').insert({
    ladder_id: ladderId,
    kind,
    title,
    description: optional(formData.get('description'), 1000),
    due_date: dueDate,
    recurrence_months: recurrence,
    created_by: user.id,
  });
  if (error) return fail(error);

  refresh(ladderId);
  return ok('Oppgaven er lagt til.');
}
