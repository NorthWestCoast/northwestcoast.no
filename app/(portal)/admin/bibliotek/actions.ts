'use server';

import { revalidatePath } from 'next/cache';
import { requireMedia } from '@/lib/portal/context';
import { type ActionResult, err, fail, ok, optional, uuid } from '@/lib/portal/forms';
import { BUCKETS } from '@/lib/portal/storage';
import { LIBRARY_PATH, usageByPath } from '@/lib/media-library';

/**
 * Bildebiblioteket. Bildene lastes opp fra nettleseren (lib/portal/upload-image.ts)
 * og føres inn der; her endres beskrivelsene, og bilder som ikke er i bruk
 * slettes. RLS på media_library og lagringspolicyene på public-media slipper
 * bare administrator og media til.
 */

const LIST = '/admin/bibliotek';

/** Lagrer beskrivelsene av ett bilde. */
export async function updateLibraryImage(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia(LIST);

  const id = uuid(formData.get('image_id'));
  if (!id) return err('Fant ikke bildet.');

  const { data, error } = await supabase
    .from('media_library')
    .update({ alt_no: optional(formData.get('alt_no'), 300), alt_en: optional(formData.get('alt_en'), 300) })
    .eq('id', id)
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Fant ikke bildet.');

  revalidatePath(LIST);
  return ok('Lagret.');
}

/**
 * Sletter et bilde fra biblioteket og lagringen. Et bilde som står i et
 * innlegg (bildeblokk eller forsidebilde, også i utkast), slettes ikke:
 * da ville innlegget vist et bilde som ikke finnes.
 */
export async function deleteLibraryImage(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia(LIST);

  const id = uuid(formData.get('image_id'));
  if (!id) return err('Fant ikke bildet.');

  const { data: image, error: readError } = await supabase
    .from('media_library')
    .select('id, storage_path')
    .eq('id', id)
    .maybeSingle();
  if (readError) return fail(readError);
  if (!image) return err('Fant ikke bildet.');

  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('id, title_no, body_no, body_en, cover_image_url')
    .limit(2000);
  if (postsError) return fail(postsError);
  const uses = usageByPath(posts ?? [], [image.storage_path]).get(image.storage_path) ?? [];
  if (uses.length) {
    return err(
      `Bildet brukes i ${uses.map((post) => `«${post.title}»`).join(', ')}. Fjern det fra ${
        uses.length === 1 ? 'innlegget' : 'innleggene'
      } først.`,
    );
  }

  const { error } = await supabase.from('media_library').delete().eq('id', id);
  if (error) return fail(error);

  let leftover = false;
  if (LIBRARY_PATH.test(image.storage_path)) {
    const { error: storageError } = await supabase.storage.from(BUCKETS.media).remove([image.storage_path]);
    if (storageError) {
      console.error('[bibliotek] Fila ble ikke slettet fra lagringen:', image.storage_path, storageError.message);
      leftover = true;
    }
  }

  revalidatePath(LIST);
  return ok(leftover ? 'Bildet er fjernet fra biblioteket, men fila ble liggende igjen i lagringen.' : 'Bildet er slettet.');
}
