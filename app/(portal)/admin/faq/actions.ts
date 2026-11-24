'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireMedia } from '@/lib/portal/context';
import { type ActionResult, checked, err, fail, ok, optional, text, uuid } from '@/lib/portal/forms';
import { FAQ_TAG } from '@/lib/portal/tags';
import { isFaqCategory } from '@/lib/faq';

/**
 * Spørsmål og svar på /faq og forsiden. Administrator og media kan endre
 * dem; RLS på faq_items gjør den samme vurderingen i databasen.
 */

const LIST = '/admin/faq';

/** /faq og forsiden (de fire første) bygges på nytt etter en endring, og llms-full.txt. */
function refresh() {
  revalidateTag(FAQ_TAG);
  revalidatePath('/', 'layout');
  revalidatePath(LIST);
}

/** Feltene i skjemaet, eller meldingen til brukeren når noe mangler. */
function fields(formData: FormData) {
  const questionNo = text(formData.get('question_no'), 300);
  const answerNo = text(formData.get('answer_no'), 4000);
  const category = text(formData.get('category'), 20);
  if (questionNo.length < 3) return 'Skriv spørsmålet på norsk.';
  if (answerNo.length < 2) return 'Skriv svaret på norsk.';
  if (!isFaqCategory(category)) return 'Velg en kategori.';

  const questionEn = optional(formData.get('question_en'), 300);
  const answerEn = optional(formData.get('answer_en'), 4000);
  if (Boolean(questionEn) !== Boolean(answerEn)) {
    return 'Den engelske utgaven trenger både spørsmål og svar, eller ingen av dem.';
  }
  return {
    question_no: questionNo,
    answer_no: answerNo,
    question_en: questionEn,
    answer_en: answerEn,
    category,
    published: checked(formData.get('published')),
  };
}

/** Nytt spørsmål, nederst i lista. */
export async function createFaqItem(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia(LIST);

  const values = fields(formData);
  if (typeof values === 'string') return err(values);

  const { data: last } = await supabase
    .from('faq_items')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('faq_items').insert({ ...values, sort_order: (last?.sort_order ?? 0) + 10 });
  if (error) return fail(error);

  refresh();
  return ok(values.published ? 'Spørsmålet er lagt til nederst på /faq.' : 'Spørsmålet er lagt til, men vises ikke før du publiserer det.');
}

/** Lagrer ett spørsmål. */
export async function updateFaqItem(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia(LIST);

  const id = uuid(formData.get('faq_id'));
  if (!id) return err('Fant ikke spørsmålet.');
  const values = fields(formData);
  if (typeof values === 'string') return err(values);

  const { data, error } = await supabase.from('faq_items').update(values).eq('id', id).select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Fant ikke spørsmålet.');

  refresh();
  revalidatePath(`${LIST}/${id}`);
  return ok('Spørsmålet er lagret.');
}

/** Skjuler eller publiserer uten å åpne skjemaet. */
export async function setFaqPublished(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia(LIST);

  const id = uuid(formData.get('faq_id'));
  if (!id) return err('Fant ikke spørsmålet.');
  const published = checked(formData.get('published'));

  const { data, error } = await supabase.from('faq_items').update({ published }).eq('id', id).select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Fant ikke spørsmålet.');

  refresh();
  return ok(published ? 'Spørsmålet vises på nettsiden.' : 'Spørsmålet er skjult.');
}

/** Flytter et spørsmål ett hakk opp eller ned. Rekkefølgen nummereres 10, 20, 30 … */
export async function moveFaqItem(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia(LIST);

  const id = uuid(formData.get('faq_id'));
  const direction = text(formData.get('direction'), 4);
  if (!id || (direction !== 'up' && direction !== 'down')) return err('Fant ikke spørsmålet.');

  const { data: rows, error } = await supabase
    .from('faq_items')
    .select('id, sort_order')
    .order('sort_order')
    .order('created_at')
    .limit(500);
  if (error) return fail(error);

  const order = (rows ?? []).map((row) => row.id);
  const from = order.indexOf(id);
  if (from < 0) return err('Fant ikke spørsmålet.');
  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= order.length) return ok('Spørsmålet står allerede ytterst.');
  [order[from], order[to]] = [order[to], order[from]];

  const current = new Map((rows ?? []).map((row) => [row.id, row.sort_order]));
  const changes = order
    .map((rowId, index) => ({ id: rowId, sort_order: (index + 1) * 10 }))
    .filter((change) => current.get(change.id) !== change.sort_order);

  const results = await Promise.all(
    changes.map((change) => supabase.from('faq_items').update({ sort_order: change.sort_order }).eq('id', change.id)),
  );
  const failed = results.find((result) => result.error);
  refresh();
  if (failed?.error) return fail(failed.error, 'Rekkefølgen ble ikke lagret. Prøv igjen.');
  return ok(direction === 'up' ? 'Flyttet opp.' : 'Flyttet ned.');
}

/** Sletter et spørsmål. Med `back` (fra siden for ett spørsmål) sendes brukeren til lista. */
export async function deleteFaqItem(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireMedia(LIST);

  const id = uuid(formData.get('faq_id'));
  if (!id) return err('Fant ikke spørsmålet.');

  const { data, error } = await supabase.from('faq_items').delete().eq('id', id).select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Fant ikke spørsmålet.');

  refresh();
  if (checked(formData.get('back'))) redirect(`${LIST}?slettet=1`);
  return ok('Spørsmålet er slettet.');
}
