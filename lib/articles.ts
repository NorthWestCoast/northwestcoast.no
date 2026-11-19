import type { Lang } from './i18n';

type Localized = Record<Lang, string>;

export interface Article {
  slug: string;
  date: string;
  image: string;
  tag: Localized;
  title: Localized;
  excerpt: Localized;
  /** Kortere tekst til nyhetskortet på forsiden (ikke det samme som ingressen). */
  teaser: Localized;
  /**
   * Ren tekst med et lite markdown-utvalg, likt innleggene fra admin:
   * blank linje = avsnitt, «## » = mellomtittel, «- » = punkt, **fet** og
   * [lenke](https://…). Tegnes av components/post-body.tsx.
   */
  body: Localized;
}

export interface LocalizedArticle {
  slug: string;
  date: string;
  image: string;
  tag: string;
  title: string;
  excerpt: string;
  teaser: string;
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

/**
 * Innleggene som fulgte med nettstedet. Nye innlegg skrives i admin og ligger
 * i databasen (se lib/posts.ts); et innlegg der med samme slug erstatter det
 * som står her.
 */
export const ARTICLES: Article[] = [
  {
    slug: 'ny-leiderkasse',
    date: '30.08.2026',
    image: '/images/leiderkasse.jpg',
    tag: {
      no: 'Nyheter',
      en: 'News',
    },
    title: {
      no: 'Ny leiderkasse på plass!',
      en: 'New ladder case in place!',
    },
    excerpt: {
      no: 'Vi har nylig fått inn en ny leiderkasse tilpasset leidere mellom 11 og 15 meter. Se eksempler fra den første installasjonen ombord på Geir.',
      en: 'We have just taken delivery of a new ladder case built for ladders between 11 and 15 metres. See examples from the first installation on board Geir.',
    },
    teaser: {
      no: 'Vi har nylig fått inn en ny leiderkasse tilpasset leidere mellom 11 og 15 meter. På bildene ser du eksempler fra båten Geir, der kassene allerede er tatt i bruk.',
      en: 'We have just taken delivery of a new ladder case built for ladders between 11 and 15 metres. In the pictures you can see examples from the vessel Geir, where the cases are already in use.',
    },
    body: {
      no: `Hos NorthWest Coast er vi alltid på jakt etter måter å forbedre bruksopplevelsen til kundene våre. Den seneste nyheten er at vi nå har fått på plass en ny generasjon leiderkasser – spesialtilpasset for leidere mellom 11 og 15 meter.

## Kompakt og holdbart design

Den nye kassen er konstruert av UV-bestandig polyetylen som tåler det tøffe maritime miljøet. Med et integrert låsesystem og gummipakninger sikrer den leideren mot salt, fukt og mekanisk slitasje under oppbevaring. Kassen monteres enkelt på dekk eller skott og krever minimalt med rekkeplass.

## Rask tilgang, trygg oppbevaring

En av de viktigste egenskapene er den raske tilgangen. Kassen kan åpnes og leideren klargjøres for bruk helt uten spesialverktøy.

## Installert ombord

De første kassene er allerede installert ombord skip, der mannskapet har gitt svært positive tilbakemeldinger.

Kassene er nå tilgjengelig for bestilling. Ta kontakt med oss for mer informasjon om priser og tilpasning til ditt fartøy.`,
      en: `At NorthWest Coast we are always looking for ways to improve the experience for our customers. The latest news is that we now have a new generation of ladder cases in place – purpose-built for ladders between 11 and 15 metres.

## Compact and durable design

The new case is built from UV-resistant polyethylene that stands up to the harsh maritime environment. With an integrated locking system and rubber gaskets, it protects the ladder against salt, moisture and mechanical wear during storage. The case mounts easily on deck or on a bulkhead and takes up minimal railing space.

## Fast access, safe storage

One of the most important features is quick access. The case can be opened and the ladder made ready for use entirely without special tools.

## Installed on board

The first cases are already installed on board vessels, where the crews have given very positive feedback.

The cases are now available to order. Get in touch for more information about pricing and adapting them to your vessel.`,
    },
  },
];

export function localizeArticle(article: Article, lang: Lang): LocalizedArticle {
  return {
    slug: article.slug,
    date: article.date,
    image: article.image,
    tag: article.tag[lang],
    title: article.title[lang],
    excerpt: article.excerpt[lang],
    teaser: article.teaser[lang],
    body: article.body[lang],
  };
}

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
