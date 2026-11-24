/**
 * Et innlegg slik nettsiden viser det, på ett språk. Innleggene skrives i
 * admin og ligger i posts-tabellen (se lib/posts.ts).
 */
export interface LocalizedArticle {
  slug: string;
  date: string;
  image: string;
  tag: string;
  title: string;
  excerpt: string;
  teaser: string;
  /** Publiseringstidspunktet (ISO), til strukturert data og sitemap. */
  publishedAt: string | null;
  /** Sist lagret i admin (ISO). Aldri før publiseringen. */
  modifiedAt: string | null;
  /** Bildene i bildeblokkene på dette språket, i rekkefølge (adresser fra resolveImage). */
  images: string[];
  /**
   * Ren tekst med et lite markdown-utvalg: blank linje = avsnitt, «## » =
   * mellomtittel, «- » = punkt, **fet** og [lenke](https://…). Tegnes av
   * components/post-body.tsx.
   */
  body: string;
}

/** Bildet et innlegg får når det ikke har et eget forsidebilde. */
export const DEFAULT_ARTICLE_IMAGE = '/images/leider_in_use.jpg';

/**
 * Kan bildet gå gjennom next/image sin optimalisering? Det gjelder filer i
 * /public og bilder i Supabase-lagringen (se images.remotePatterns i
 * next.config.mjs). Andre adresser vises som de er, med `unoptimized`.
 */
export const canOptimizeImage = (src: string) =>
  src.startsWith('/') || /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(src);
