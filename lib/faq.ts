import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { Lang } from './i18n';
import { FAQ_TAG } from './portal/tags';
import type { Database } from './supabase/database.types';
import { SUPABASE_ANON_KEY, SUPABASE_URL, noteSupabaseMissing, supabaseConfigured } from './supabase/config';

/**
 * Spørsmål og svar på nettsiden (/faq, forsiden, strukturert data og
 * llms-full.txt).
 *
 * Skrives i admin (/admin/faq) og ligger i faq_items. Leses uten cookies og
 * mellomlagres med taggen FAQ_TAG; admin kaller revalidateTag(FAQ_TAG) når
 * noe lagres. Databasen er eneste kilde: svarer den ikke, vises ingen
 * spørsmål.
 */

export const FAQ_CATEGORIES = ['product', 'certification', 'installation', 'delivery'] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];
export const isFaqCategory = (value: string): value is FaqCategory =>
  (FAQ_CATEGORIES as readonly string[]).includes(value);

/** Ett spørsmål på ett språk. */
export type FaqEntry = { id: string; category: FaqCategory; q: string; a: string };

/** Så mange spørsmål vises på forsiden: de første i lista. */
export const FAQ_FRONT_PAGE = 4;

type Row = Pick<
  Database['public']['Tables']['faq_items']['Row'],
  'id' | 'category' | 'question_no' | 'answer_no' | 'question_en' | 'answer_en'
>;

function anonClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
    },
  });
}

const cached = unstable_cache(
  async (): Promise<Row[]> => {
    if (!supabaseConfigured) throw new Error('Supabase er ikke konfigurert.');
    const { data, error } = await anonClient()
      .from('faq_items')
      .select('id, category, question_no, answer_no, question_en, answer_en')
      .eq('published', true)
      .order('sort_order')
      .order('created_at')
      .limit(200);
    if (error) throw new Error(`Kunne ikke lese spørsmålene: ${error.message}`);
    return data ?? [];
  },
  ['faq'],
  { tags: [FAQ_TAG], revalidate: 3600 },
);

const loadFaq = cache(async (): Promise<Row[]> => {
  if (!supabaseConfigured) {
    noteSupabaseMissing();
    return [];
  }
  try {
    return await cached();
  } catch (error) {
    console.error('[faq] Viser ingen spørsmål:', error instanceof Error ? error.message : error);
    return [];
  }
});

const filled = (value: string | null | undefined) => (value && value.trim() ? value.trim() : '');

/** Publiserte spørsmål i rekkefølge. Engelsk der det finnes, ellers norsk. */
export async function getFaq(lang: Lang): Promise<FaqEntry[]> {
  const rows = await loadFaq();
  return rows.map((row) => {
    const english = lang === 'en' && filled(row.question_en) && filled(row.answer_en);
    return {
      id: row.id,
      category: isFaqCategory(row.category) ? row.category : 'product',
      q: english ? filled(row.question_en) : filled(row.question_no),
      a: english ? filled(row.answer_en) : filled(row.answer_no),
    };
  });
}

/** Svaret som avsnitt: blank linje skiller avsnittene. */
export const answerParagraphs = (answer: string) =>
  answer.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
