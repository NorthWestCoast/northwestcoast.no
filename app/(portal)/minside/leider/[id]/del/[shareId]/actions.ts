'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/portal/context';
import { type ActionResult, err, fail, ok, uuid } from '@/lib/portal/forms';
import { BUCKETS } from '@/lib/portal/storage';
import { parseUploadedPhotos } from '@/components/minside/photos';

function refresh(ladderId: string | null, shareId: string) {
  if (ladderId) revalidatePath(`/minside/leider/${ladderId}/del/${shareId}`);
  revalidatePath('/minside', 'layout');
}

/** Knytter opplastede bilder til en delt tilstandsrapport. */
export async function attachSharePhotos(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const shareId = uuid(formData.get('share_id'));
  if (!shareId) return err('Fant ikke rapporten.');

  // Bare filer i delingens egen mappe.
  const photos = parseUploadedPhotos(formData.get('photos'), shareId);
  if (photos.length === 0) return err('Ingen bilder å lagre.');

  const now = new Date().toISOString();
  const { error } = await supabase.from('ladder_state_photos').insert(
    photos.map((photo) => ({
      share_id: shareId,
      storage_path: photo.path,
      kind: 'other' as const,
      captured_at: photo.captured_at ?? now,
    })),
  );
  if (error) return fail(error, 'Bildene kunne ikke lagres.');

  refresh(uuid(formData.get('ladder_id')), shareId);
  return ok(photos.length === 1 ? 'Bildet er lagt til i rapporten.' : `${photos.length} bilder er lagt til i rapporten.`);
}

/** Sletter ett bilde fra rapporten: både raden og filen. */
export async function deleteSharePhoto(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const photoId = uuid(formData.get('photo_id'));
  const shareId = uuid(formData.get('share_id'));
  if (!photoId || !shareId) return err('Fant ikke bildet.');

  const { data: deleted, error } = await supabase
    .from('ladder_state_photos')
    .delete()
    .eq('id', photoId)
    .eq('share_id', shareId)
    .select('storage_path');
  if (error) return fail(error, 'Bildet kunne ikke slettes.');
  if (!deleted?.length) return err('Fant ikke bildet.');

  // Raden er borte, så bildet vises ikke lenger. Filen ryddes hvis vi får lov
  // (lagringen tillater ikke sletting etter at delingen er trukket tilbake).
  const { error: storageError } = await supabase.storage
    .from(BUCKETS.shares)
    .remove(deleted.map((row) => row.storage_path));
  if (storageError) console.error('[deling] Kunne ikke slette filen:', storageError.message);

  refresh(uuid(formData.get('ladder_id')), shareId);
  return ok('Bildet er slettet.');
}

/** Trekker tilbake lenken. Den slutter å virke med en gang, og bildene stenges. */
export async function revokeShare(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const shareId = uuid(formData.get('share_id'));
  if (!shareId) return err('Fant ikke rapporten.');

  const { data, error } = await supabase
    .from('ladder_state_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', shareId)
    .is('revoked_at', null)
    .select('id');
  if (error) return fail(error, 'Lenken kunne ikke trekkes tilbake.');
  if (!data?.length) return err('Lenken er allerede trukket tilbake.');

  refresh(uuid(formData.get('ladder_id')), shareId);
  return ok('Lenken er trukket tilbake og virker ikke lenger.');
}
