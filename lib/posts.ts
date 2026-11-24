import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_ARTICLE_IMAGE, type LocalizedArticle } from './articles';
import type { Lang } from './i18n';
import { firstParagraph, galleryEntries, resolveImage } from './post-markdown';
import { POSTS_TAG } from './portal/tags';
import type { Database } from './supabase/database.types';
import { SUPABASE_ANON_KEY, SUPABASE_URL, noteSupabaseMissing, supabaseConfigured } from './supabase/config';

/**
 * Nyhetene på nettsiden.
 *
 * Innleggene skrives i admin og ligger i posts-tabellen. De leses uten
 * cookies (ellers ville sidene blitt dynamiske) og mellomlagres med taggen
 * POSTS_TAG. Når et innlegg lagres i admin kalles revalidateTag(POSTS_TAG),
 * og sidene bygges på nytt ved neste besøk – ingen deploy nødvendig.
 *
 * Databasen er eneste kilde, så det som slettes i admin forsvinner også fra
 * nettsiden. Svarer ikke databasen, vises ingen nyheter (forsiden hopper da
 * over nyhetskortet).
 */

type PostRow = Pick<
  Database['public']['Tables']['posts']['Row'],
  | 'slug'
  | 'title_no'
  | 'title_en'
  | 'excerpt_no'
  | 'excerpt_en'
  | 'body_no'
  | 'body_en'
  | 'tag_no'
  | 'tag_en'
  | 'cover_image_url'
  | 'published_at'
  | 'updated_at'
>;

const COLUMNS =
  'slug, title_no, title_en, excerpt_no, excerpt_en, body_no, body_en, tag_no, tag_en, cover_image_url, published_at, updated_at';

/** Anonym klient uten sesjon. RLS slipper bare gjennom publiserte innlegg. */
function anonClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Ikke la et pauset Supabase-prosjekt henge bygget eller sidevisningen.
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
    },
  });
}

const cached = unstable_cache(
  async (): Promise<PostRow[]> => {
    if (!supabaseConfigured) throw new Error('Supabase er ikke konfigurert.');

    // «Publisert nå eller tidligere» avgjøres av RLS med databasens klokke.
    // Et filter på tidspunkt herfra kunne utelatt et helt nytt innlegg hvis
    // serverklokka lå litt etter, og så blitt stående i mellomlageret.
    const { data, error } = await anonClient()
      .from('posts')
      .select(COLUMNS)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(`Kunne ikke lese nyhetene: ${error.message}`);
    return data ?? [];
  },
  ['posts'],
  // Kaster vi, lagres ingenting – reserven blir altså aldri mellomlagret.
  { tags: [POSTS_TAG], revalidate: 3600 },
);

/** Én lesing per forespørsel, også når metadata og side spør hver for seg. */
const loadPosts = cache(async (): Promise<PostRow[]> => {
  // Uten Supabase er ingen nyheter det forventede svaret, ikke en feil.
  if (!supabaseConfigured) {
    noteSupabaseMissing();
    return [];
  }
  try {
    return await cached();
  } catch (error) {
    console.error('[posts] Viser ingen nyheter:', error instanceof Error ? error.message : error);
    return [];
  }
});

const filled = (value: string | null | undefined) => (value && value.trim() ? value.trim() : '');

/** Engelsk tekst hvis den finnes, ellers norsk. */
const localized = (lang: Lang, no: string | null, en: string | null) =>
  (lang === 'en' && filled(en)) || filled(no);

/** DD.MM.YYYY i norsk tid. */
function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  const parts = new Intl.DateTimeFormat('nb-NO', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Oslo',
  }).formatToParts(parsed);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')}.${part('month')}.${part('year')}`;
}

/** Forsidebilde: et bilde vi godtar (se resolveImage), ellers standardbildet. */
const coverImage = (value: string | null) => resolveImage(value) ?? DEFAULT_ARTICLE_IMAGE;

/** Ingress når innlegget ikke har en: første avsnitt, uten formatering. */
function summarize(body: string): string {
  const plain = firstParagraph(body);
  return plain.length > 200 ? `${plain.slice(0, 197).trimEnd()}…` : plain;
}

/** Det seneste av to tidspunkt. Et innlegg som lagres før publiseringsdatoen, er ikke endret før det kom ut. */
function latest(a: string | null, b: string | null): string | null {
  if (!a || !b) return a ?? b;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function fromRow(row: PostRow, lang: Lang): LocalizedArticle {
  const body = localized(lang, row.body_no, row.body_en);
  const excerpt = localized(lang, row.excerpt_no, row.excerpt_en) || summarize(body);
  const images = [...new Set(galleryEntries(body).map((entry) => resolveImage(entry.ref)).filter((src): src is string => Boolean(src)))];

  return {
    slug: row.slug,
    date: row.published_at ? formatDate(row.published_at) : '',
    image: coverImage(row.cover_image_url),
    tag: localized(lang, row.tag_no, row.tag_en),
    title: localized(lang, row.title_no, row.title_en),
    excerpt,
    teaser: excerpt,
    body,
    publishedAt: row.published_at,
    modifiedAt: latest(row.updated_at, row.published_at),
    images,
  };
}

/** Alle publiserte innlegg, nyeste først. */
export async function getArticles(lang: Lang): Promise<LocalizedArticle[]> {
  const rows = await loadPosts();
  return rows.map((row) => fromRow(row, lang));
}

/** Ett innlegg på slug, eller null når det ikke finnes (eller ikke er publisert). */
export async function getArticle(slug: string, lang: Lang): Promise<LocalizedArticle | null> {
  const articles = await getArticles(lang);
  return articles.find((article) => article.slug === slug) ?? null;
}
