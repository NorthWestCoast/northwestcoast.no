/**
 * Bildebiblioteket: felles bilder til nyhetene (tabellen media_library).
 *
 * Filene ligger i bøtta public-media, i mappen bibliotek/. Bilder som ble
 * lastet opp før biblioteket fantes, ligger i posts/ og står også i lista.
 * Innleggene viser til stien («bibliotek/<id>.jpg»), så samme bilde kan brukes
 * i flere innlegg. Denne fila brukes både på serveren og i nettleseren.
 */

/** Mappen nye bilder lastes opp til. */
export const LIBRARY_FOLDER = 'bibliotek';

/** Samme regel som i tabellen (media_library.storage_path). */
export const LIBRARY_PATH = /^(bibliotek|posts)\/[A-Za-z0-9][A-Za-z0-9_-]*\.(jpg|jpeg|png|webp|avif)$/;

/** Kolonnene lista, velgeren og bibliotekssiden trenger. */
export const LIBRARY_COLUMNS = 'id, storage_path, file_name, alt_no, alt_en, width, height, bytes, created_at';

export type LibraryImage = {
  id: string;
  storage_path: string;
  file_name: string | null;
  alt_no: string | null;
  alt_en: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  created_at: string;
};

/** Så mange bilder hentes. Søket i velgeren og på siden går i denne lista. */
export const LIBRARY_LIMIT = 1000;

/** Bredden Google og delingstjenestene vil ha på et forsidebilde. */
export const COVER_MIN_WIDTH = 1200;

/** Et innlegg som bruker et bilde. */
export type PostUse = { id: string; title: string };

type PostText = {
  id: string;
  title_no: string;
  body_no: string | null;
  body_en: string | null;
  cover_image_url: string | null;
};

/**
 * Hvilke innlegg som bruker hvert bilde: i en bildeblokk på et av språkene
 * eller som forsidebilde. Teksten viser til stien eller til hele adressen,
 * og begge inneholder stien.
 */
export function usageByPath(posts: PostText[], paths: string[]): Map<string, PostUse[]> {
  const result = new Map<string, PostUse[]>();
  for (const path of paths) {
    const users = posts
      .filter((post) => [post.body_no, post.body_en, post.cover_image_url].some((value) => value?.includes(path)))
      .map((post) => ({ id: post.id, title: post.title_no }));
    if (users.length) result.set(path, users);
  }
  return result;
}

/** «1,2 MB» / «640 kB». */
export function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} MB`;
}

/** Søket i biblioteket: beskrivelsene og filnavnet, uten hensyn til store og små bokstaver. */
export function matchesSearch(image: LibraryImage, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = [image.alt_no, image.alt_en, image.file_name].filter(Boolean).join(' ').toLowerCase();
  return words.every((word) => haystack.includes(word));
}
