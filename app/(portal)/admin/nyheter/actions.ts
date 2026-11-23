'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireMedia } from '@/lib/portal/context';
import { type ActionResult, err, fail, isoDate, ok, optional, text, uuid } from '@/lib/portal/forms';
import { POSTS_TAG } from '@/lib/portal/tags';
import { dato, idag } from '@/lib/format';
import { invalidImageRefs, resolveImage } from '@/lib/post-markdown';

/** Nyhetene vises på forsiden og på /nyheter; begge bygges på nytt etter en endring. */
function refresh() {
  revalidateTag(POSTS_TAG);
  revalidatePath('/', 'layout');
}

/** Adressevennlig navn: små bokstaver, æøå skrevet ut, alt annet blir bindestrek. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

const osloDate = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });

/**
 * Publiseringstidspunktet. Uten valgt dato: behold det som står, ellers nå
 * (første publisering). Med valgt dato: dagens dato betyr nå, andre datoer
 * settes til midt på dagen så datoen blir den samme i norsk tid.
 */
function publishedAt(date: string | null, existing: string | null, publishing: boolean): string | null {
  if (!date) return existing ?? (publishing ? new Date().toISOString() : null);
  if (existing && osloDate(existing) === date) return existing;
  if (date === idag()) return new Date().toISOString();
  return `${date}T12:00:00.000Z`;
}

/** Oppretter eller oppdaterer et innlegg (med `post_id`: oppdaterer). */
export async function savePost(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireMedia();

  const postId = uuid(formData.get('post_id'));
  const titleNo = text(formData.get('title_no'), 200);
  if (titleNo.length < 2) return err('Norsk tittel er påkrevd.');

  const slug = slugify(text(formData.get('slug'), 120) || titleNo);
  if (!slug) return err('Adressen (slug) må inneholde bokstaver eller tall.');

  const status = text(formData.get('status'), 12) === 'published' ? 'published' : 'draft';
  const dateRaw = text(formData.get('published_date'), 12);
  const date = isoDate(dateRaw);
  if (dateRaw && !date) return err('Publiseringsdatoen er ikke gyldig.');

  const cover = text(formData.get('cover_image_url'), 600);
  if (cover && !resolveImage(cover)) {
    return err('Forsidebildet må være lastet opp her eller ligge på nettstedet (/images/…). Bilder fra andre nettsteder vises ikke.');
  }

  const bodyNo = text(formData.get('body_no'), 40_000);
  const bodyEn = optional(formData.get('body_en'), 40_000);
  const badImages = [...new Set([...invalidImageRefs(bodyNo), ...invalidImageRefs(bodyEn ?? '')])];
  if (badImages.length) {
    const list = badImages.slice(0, 5).map((ref) => `«${ref}»`).join(', ');
    return err(
      `Bildeblokken viser til ${badImages.length === 1 ? 'et bilde' : 'bilder'} som ikke er lastet opp: ${list}. ` +
        'Bruk «Legg til bilder» eller importer .md-fila sammen med bildene.',
    );
  }

  let existing: string | null = null;
  if (postId) {
    const { data: current } = await supabase.from('posts').select('published_at').eq('id', postId).maybeSingle();
    if (!current) return err('Fant ikke innlegget.');
    existing = current.published_at;
  }

  const fields = {
    slug,
    title_no: titleNo,
    title_en: optional(formData.get('title_en'), 200),
    tag_no: text(formData.get('tag_no'), 40) || 'Nyheter',
    tag_en: text(formData.get('tag_en'), 40) || 'News',
    excerpt_no: optional(formData.get('excerpt_no'), 500),
    excerpt_en: optional(formData.get('excerpt_en'), 500),
    body_no: bodyNo,
    body_en: bodyEn,
    cover_image_url: cover || null,
    status,
    published_at: publishedAt(date, existing, status === 'published'),
  };

  const slugTaken = (error: { code?: string }) => error.code === '23505';

  if (postId) {
    const { error } = await supabase.from('posts').update(fields).eq('id', postId);
    if (error) return slugTaken(error) ? err(`Adressen «${slug}» er allerede i bruk på et annet innlegg.`) : fail(error);

    // Den automatisk lagrede kopien er nå lagret i innlegget.
    await supabase.from('post_autosaves').delete().eq('post_key', postId);

    refresh();
    revalidatePath('/admin/nyheter');
    revalidatePath(`/admin/nyheter/${postId}`);
    if (status !== 'published') return ok('Kladden er lagret.');
    const scheduled = fields.published_at !== null && new Date(fields.published_at).getTime() > Date.now();
    return ok(
      scheduled
        ? `Innlegget er lagret og blir synlig ${dato(fields.published_at)}.`
        : 'Innlegget er lagret og publisert.',
    );
  }

  const { data: created, error } = await supabase
    .from('posts')
    .insert({ ...fields, author_id: ctx.userId, author_name: ctx.displayName })
    .select('id')
    .single();
  if (error) return slugTaken(error) ? err(`Adressen «${slug}» er allerede i bruk på et annet innlegg.`) : fail(error);

  await supabase.from('post_autosaves').delete().eq('post_key', 'ny');

  refresh();
  revalidatePath('/admin/nyheter');
  redirect(`/admin/nyheter/${created.id}?lagret=1`);
}

/**
 * Henter tilbake en versjon (public.restore_post_revision). Finnes innlegget,
 * erstattes innholdet og status beholdes; er det slettet, kommer det tilbake
 * som kladd. Det som sto der før, blir liggende som en versjon.
 */
export async function restorePostRevision(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia();

  const revisionId = uuid(formData.get('revision_id'));
  if (!revisionId) return err('Fant ikke versjonen.');

  const { data: postId, error } = await supabase.rpc('restore_post_revision', { p_revision: revisionId });
  if (error) {
    return error.code === '23505'
      ? err('Adressen (slug) i denne versjonen brukes nå av et annet innlegg. Endre adressen på det andre innlegget først.')
      : fail(error);
  }

  refresh();
  revalidatePath('/admin/nyheter');
  revalidatePath(`/admin/nyheter/${postId}`);
  redirect(`/admin/nyheter/${postId}?hentet=1`);
}

export async function deletePost(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia();

  const postId = uuid(formData.get('post_id'));
  if (!postId) return err('Fant ikke innlegget.');

  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) return fail(error);

  refresh();
  revalidatePath('/admin/nyheter');
  redirect('/admin/nyheter?slettet=1');
}
