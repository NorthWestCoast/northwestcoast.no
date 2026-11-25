'use server';

import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/portal/context';
import {
  type ActionResult, checked, err, fail, int, isoDate, ok, optional, text, uuid,
} from '@/lib/portal/forms';
import { createInvitation } from '@/lib/portal/invite';
import { idag } from '@/lib/format';
import { parseUploadedPhotos } from '@/components/minside/photos';
import { SHARE_CHECKLIST, SHARE_DAYS, isLogKind } from '@/components/minside/util';
import { checklistLogTitle, checklistPayload, isChecklist } from '@/lib/maintenance-checklists';
import type { FinishResult, RegisterInput, RegisterResult } from '@/components/maintenance-checklist-form';
import type { UploadedFile } from '@/components/portal/photo-uploader';
import { LINK_DAYS } from '@/components/minside/maintenance-links';

/**
 * Handlinger på leidersiden. RLS avgjør hva brukeren får gjøre; her
 * valideres bare inndata, og leiderens egne opplysninger (fartøy,
 * produksjonsnummer) leses fra databasen framfor å stole på skjemaet.
 */

function refresh() {
  revalidatePath('/minside', 'layout');
}

/** Ny loggføring: vedlikehold, inspeksjon, test, bruk, reparasjon eller notat. */
export async function addLogEntry(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireUser();

  const ladderId = uuid(formData.get('ladder_id'));
  if (!ladderId) return err('Fant ikke leideren.');

  const kind = text(formData.get('kind'), 20);
  if (!isLogKind(kind)) return err('Velg hva slags loggføring det er.');

  const today = idag();
  const performedAt = isoDate(formData.get('performed_at')) ?? today;
  if (performedAt > today) return err('Datoen kan ikke ligge fram i tid.');

  const title = optional(formData.get('title'), 160);
  const notes = optional(formData.get('notes'), 4000);
  if (!title && !notes) return err('Skriv en tittel eller et notat.');

  const { data: ladder } = await supabase
    .from('ladders')
    .select('id, vessel_id, serial_number')
    .eq('id', ladderId)
    .maybeSingle();
  if (!ladder) return err('Du har ikke tilgang til denne leideren.');

  const { error } = await supabase.from('maintenance_logs').insert({
    ladder_id: ladder.id,
    vessel_id: ladder.vessel_id,
    serial_number_raw: ladder.serial_number,
    reported_by_user_id: ctx.userId,
    reporter_name: ctx.displayName,
    source: 'portal',
    kind,
    title,
    performed_at: performedAt,
    notes,
  });
  if (error) return fail(error, 'Loggføringen kunne ikke lagres.');

  refresh();
  return ok('Loggført. Du kan legge til bilder på oppføringen under det neste døgnet.');
}

/** Knytter opplastede bilder til en loggføring brukeren selv har skrevet. */
export async function attachLogPhotos(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const logId = uuid(formData.get('log_id'));
  if (!logId) return err('Fant ikke loggføringen.');

  // Bare filer i loggføringens egen mappe.
  const photos = parseUploadedPhotos(formData.get('photos'), logId);
  if (photos.length === 0) return err('Ingen bilder å lagre.');

  const { error } = await supabase.from('maintenance_photos').insert(
    photos.map((photo) => ({
      maintenance_log_id: logId,
      storage_path: photo.path,
      captured_at: photo.captured_at,
    })),
  );
  if (error) return fail(error, 'Bildene kunne ikke lagres.');

  refresh();
  return ok(photos.length === 1 ? 'Bildet er lagt til.' : `${photos.length} bilder er lagt til.`);
}

/**
 * Registrering fra skjemaet med sjekkpunkter (fanen «Registrer vedlikehold»).
 * Bundet til leideren på serveren: `registerMaintenance.bind(null, id)`.
 *
 * Teksten på punktene hentes her; skjemaet sender bare avkrysningene.
 * Databasen regner selv ut om registreringen er ufullstendig.
 */
