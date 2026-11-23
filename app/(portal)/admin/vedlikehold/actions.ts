'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, err, fail, isoDate, ok, optional, text, uuid } from '@/lib/portal/forms';
import { idag } from '@/lib/format';
import { parseUploadedPhotos } from '@/components/minside/photos';
import { BUCKETS, orphanPhotos } from '@/lib/portal/storage';
import { isLogKind } from '@/components/minside/util';

/**
 * Vedlikeholdsrapporter som NorthWestCoast legger inn selv: arbeid vi har
 * utført, eller noe kunden har meldt på telefon eller e-post.
 *
 * Rapporten er en vanlig rad i maintenance_logs med kilde «admin», så kunden
 * ser den i historikken til leideren sammen med sine egne loggføringer.
 */

type Failure = { ok: false; error: string };

/** Svaret inneholder id-en til rapporten: bildene lastes opp i mappen med det navnet. */
export type MaintenanceSaved =
  | { ok: true; message: string; logId: string; ladderId: string }
  | Failure;

const no = (error: string): Failure => ({ ok: false, error });

function refresh(ladderId: string) {
  revalidatePath('/admin/vedlikehold');
  revalidatePath('/admin', 'layout');
  revalidatePath(`/minside/leider/${ladderId}`);
}

export async function createMaintenanceReport(formData: FormData): Promise<MaintenanceSaved> {
  const { supabase, ctx } = await requireStaff();

  const ladderId = uuid(formData.get('ladder_id'));
  if (!ladderId) return no('Velg en leider.');

  const kind = text(formData.get('kind'), 20);
  if (!isLogKind(kind)) return no('Velg en type.');

  const today = idag();
  const performedAt = isoDate(formData.get('performed_at'));
  if (!performedAt) return no('Velg en dato.');
  if (performedAt > today) return no('Datoen kan ikke ligge fram i tid.');

  const title = optional(formData.get('title'), 160);
  const notes = optional(formData.get('notes'), 4000);
  if (!title && !notes) return no('Skriv en tittel eller en beskrivelse.');

  const performedBy = text(formData.get('performed_by'), 120);
  if (!performedBy) return no('Skriv hvem som utførte arbeidet.');

  // Fartøy og produksjonsnummer leses fra leideren, ikke fra skjemaet.
  const { data: ladder } = await supabase
    .from('ladders')
    .select('id, vessel_id, serial_number')
    .eq('id', ladderId)
    .maybeSingle();
  if (!ladder) return no('Fant ikke leideren.');

  const { data: log, error } = await supabase
    .from('maintenance_logs')
    .insert({
      ladder_id: ladder.id,
      vessel_id: ladder.vessel_id,
      serial_number_raw: ladder.serial_number,
      reported_by_user_id: ctx.userId,
      reporter_name: performedBy,
      source: 'admin',
      kind,
      title,
      performed_at: performedAt,
      notes,
    })
    .select('id')
    .single();
  if (error || !log) {
    const failed = fail(error, 'Rapporten kunne ikke lagres.');
    return failed.ok ? no('Rapporten kunne ikke lagres.') : failed;
  }

  refresh(ladder.id);
  return {
    ok: true,
    message: `Rapporten er lagret på leider ${ladder.serial_number}.`,
    logId: log.id,
    ladderId: ladder.id,
  };
}

/** Knytter opplastede bilder til en rapport. Bare filer i rapportens egen mappe godtas. */
export async function attachMaintenancePhotos(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const logId = uuid(formData.get('log_id'));
  if (!logId) return err('Fant ikke rapporten.');

  const { data: log } = await supabase
    .from('maintenance_logs')
    .select('id, ladder_id')
    .eq('id', logId)
    .maybeSingle();
  if (!log) return err('Fant ikke rapporten.');

  const photos = parseUploadedPhotos(formData.get('photos'), log.id);
  if (photos.length === 0) return err('Ingen bilder å lagre.');

  // Kommer samme liste to ganger (svaret forsvant på veien), lagres bildene én gang.
  const { data: existing } = await supabase
    .from('maintenance_photos')
    .select('storage_path')
    .eq('maintenance_log_id', log.id);
  const known = new Set((existing ?? []).map((row) => row.storage_path));
  const fresh = photos.filter((photo) => !known.has(photo.path));

  if (fresh.length > 0) {
    const { error } = await supabase.from('maintenance_photos').insert(
      fresh.map((photo) => ({
        maintenance_log_id: log.id,
        storage_path: photo.path,
        captured_at: photo.captured_at,
      })),
    );
    if (error) return fail(error, 'Bildene kunne ikke lagres.');
  }

  if (log.ladder_id) refresh(log.ladder_id);
  else revalidatePath('/admin/vedlikehold');
  return ok(photos.length === 1 ? 'Bildet er lagt til.' : `${photos.length} bilder er lagt til.`);
}

/**
 * Sletter bildene som aldri ble knyttet til en rapport. Lista kommer fra
 * databasen, ikke fra skjemaet, og lagringen lar administratorer slette
 * nettopp disse filene og ingen andre.
 */
export async function deleteOrphanPhotos(): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const paths = (await orphanPhotos(supabase)).map((photo) => photo.path);
  if (paths.length === 0) return ok('Det er ingen løse bilder å slette.');

  let deleted = 0;
  for (let start = 0; start < paths.length; start += 100) {
    const { data, error } = await supabase.storage.from(BUCKETS.logs).remove(paths.slice(start, start + 100));
    if (error) {
      revalidatePath('/admin/vedlikehold');
      return err(`${deleted} av ${paths.length} filer ble slettet før det stoppet: ${error.message}`);
    }
    deleted += data?.length ?? 0;
  }

  revalidatePath('/admin/vedlikehold');
  return deleted === paths.length
    ? ok(`${deleted} filer er slettet.`)
    : err(`Bare ${deleted} av ${paths.length} filer ble slettet. Last siden på nytt og prøv igjen.`);
}
