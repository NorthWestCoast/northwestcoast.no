import { createClient } from '@/lib/supabase/client';
import { compressImage, hasTransparency, imageSize } from '@/lib/images';
import { LIBRARY_COLUMNS, LIBRARY_FOLDER, type LibraryImage } from '@/lib/media-library';
import { BUCKETS } from '@/lib/portal/storage';

/** Bildetypene som kan lastes opp til nyheter og produkter, med filendelsen de lagres med. */
export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** Samme grense som bøtta public-media har (file_size_limit). Gjelder etter krympingen. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Større filer enn dette prøver vi ikke engang å krympe. */
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

export type UploadedImage = {
  path: string;
  url: string;
  /** Raden i biblioteket, når bildet ble lagt der. */
  library: LibraryImage | null;
};

/** Sjekker et bilde før opplasting. Gir feilmeldingen, eller null når bildet kan lastes opp. */
export function imageProblem(file: File): string | null {
  if (!IMAGE_TYPES[file.type]) return `«${file.name}» må være JPG, PNG, WebP eller AVIF.`;
  if (file.size > MAX_SOURCE_BYTES) return `«${file.name}» er for stor (over 40 MB).`;
  return null;
}

/**
 * Krymper bilder fra kamera og telefon til høyst 1600 piksler (lib/images.ts).
 * Bilder med gjennomsiktig bakgrunn lastes opp som de er: krympingen lager
 * JPEG, og da ville bakgrunnen blitt svart.
 */
async function prepare(file: File): Promise<File> {
  if (await hasTransparency(file)) return file;
  return compressImage(file);
}

/**
 * Laster opp et bilde fra nettleseren til den offentlige bøtta (lagrings-
 * policyen slipper bare administratorer og media til). Gir stien i bøtta
 * («bibliotek/<id>.jpg») og den offentlige adressen.
 *
 * Bilder i bibliotekmappen føres også inn i bildebiblioteket, med
 * beskrivelsene i `alt` når de er kjent. Klarer vi ikke det, kan bildet
 * likevel brukes; det står bare ikke i lista.
 */
export async function uploadPublicImage(
  original: File,
  folder: string = LIBRARY_FOLDER,
  alt: { no?: string; en?: string } = {},
): Promise<UploadedImage> {
  const problem = imageProblem(original);
  if (problem) throw new Error(problem);

  const file = await prepare(original);
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`«${original.name}» er større enn 8 MB, også etter krymping.`);
  const type = IMAGE_TYPES[file.type] ? file.type : original.type;
  const size = await imageSize(file);

  const supabase = createClient();
  const path = `${folder}/${crypto.randomUUID()}.${IMAGE_TYPES[type]}`;
  const { error } = await supabase.storage
    .from(BUCKETS.media)
    .upload(path, file, { contentType: type, upsert: false, cacheControl: '31536000' });

  if (error) {
    console.error('[media]', error.message);
    throw new Error(`«${original.name}» ble ikke lastet opp. Prøv igjen.`);
  }
  const url = supabase.storage.from(BUCKETS.media).getPublicUrl(path).data.publicUrl;

  let library: LibraryImage | null = null;
  if (folder === LIBRARY_FOLDER) {
    const { data, error: libraryError } = await supabase
      .from('media_library')
      .insert({
        storage_path: path,
        file_name: original.name.slice(0, 200),
        alt_no: alt.no?.trim().slice(0, 300) || null,
        alt_en: alt.en?.trim().slice(0, 300) || null,
        width: size?.width ?? null,
        height: size?.height ?? null,
        bytes: file.size,
      })
      .select(LIBRARY_COLUMNS)
      .single();
    if (libraryError) console.error('[bibliotek]', libraryError.message);
    library = data ?? null;
  }

  return { path, url, library };
}

/** Bildene i biblioteket, nyeste først. Leses med brukerens egen sesjon (RLS: administrator og media). */
export async function fetchLibrary(limit = 1000): Promise<LibraryImage[]> {
  const { data, error } = await createClient()
    .from('media_library')
    .select(LIBRARY_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('Biblioteket kunne ikke leses. Prøv igjen.');
  return data ?? [];
}

/** Offentlig adresse til et bilde i public-media. */
export function libraryUrl(path: string): string {
  return createClient().storage.from(BUCKETS.media).getPublicUrl(path).data.publicUrl;
}

/**
 * Setter verdien i et felt i et skjema som ikke styres av React (defaultValue),
 * og sier fra med et input-event så forhåndsvisning og bildelister oppdateres.
 */
export function setFieldValue(form: HTMLFormElement, name: string, value: string) {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Verdien i et felt i skjemaet, eller tom tekst. */
export function fieldValue(form: HTMLFormElement | null | undefined, name: string): string {
  const field = form?.elements.namedItem(name);
  return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement
    ? field.value
    : '';
}

/** Hendelsen MediaUpload lytter på for å få et nytt bilde utenfra (.md-importen). */
export const SET_MEDIA_EVENT = 'nwc:set-media';
export type SetMediaDetail = { name: string; url: string };
