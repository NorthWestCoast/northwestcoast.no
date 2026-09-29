import type { Dict } from './dictionaries/no';

export type ImageTag = 'ladder' | 'storage' | 'inUse' | 'references';
export type ImageKey = keyof Dict['gallery']['images'];

export type GalleryImage = {
  src: string;
  key: ImageKey;
  tag: ImageTag;
  contain?: boolean;
};

/** Bildedata er språknøytralt – alt-tekst og bildetekst hentes fra ordboken. */
export const GALLERY_IMAGES: GalleryImage[] = [
  { src: '/images/leider_in_use.jpg',    key: 'inUse',       tag: 'inUse' },
  { src: '/images/leider_m2.jpg',        key: 'mounted',     tag: 'inUse' },
  { src: '/images/praksis.jpg',          key: 'practice',    tag: 'inUse' },
  { src: '/images/ladder-full.png',      key: 'full',        tag: 'ladder', contain: true },
  { src: '/images/ladder-folded.png',    key: 'folded',      tag: 'ladder', contain: true },
  { src: '/images/leider_folded.jpg',    key: 'folded2',     tag: 'ladder' },
  { src: '/images/leider_cabinet.jpg',   key: 'cabinet',     tag: 'storage' },
  { src: '/images/leider_cabinet2.jpg',  key: 'cabinetOpen', tag: 'storage' },
  { src: '/images/leiderkasse.jpg',      key: 'case1',       tag: 'storage' },
  { src: '/images/leiderkasse2.jpg',     key: 'case2',       tag: 'storage' },
  { src: '/images/leiderkasse3.jpg',     key: 'case3',       tag: 'storage' },
  { src: '/images/leiderkasse4.jpg',     key: 'case4',       tag: 'storage' },
  { src: '/images/leider_m1.jpg',        key: 'veidar',      tag: 'references' },
  { src: '/images/tindskjaer.jpg',       key: 'tindskjaer',  tag: 'references' },
  { src: '/images/ms-skar-senior.jpeg',  key: 'skar1',       tag: 'references' },
  { src: '/images/ms-skar-senior2.jpeg', key: 'skar2',       tag: 'references' },
  { src: '/images/ms-skar-senior3.jpeg', key: 'skar3',       tag: 'references' },
];

export const GALLERY_TABS: ImageTag[] = ['ladder', 'storage', 'inUse', 'references'];

/** Bakgrunn for bilder uten egen bakgrunn (PNG-er med gjennomsiktighet). */
export const CONTAIN_BG = 'var(--sand)';

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