export async function registerMaintenance(ladderId: string, input: RegisterInput): Promise<RegisterResult> {
  const { supabase, ctx } = await requireUser();

  const id = uuid(ladderId);
  if (!id) return { ok: false, error: 'Fant ikke leideren.' };

  const checklist = input?.checklist ?? null;
  if (checklist !== null && !isChecklist(checklist)) return { ok: false, error: 'Ukjent sjekkliste.' };

  const today = idag();
  const performedAt = isoDate(typeof input.performedAt === 'string' ? input.performedAt : null) ?? today;
  if (performedAt > today) return { ok: false, error: 'Datoen kan ikke ligge fram i tid.' };

  const paper = checklist !== null && input.paperForm === true;
  const title = checklist ? checklistLogTitle(checklist) : optional(String(input.title ?? ''), 160);
  const notes = optional(String(input.notes ?? ''), 4000);
  if (!checklist && !title && !notes) return { ok: false, error: 'Skriv hva som ble gjort.' };

  const { data: ladder } = await supabase
    .from('ladders')
    .select('id, vessel_id, serial_number')
    .eq('id', id)
    .maybeSingle();
  if (!ladder) return { ok: false, error: 'Du har ikke tilgang til denne leideren.' };

  const { data: log, error } = await supabase
    .from('maintenance_logs')
    .insert({
      ladder_id: ladder.id,
      vessel_id: ladder.vessel_id,
      serial_number_raw: ladder.serial_number,
      reported_by_user_id: ctx.userId,
      reporter_name: ctx.displayName,
      source: 'portal',
      kind: checklist ? 'inspection' : 'maintenance',
      title,
      performed_at: performedAt,
      notes,
      checklist,
      checklist_items: checklist && !paper ? checklistPayload('no', checklist, input.checked) : [],
      paper_form: paper,
    })
    .select('id')
    .single();
  if (error || !log) {
    console.error('[registrer] Kunne ikke lagre:', error?.code, error?.message);
    return { ok: false, error: 'Registreringen kunne ikke lagres. Prøv igjen.' };
  }

  refresh();
  return { ok: true, logId: log.id };
}

/** Knytter bildene nettleseren lastet opp, til registreringen. */
export async function finishRegistration(ladderId: string, logId: string, photos: UploadedFile[]): Promise<FinishResult> {
  const { supabase } = await requireUser();
  const id = uuid(logId);
  if (!id || !uuid(ladderId)) return { ok: false };

  const parsed = parseUploadedPhotos(JSON.stringify(photos ?? []), id, 10);
  if (parsed.length > 0) {
    const { error } = await supabase.from('maintenance_photos').insert(
      parsed.map((photo) => ({ maintenance_log_id: id, storage_path: photo.path, captured_at: photo.captured_at })),
    );
    if (error) {
      console.error('[registrer] Bildene kunne ikke knyttes:', error.code, error.message);
      return { ok: false };
    }
  }

  refresh();
  return { ok: true };
}

/**
 * Ny lenke for registrering uten innlogging. Som delingslenkene lagres bare
 * hashen; lenken vises én gang, rett etter at den er laget.
 */
export async function createMaintenanceLink(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireUser();

  const ladderId = uuid(formData.get('ladder_id'));
  if (!ladderId) return err('Fant ikke leideren.');

  const days = int(formData.get('days'), 1, 366);
  if (days === null || !LINK_DAYS.some((d) => d === days)) return err('Velg hvor lenge lenken skal gjelde.');

  const token = randomBytes(24).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const { error } = await supabase.from('maintenance_links').insert({
    ladder_id: ladderId,
    token_hash: tokenHash,
    created_by: ctx.userId,
    recipient: optional(formData.get('recipient'), 160),
    expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
  });
  if (error) return fail(error, 'Lenken kunne ikke lages. Bare den som forvalter leideren, kan lage lenker.');

  refresh();
  redirect(`/minside/leider/${ladderId}?fane=registrer&lenke=${token}#lenker`);
}

/** Trekker tilbake en lenke. Den kan ikke åpnes igjen. */
export async function revokeMaintenanceLink(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const linkId = uuid(formData.get('link_id'));
  if (!linkId) return err('Fant ikke lenken.');

  const { error } = await supabase.rpc('revoke_maintenance_link', { p_link: linkId });
  if (error) return fail(error, 'Lenken kunne ikke trekkes tilbake.');

  refresh();
  return ok('Lenken er trukket tilbake.');
}

/** Ny planlagt oppgave på leideren. */
export async function createTask(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireUser();

  const ladderId = uuid(formData.get('ladder_id'));
  if (!ladderId) return err('Fant ikke leideren.');

  const title = text(formData.get('title'), 160);
  if (title.length < 2) return err('Skriv hva som skal gjøres.');

  const kind = text(formData.get('kind'), 20);
  if (!isLogKind(kind)) return err('Velg type oppgave.');

  const dueDate = isoDate(formData.get('due_date'));
  if (!dueDate) return err('Velg en frist.');

  let recurrence: number | null = null;
  if (text(formData.get('recurrence_months'), 12)) {
    recurrence = int(formData.get('recurrence_months'), 1, 120);
    if (recurrence === null) return err('Gjentakelse må være et helt antall måneder mellom 1 og 120.');
  }

  const { error } = await supabase.from('ladder_tasks').insert({
    ladder_id: ladderId,
    title,
    kind,
    due_date: dueDate,
    recurrence_months: recurrence,
    description: optional(formData.get('description'), 1000),
    created_by: ctx.userId,
  });
  if (error) return fail(error, 'Oppgaven kunne ikke lagres.');

  refresh();
  return ok('Oppgaven er lagt til.');
}

