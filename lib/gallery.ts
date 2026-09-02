/**
 * The gallery image manifest.
 *
 * Moved out of components/media-gallery.tsx because that is a client component:
 * values imported from a "use client" module into a server component arrive as
 * client references, not data, so the ImageGallery JSON-LD on /galleri could not
 * read the list. Plain data belongs in lib/.
 */

export type GalleryImage = {
  src: string;
  /** Descriptive alt text – also what image search and multimodal models index. */
  alt: string;
  /** Short caption rendered over the tile. */
  label: string;
  tag: 'I bruk' | 'Leider' | 'Oppbevaring' | 'Referanser';
  /** Product renders on transparent backgrounds are letterboxed rather than cropped. */
  contain?: boolean;
};

export const ALL_IMAGES: GalleryImage[] = [
  { src: '/images/leider_in_use.jpg',    alt: 'Leider i bruk',               label: 'Ombordstigning fra skutesiden',    tag: 'I bruk' },
  { src: '/images/leider_m2.jpg',        alt: 'Montert fartøy',               label: 'Montert på passasjerfartøy',     tag: 'I bruk' },
  { src: '/images/praksis.jpg',          alt: 'Livbåtleider i bruk',          label: 'Livbåtleider – testdykk',        tag: 'I bruk' },
  { src: '/images/ladder-full.png',      alt: 'Full utfelling',               label: 'Full Utfelling',                 tag: 'Leider', contain: true },
  { src: '/images/ladder-folded.png',    alt: 'Foldet',                       label: 'Ultrakompakt – Foldet',          tag: 'Leider', contain: true },
  { src: '/images/leider_folded.jpg',    alt: 'Leider foldet',                label: 'Kompakt sammenfoldet',           tag: 'Leider' },
  { src: '/images/leider_cabinet.jpg',   alt: 'Oppbevaringsskap',             label: 'Oppbevaringsskap',               tag: 'Oppbevaring' },
  { src: '/images/leider_cabinet2.jpg',  alt: 'Åpen kasse',                   label: 'Innvendig lagringsskap',         tag: 'Oppbevaring' },
  { src: '/images/leiderkasse.jpg',      alt: 'Kasse ombord',                 label: 'Kompakt oppbevaring ombord',     tag: 'Oppbevaring' },
  { src: '/images/leiderkasse2.jpg',     alt: 'Argostep kasse',               label: 'Argostep kasse på dekk',         tag: 'Oppbevaring' },
  { src: '/images/leiderkasse3.jpg',     alt: 'Kasse detalj',                 label: 'Kasse – detalj',                 tag: 'Oppbevaring' },
  { src: '/images/leiderkasse4.jpg',     alt: 'Kasse på kai',                 label: 'Klar for bruk ved kai',          tag: 'Oppbevaring' },
  { src: '/images/leider_m1.jpg',        alt: 'M/S Veidar',                   label: 'Plassert ombord M/S Veidar',     tag: 'Referanser' },
  { src: '/images/tindskjaer.jpg',       alt: 'M/S Tindskjær',               label: 'M/S Tindskjær',                 tag: 'Referanser' },
  { src: '/images/ms-skar-senior.jpeg',  alt: 'M/S Skår Senior',             label: 'M/S Skår Senior',               tag: 'Referanser' },
  { src: '/images/ms-skar-senior2.jpeg', alt: 'M/S Skår Senior installasjon', label: 'Argostep på M/S Skår Senior',   tag: 'Referanser' },
  { src: '/images/ms-skar-senior3.jpeg', alt: 'M/S Skår Senior detalj',      label: 'Detalj – M/S Skår Senior',      tag: 'Referanser' },
];
