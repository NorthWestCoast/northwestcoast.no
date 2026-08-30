export interface Article {
  slug: string;
  tag: string;
  date: string;
  title: string;
  excerpt: string;
  image: string;
  body: string;
}

export const ARTICLES: Article[] = [
  {
    slug: 'ny-leiderkasse',
    tag: 'Nyheter',
    date: '30.08.2026',
    title: 'Ny leiderkasse på plass!',
    excerpt: 'Vi har nylig fått inn en ny leiderkasse tilpasset leidere mellom 11 og 15 meter. Se eksempler fra den første installasjonen ombord på Geir.',
    image: '/images/leiderkasse.jpg',
    body: `
      <p>Hos NorthWest Coast er vi alltid på jakt etter måter å forbedre bruksopplevelsen til kundene våre. Den seneste nyheten er at vi nå har fått på plass en ny generasjon leiderkasser – spesialtilpasset for leidere mellom 11 og 15 meter.</p>

      <h2>Kompakt og holdbart design</h2>
      <p>Den nye kassen er konstruert av UV-bestandig polyetylen som tåler det tøffe maritime miljøet. Med et integrert låsesystem og gummipakninger sikrer den leideren mot salt, fukt og mekanisk slitasje under oppbevaring. Kassen monteres enkelt på dekk eller skott og krever minimalt med rekkeplass.</p>

      <h2>Rask tilgang, trygg oppbevaring</h2>
      <p>En av de viktigste egenskapene er den raske tilgangen. Kassen kan åpnes og leideren klargjøres for bruk helt uten spesialverktøy.</p>

      <h2>Installert ombord</h2>
      <p>De første kassene er allerede installert ombord skip, der mannskapet har gitt svært positive tilbakemeldinger.</p>
      <p>Kassene er nå tilgjengelig for bestilling. Ta kontakt med oss for mer informasjon om priser og tilpasning til ditt fartøy.</p>
    `,
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
