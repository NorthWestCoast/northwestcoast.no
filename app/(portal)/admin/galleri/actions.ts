'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireMedia } from '@/lib/portal/context';
import { type ActionResult, checked, err, fail, int, ok, optional, text, uuid } from '@/lib/portal/forms';
import { BUCKETS, publicMediaUrl } from '@/lib/portal/storage';
import { GALLERY_TAG } from '@/lib/portal/tags';
import { GALLERY_FOLDER, isImageTag } from '@/lib/gallery-images';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Bildene i galleriet på nettsiden. Administrator og media kan endre dem;
 * RLS på gallery_images og lagringspolicyene på public-media gjør den samme
 * vurderingen i databasen.
 */

const LIST = '/admin/galleri';

/** Så mange bilder kan legges til i én opplasting. Samme grense i skjemaet. */
const MAX_BATCH = 12;

/** Bildeteksten står på selve bildet, så den må være kort. Samme grense i skjemaene. */
const CAPTION_MAX = 60;

/** Filene skjemaet laster opp: galleri/<uuid>.<type>. Ingenting annet tas imot. */
const UPLOADED_PATH = new RegExp(`^${GALLERY_FOLDER}/[0-9a-f-]{36}\\.(jpg|png|webp|avif)$`);

/** Galleriet vises på forsiden og på /galleri; begge bygges på nytt etter en endring. */
function refresh() {
  revalidateTag(GALLERY_TAG);
  revalidatePath('/', 'layout');
  revalidatePath(LIST);
}

/**
 * Adressen som lagres i image_url. Databasen godtar https og stier som
 * starter med «/». Det lokale testmiljøet går over http; der lagres stien, og
 * adressen bygges av storage_path når bildet vises (lib/gallery.ts).
 */
function storedUrl(supabase: SupabaseClient<Database>, path: string): string {
  const url = publicMediaUrl(supabase, path);
  return url.startsWith('https://') ? url : new URL(url).pathname;
}

/**
 * Tekstene og kategorien som står på hvert bilde. Svaret er feltene, eller
 * meldingen til brukeren når noe mangler.
 */
function details(read: (name: string) => unknown) {
  const field = (name: string) => {
    const value = read(name);
    return typeof value === 'string' ? value : null;
  };

  const altNo = text(field('alt_no'), 300);
  const tag = text(field('tag'), 20);
  if (altNo.length < 2) return 'Bildet må ha en beskrivelse på norsk (minst to tegn).';
  if (!isImageTag(tag)) return 'Velg en kategori.';

  return {
    alt_no: altNo,
    alt_en: optional(field('alt_en'), 300),
    caption_no: optional(field('caption_no'), CAPTION_MAX),
    caption_en: optional(field('caption_en'), CAPTION_MAX),
    tag,
  };
}

/**
 * Legger opplastede bilder til i galleriet. Filene er allerede lastet opp fra
 * nettleseren; `images` er en JSON-liste med sti, tekster og kategori.
 */
export async function addImages(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia(LIST);

  let list: unknown;
  try {
    list = JSON.parse(text(formData.get('images'), 60_000));
  } catch {
    return err('Bildene kom ikke fram. Prøv igjen.');
  }
  if (!Array.isArray(list) || list.length === 0) return err('Velg minst ett bilde.');
  if (list.length > MAX_BATCH) return err(`Last opp inntil ${MAX_BATCH} bilder om gangen.`);

  const published = checked(formData.get('published'));
  const rows = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') return err('Bildene kom ikke fram. Prøv igjen.');
    const entry = item as Record<string, unknown>;
    const path = typeof entry.path === 'string' ? entry.path : '';
    if (!UPLOADED_PATH.test(path)) return err('Bildene kom ikke fram. Prøv igjen.');

    const fields = details((name) => entry[name]);
    if (typeof fields === 'string') return err(fields);

    rows.push({
      ...fields,
      storage_path: path,
      image_url: storedUrl(supabase, path),
      contain: entry.contain === true,
      published,
    });
  }

  const { error } = await supabase.from('gallery_images').insert(rows);
  if (error) {
    // Uten rad i galleriet er filene bare søppel i lagringen. Rydd dem bort.
    await supabase.storage.from(BUCKETS.media).remove(rows.map((row) => row.storage_path));
    return fail(error);
  }

  refresh();
  const count = rows.length === 1 ? 'Bildet er lagt til' : `${rows.length} bilder er lagt til`;
  return ok(
    published
      ? `${count} i galleriet.`
      : `${count}, men vises ikke på nettsiden før du publiserer ${rows.length === 1 ? 'det' : 'dem'}.`,
  );
}

