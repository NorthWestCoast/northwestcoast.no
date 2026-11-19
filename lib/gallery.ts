import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { fixedGalleryItems, isImageTag, type GalleryItem } from './gallery-images';
import { getDict, type Lang } from './i18n';
import { BUCKETS } from './portal/storage';
import { GALLERY_TAG } from './portal/tags';
import type { Database } from './supabase/database.types';
import { SUPABASE_ANON_KEY, SUPABASE_URL, noteSupabaseMissing, supabaseConfigured } from './supabase/config';

/**
 * Galleriet på nettsiden.
 *
 * Bildene som lastes opp i admin ligger i gallery_images og vises sammen med
 * de faste bildene (lib/gallery-images.ts). De leses uten cookies (ellers
 * ville sidene blitt dynamiske) og mellomlagres med taggen GALLERY_TAG. Når
 * noe endres i admin kalles revalidateTag(GALLERY_TAG), og sidene bygges på
 * nytt ved neste besøk – ingen deploy nødvendig.
 *
 * De faste bildene er også reserven: svarer ikke databasen, vises de alene.
 */

type Row = Pick<
  Database['public']['Tables']['gallery_images']['Row'],
  'id' | 'image_url' | 'storage_path' | 'tag' | 'alt_no' | 'alt_en' | 'caption_no' | 'caption_en' | 'contain'
>;

const COLUMNS = 'id, image_url, storage_path, tag, alt_no, alt_en, caption_no, caption_en, contain';

/** Anonym klient uten sesjon. RLS slipper bare gjennom publiserte bilder. */
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
  async (): Promise<Row[]> => {
    if (!supabaseConfigured) throw new Error('Supabase er ikke konfigurert.');

    const { data, error } = await anonClient()
      .from('gallery_images')
      .select(COLUMNS)
      .eq('published', true)
      .order('sort_order')
      .order('created_at', { ascending: false })
      // Bilder lastet opp samtidig har samme tidspunkt; id-en gir dem fast rekkefølge.
      .order('id')
      .limit(300);

    if (error) throw new Error(`Kunne ikke lese galleriet: ${error.message}`);
    return data ?? [];
  },
  ['gallery-images'],
  // Kaster vi, lagres ingenting – reserven blir altså aldri mellomlagret.
  { tags: [GALLERY_TAG], revalidate: 3600 },
);

/** Én lesing per forespørsel, også når flere deler av siden spør. */
const loadUploads = cache(async (): Promise<Row[]> => {
  // Uten Supabase er de faste bildene det forventede svaret, ikke en feil.
  if (!supabaseConfigured) {
    noteSupabaseMissing();
    return [];
  }
  try {
    return await cached();
  } catch (error) {
    console.error('[gallery] Viser bare de faste bildene:', error instanceof Error ? error.message : error);
    return [];
  }
});

const filled = (value: string | null | undefined) => (value && value.trim() ? value.trim() : '');

/** Engelsk tekst hvis den finnes, ellers norsk. */
const localized = (lang: Lang, no: string | null, en: string | null) =>
  (lang === 'en' && filled(en)) || filled(no);

/** En sti i bøtta: mapper og filnavn, uten «..» og uten skråstrek først. */
const STORAGE_PATH = /^[\w-][\w.-]*(\/[\w-][\w.-]*)*$/;

/** Supabase-adressen uten skråstrek til slutt, så adressene blir like uansett hvordan den er skrevet. */
const STORAGE_ORIGIN = SUPABASE_URL.replace(/\/+$/, '');

/**
 * Adressene next/image får hente fra. Må stemme med remotePatterns i
 * next.config.mjs: Supabase Storage, og lagringen i det lokale testmiljøet
 * (supabase/local) når vi ikke er i produksjon. Alt annet vises uoptimalisert.
 */
const SUPABASE_STORAGE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i;
const LOCAL_STORAGE =
  process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(STORAGE_ORIGIN)
    ? `${STORAGE_ORIGIN}/storage/v1/object/public/`
    : null;

const optimizable = (src: string) =>
  SUPABASE_STORAGE.test(src) || (LOCAL_STORAGE !== null && src.startsWith(LOCAL_STORAGE));

/**
 * Adressen et bilde vises fra, eller null når raden ikke peker på noe brukbart.
 *
 * Opplastede bilder bygges av stien i bøtta og Supabase-adressen miljøet
 * bruker. Da virker de likt i produksjon og i det lokale testmiljøet, som
 * går over http og derfor ikke kan stå i image_url (databasen godtar bare
 * https og stier som starter med «/»). Bilder uten sti i bøtta bruker
 * image_url: en https-adresse eller en fil i /public.
 */
export function galleryImageSrc(
  row: Pick<Row, 'image_url' | 'storage_path'>,
): { src: string; unoptimized: boolean } | null {
  const path = filled(row.storage_path);
  if (path && STORAGE_PATH.test(path) && STORAGE_ORIGIN) {
    const src = `${STORAGE_ORIGIN}/storage/v1/object/public/${BUCKETS.media}/${path}`;
    return { src, unoptimized: !optimizable(src) };
  }

  const url = filled(row.image_url);
  if (url.startsWith('/') && !url.startsWith('//') && !/\s/.test(url)) return { src: url, unoptimized: false };
  // Bare bilder i vår egen lagring. Adresser til andre nettsteder godtas ikke.
  if (STORAGE_ORIGIN && url.startsWith(`${STORAGE_ORIGIN}/storage/v1/object/public/`) && !/\s/.test(url)) {
    return { src: url, unoptimized: !optimizable(url) };
  }
  return null;
}

function fromRow(row: Row, lang: Lang): GalleryItem | null {
  const image = galleryImageSrc(row);
  if (!image || !isImageTag(row.tag)) return null;

  return {
    id: row.id,
    src: image.src,
    unoptimized: image.unoptimized,
    tag: row.tag,
    contain: row.contain,
    alt: localized(lang, row.alt_no, row.alt_en),
    label: localized(lang, row.caption_no, row.caption_en),
  };
}

/**
 * Alle bildene i galleriet på ett språk. Bildene fra admin kommer først, i
 * rekkefølgen som er satt der (lavest tall først, nyeste først ved likt tall),
 * og så de faste bildene.
 */
export async function getGalleryImages(lang: Lang): Promise<GalleryItem[]> {
  const rows = await loadUploads();
  const uploads = rows.flatMap((row) => fromRow(row, lang) ?? []);
  return [...uploads, ...fixedGalleryItems(getDict(lang))];
}
