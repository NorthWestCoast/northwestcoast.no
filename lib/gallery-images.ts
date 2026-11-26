import type { Dict } from './dictionaries/no';

export type ImageTag = 'ladder' | 'storage' | 'inUse' | 'references';
export type ImageKey = keyof Dict['gallery']['images'];

export type GalleryImage = {
  src: string;
  key: ImageKey;
  tag: ImageTag;
  /** Gjennomsiktig PNG: vises hel, på sandflaten. */
  contain?: boolean;
  /** Render med egen hvit bakgrunn: vises hel, på hvitt, så ingenting av leideren skjæres bort. */
  render?: boolean;
};

/**
 * Et bilde slik galleriet viser det: ferdig oversatt, uansett om det er et av
 * de faste bildene her eller ett som er lastet opp i admin (lib/gallery.ts).
 */
export type GalleryItem = {
  id: string;
  src: string;
  tag: ImageTag;
  /** Bildet vises helt i kortet i stedet for å fylle det. */
  contain: boolean;
  /** Fargen rundt et bilde som vises helt. Uten den: sandflaten (CONTAIN_BG). */
  backdrop?: string;
  alt: string;
  /** Bildeteksten nederst på bildet. Tom når bildet ikke har en. */
  label: string;
  /** Bildet ligger et sted next/image ikke henter fra, og vises som det er. */
  unoptimized?: boolean;
};

/**
 * De faste bildene. De ligger i koden og kan ikke endres i admin.
 * Bildedata er språknøytralt – alt-tekst og bildetekst hentes fra ordboken.
 */
export const GALLERY_IMAGES: GalleryImage[] = [
  { src: '/images/leider_in_use.jpg',            key: 'inUse',          tag: 'inUse' },
  { src: '/images/leider_m2.jpg',                key: 'mounted',        tag: 'inUse' },
  { src: '/images/praksis.jpg',                  key: 'practice',       tag: 'inUse' },
  // Renderene står først i fanen Leider, så det er dem forsiden viser.
  { src: '/images/argostep-utfelt.jpg',          key: 'renderDeployed', tag: 'ladder', render: true },
  { src: '/images/argostep-delvis-utfelt.jpg',   key: 'renderPartly',   tag: 'ladder', render: true },
  { src: '/images/argostep-foldet-opphengt.jpg', key: 'renderHanging',  tag: 'ladder', render: true },
  { src: '/images/argostep-foldet.jpg',          key: 'renderFolded',   tag: 'ladder', render: true },
  { src: '/images/argostep-trinn.jpg',           key: 'renderSteps',    tag: 'ladder', render: true },
  { src: '/images/ladder-full.png',              key: 'full',           tag: 'ladder', contain: true },
  { src: '/images/ladder-folded.png',            key: 'folded',         tag: 'ladder', contain: true },
  { src: '/images/leider_folded.jpg',            key: 'folded2',        tag: 'ladder' },
  { src: '/images/leider_cabinet.jpg',           key: 'cabinet',        tag: 'storage' },
  { src: '/images/leider_cabinet2.jpg',          key: 'cabinetOpen',    tag: 'storage' },
  { src: '/images/leiderkasse.jpg',              key: 'case1',          tag: 'storage' },
  { src: '/images/leiderkasse2.jpg',             key: 'case2',          tag: 'storage' },
  { src: '/images/leiderkasse3.jpg',             key: 'case3',          tag: 'storage' },
  { src: '/images/leiderkasse4.jpg',             key: 'case4',          tag: 'storage' },
  { src: '/images/leider_m1.jpg',                key: 'veidar',         tag: 'references' },
  { src: '/images/tindskjaer.jpg',               key: 'tindskjaer',     tag: 'references' },
  { src: '/images/ms-skar-senior.jpeg',          key: 'skar1',          tag: 'references' },
  { src: '/images/ms-skar-senior2.jpeg',         key: 'skar2',          tag: 'references' },
  { src: '/images/ms-skar-senior3.jpeg',         key: 'skar3',          tag: 'references' },
];

export const GALLERY_TABS: ImageTag[] = ['ladder', 'storage', 'inUse', 'references'];

export const isImageTag = (value: string): value is ImageTag => (GALLERY_TABS as string[]).includes(value);

/** Mappen i bøtta public-media som bildene fra admin lastes opp til. */
export const GALLERY_FOLDER = 'galleri';

/** De faste bildene med tekst på språket til ordboken. */
export function fixedGalleryItems(t: Dict): GalleryItem[] {
  return GALLERY_IMAGES.map((image) => ({
    id: `fast:${image.key}`,
    src: image.src,
    tag: image.tag,
    contain: image.contain === true || image.render === true,
    ...(image.render ? { backdrop: RENDER_BG } : {}),
    alt: t.gallery.images[image.key].alt,
    label: t.gallery.images[image.key].label,
  }));
}

/** Bakgrunn for bilder uten egen bakgrunn (PNG-er med gjennomsiktighet). */
export const CONTAIN_BG = 'var(--sand)';

/**
 * Bakgrunnen i renderene (public/images/argostep-*.jpg). Kantene i filene er
 * tonet til helt hvitt, så de kan vises hele på denne fargen uten skjøter.
 */
export const RENDER_BG = '#fff';

export function openLightbox(src: string, contain = false) {
  const lb = document.getElementById('lightbox') as HTMLElement | null;
  const img = document.getElementById('lb-img') as HTMLImageElement | null;
  if (lb && img) {
    img.src = src;
    // Uten dette mister de gjennomsiktige bildene sandbakgrunnen i fullskjerm.
    img.classList.toggle('lb-contain', contain);
    lb.classList.add('open');
  }
}