/** Lagrer tekster, kategori, rekkefølge og synlighet for ett bilde. */
export async function updateImage(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia(LIST);

  const id = uuid(formData.get('image_id'));
  if (!id) return err('Fant ikke bildet.');

  const fields = details((name) => formData.get(name));
  if (typeof fields === 'string') return err(fields);

  const sortOrder = int(formData.get('sort_order'), 0, 9999);
  if (sortOrder === null) return err('Rekkefølgen må være et tall fra 0 til 9999.');

  const { data, error } = await supabase
    .from('gallery_images')
    .update({
      ...fields,
      contain: checked(formData.get('contain')),
      published: checked(formData.get('published')),
      sort_order: sortOrder,
    })
    .eq('id', id)
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Fant ikke bildet.');

  refresh();
  revalidatePath(`${LIST}/${id}`);
  return ok('Bildet er lagret.');
}

/** Skjuler eller publiserer et bilde uten å åpne skjemaet. */
export async function setImagePublished(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia(LIST);

  const id = uuid(formData.get('image_id'));
  if (!id) return err('Fant ikke bildet.');
  const published = checked(formData.get('published'));

  const { data, error } = await supabase.from('gallery_images').update({ published }).eq('id', id).select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Fant ikke bildet.');

  refresh();
  return ok(published ? 'Bildet vises på nettsiden.' : 'Bildet er skjult.');
}

/**
 * Flytter et bilde ett hakk opp eller ned i lista. Rekkefølgen nummereres
 * 10, 20, 30 …, så det er plass til å sette et bilde inn mellom to andre ved
 * å skrive et tall i skjemaet.
 */
export async function moveImage(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia(LIST);

  const id = uuid(formData.get('image_id'));
  const direction = text(formData.get('direction'), 4);
  if (!id || (direction !== 'up' && direction !== 'down')) return err('Fant ikke bildet.');

  // Samme sortering som lista i admin og galleriet på nettsiden.
  const { data: rows, error } = await supabase
    .from('gallery_images')
    .select('id, sort_order')
    .order('sort_order')
    .order('created_at', { ascending: false })
    .order('id')
    .limit(500);
  if (error) return fail(error);

  const order = (rows ?? []).map((row) => row.id);
  const from = order.indexOf(id);
  if (from < 0) return err('Fant ikke bildet.');

  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0) return ok('Bildet står allerede først.');
  if (to >= order.length) return ok('Bildet står allerede sist.');
  [order[from], order[to]] = [order[to], order[from]];

  const current = new Map((rows ?? []).map((row) => [row.id, row.sort_order]));
  const changes = order
    .map((rowId, index) => ({ id: rowId, sort_order: (index + 1) * 10 }))
    .filter((change) => current.get(change.id) !== change.sort_order);

  // Første gang får alle bildene nytt nummer; etterpå endres bare de to som bytter plass.
  for (let start = 0; start < changes.length; start += 20) {
    const results = await Promise.all(
      changes.slice(start, start + 20).map((change) =>
        supabase.from('gallery_images').update({ sort_order: change.sort_order }).eq('id', change.id),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      refresh();
      return fail(failed.error, 'Rekkefølgen ble ikke lagret. Prøv igjen.');
    }
  }

  refresh();
  return ok(direction === 'up' ? 'Flyttet opp.' : 'Flyttet ned.');
}

/**
 * Sletter et bilde: raden i galleriet først, så fila i lagringen. Med
 * `back` (fra siden for ett bilde) sendes brukeren tilbake til lista.
 */
export async function deleteImage(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia(LIST);

  const id = uuid(formData.get('image_id'));
  if (!id) return err('Fant ikke bildet.');

  const { data: removed, error } = await supabase
    .from('gallery_images')
    .delete()
    .eq('id', id)
    .select('storage_path');
  if (error) return fail(error);
  if (!removed?.length) return err('Fant ikke bildet.');

  // Bare filer i galleriets egen mappe fjernes. Samme bøtte har også
  // forsidebildene til nyhetene.
  const path = removed[0].storage_path;
  let leftover = false;
  if (path && path.startsWith(`${GALLERY_FOLDER}/`) && !path.includes('..')) {
    const { error: storageError } = await supabase.storage.from(BUCKETS.media).remove([path]);
    if (storageError) {
      console.error('[galleri] Fila ble ikke slettet fra lagringen:', path, storageError.message);
      leftover = true;
    }
  }

  refresh();
  if (checked(formData.get('back'))) redirect(`${LIST}?slettet=1`);
  return ok(
    leftover
      ? 'Bildet er fjernet fra galleriet, men fila ble liggende igjen i lagringen.'
      : 'Bildet er slettet.',
  );
}