/** Fullfører en oppgave. Databasen skriver loggføringen og neste forekomst. */
export async function completeTask(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const taskId = uuid(formData.get('task_id'));
  if (!taskId) return err('Fant ikke oppgaven.');

  const today = idag();
  const performedAt = isoDate(formData.get('performed_at')) ?? today;
  if (performedAt > today) return err('Datoen kan ikke ligge fram i tid.');

  const { error } = await supabase.rpc('complete_ladder_task', {
    p_task: taskId,
    p_notes: optional(formData.get('notes'), 4000) ?? undefined,
    p_performed_at: performedAt,
  });
  if (error) return fail(error, 'Oppgaven kunne ikke fullføres.');

  refresh();
  return ok('Oppgaven er fullført og loggført.');
}

export async function deleteTask(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const taskId = uuid(formData.get('task_id'));
  if (!taskId) return err('Fant ikke oppgaven.');

  const { data, error } = await supabase.from('ladder_tasks').delete().eq('id', taskId).select('id');
  if (error) return fail(error, 'Oppgaven kunne ikke slettes.');
  if (!data?.length) return err('Du kan bare slette oppgaver du selv har laget, eller på leidere du administrerer.');

  refresh();
  return ok('Oppgaven er slettet.');
}

/**
 * Oppretter en delt tilstandsrapport. Lenken inneholder et tilfeldig token;
 * bare hashen lagres, så lenken kan ikke hentes fram igjen senere.
 */
export async function createShare(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireUser();

  const ladderId = uuid(formData.get('ladder_id'));
  if (!ladderId) return err('Fant ikke leideren.');

  const days = int(formData.get('days'), 1, 14);
  if (days === null || !SHARE_DAYS.some((d) => d === days)) return err('Velg hvor lenge lenken skal være gyldig.');

  const { data: ladder } = await supabase
    .from('ladders')
    .select('id, vessel_id')
    .eq('id', ladderId)
    .maybeSingle();
  if (!ladder) return err('Du har ikke tilgang til denne leideren.');

  const token = randomBytes(24).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const { data: share, error } = await supabase
    .from('ladder_state_shares')
    .insert({
      ladder_id: ladder.id,
      vessel_id: ladder.vessel_id,
      token_hash: tokenHash,
      created_by: ctx.userId,
      created_by_name: ctx.displayName,
      title: optional(formData.get('title'), 160) ?? 'Tilstandsrapport',
      recipient: optional(formData.get('recipient'), 160),
      note: optional(formData.get('note'), 2000),
      expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
      checklist: SHARE_CHECKLIST.map((label, index) => ({
        label,
        checked: checked(formData.get(`check_${index}`)),
      })),
    })
    .select('id')
    .single();
  if (error || !share) return fail(error, 'Rapporten kunne ikke opprettes.');

  refresh();
  redirect(`/minside/leider/${ladder.id}/del/${share.id}?token=${token}`);
}

/** Gir en person tilgang til akkurat denne leideren. */
export async function inviteToLadder(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireUser();

  const ladderId = uuid(formData.get('ladder_id'));
  if (!ladderId) return err('Fant ikke leideren.');

  const role = text(formData.get('role'), 20);
  if (role !== 'manager' && role !== 'viewer') return err('Velg en rolle.');

  const { data: ladder } = await supabase
    .from('ladders')
    .select('id, serial_number')
    .eq('id', ladderId)
    .maybeSingle();
  if (!ladder) return err('Du har ikke tilgang til denne leideren.');

  const result = await createInvitation(supabase, ctx, {
    scope: 'ladder',
    id: ladder.id,
    role,
    email: text(formData.get('email'), 160),
    targetName: `leider ${ladder.serial_number}`,
    message: optional(formData.get('message'), 500),
  });

  if (result.ok) refresh();
  return result;
}

/** Fjerner direkte tilgang til leideren. Alle kan fjerne sin egen. */
export async function removeLadderMember(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireUser();

  const ladderId = uuid(formData.get('ladder_id'));
  const userId = uuid(formData.get('user_id'));
  if (!ladderId || !userId) return err('Fant ikke tilgangen.');

  const { data, error } = await supabase
    .from('ladder_members')
    .delete()
    .eq('ladder_id', ladderId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) return fail(error, 'Tilgangen kunne ikke fjernes.');
  if (!data?.length) return err('Du kan ikke fjerne denne tilgangen.');

  refresh();
  // Fjernet man sin egen tilgang, finnes ikke siden for en lenger.
  if (userId === ctx.userId) redirect('/minside/leidere');
  return ok('Tilgangen er fjernet.');
}
