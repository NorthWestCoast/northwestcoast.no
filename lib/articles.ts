import type { Lang } from './i18n';

type Localized = Record<Lang, string>;

export interface Article {
  slug: string;
  date: string;
  image: string;
  tag: Localized;
  title: Localized;
  excerpt: Localized;
  body: Localized;
}

export interface LocalizedArticle {
  slug: string;
  date: string;
  image: string;
  tag: string;
  title: string;
  excerpt: string;
  body: string;
}

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
    body: {
      no: `
      <p>Hos NorthWest Coast er vi alltid på jakt etter måter å forbedre bruksopplevelsen til kundene våre. Den seneste nyheten er at vi nå har fått på plass en ny generasjon leiderkasser – spesialtilpasset for leidere mellom 11 og 15 meter.</p>

      <h2>Kompakt og holdbart design</h2>
      <p>Den nye kassen er konstruert av UV-bestandig polyetylen som tåler det tøffe maritime miljøet. Med et integrert låsesystem og gummipakninger sikrer den leideren mot salt, fukt og mekanisk slitasje under oppbevaring. Kassen monteres enkelt på dekk eller skott og krever minimalt med rekkeplass.</p>

      <h2>Rask tilgang, trygg oppbevaring</h2>
      <p>En av de viktigste egenskapene er den raske tilgangen. Kassen kan åpnes og leideren klargjøres for bruk helt uten spesialverktøy.</p>

      <h2>Installert ombord</h2>
      <p>De første kassene er allerede installert ombord skip, der mannskapet har gitt svært positive tilbakemeldinger.</p>
      <p>Kassene er nå tilgjengelig for bestilling. Ta kontakt med oss for mer informasjon om priser og tilpasning til ditt fartøy.</p>
    `,
      en: `
      <p>At NorthWest Coast we are always looking for ways to improve the experience for our customers. The latest news is that we now have a new generation of ladder cases in place – purpose-built for ladders between 11 and 15 metres.</p>

      <h2>Compact and durable design</h2>
      <p>The new case is built from UV-resistant polyethylene that stands up to the harsh maritime environment. With an integrated locking system and rubber gaskets, it protects the ladder against salt, moisture and mechanical wear during storage. The case mounts easily on deck or on a bulkhead and takes up minimal railing space.</p>

      <h2>Fast access, safe storage</h2>
      <p>One of the most important features is quick access. The case can be opened and the ladder made ready for use entirely without special tools.</p>

      <h2>Installed on board</h2>
      <p>The first cases are already installed on board vessels, where the crews have given very positive feedback.</p>
      <p>The cases are now available to order. Get in touch for more information about pricing and adapting them to your vessel.</p>
    `,
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
    body: article.body[lang],
  };
}

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
