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
    date: '15. februar 2024',
    title: 'Ny leiderkasse på plass!',
    excerpt: 'Vi har nylig fått inn en ny leiderkasse tilpasset leidere mellom 11 og 15 meter. Se eksempler fra den første installasjonen ombord på M/B Geir.',
    image: '/images/leiderkasse.jpg',
    body: `
      <p>Hos NorthWest Coast er vi alltid på jakt etter måter å forbedre bruksopplevelsen til kundene våre. Den seneste nyheten er at vi nå har fått på plass en ny generasjon leiderkasser – spesialtilpasset for leidere mellom 11 og 15 meter.</p>

      <h2>Kompakt og holdbar design</h2>
      <p>Den nye kassen er konstruert av UV-bestandig polyetylen som tåler det tøffe maritime miljøet. Med et integrert låsesystem og gummipakninger sikrer den leideren mot salt, fukt og mekanisk slitasje under oppbevaring. Kassen monteres enkelt på rekke eller skott og krever minimalt med dekksplass.</p>

      <h2>Rask tilgang, trygg oppbevaring</h2>
      <p>En av de viktigste egenskapene er den raske tilgangen. Kassen kan åpnes og leideren klargjøres for bruk på under 30 sekunder – uten spesialverktøy. Dette er spesielt viktig ved utrykning og i krevende situasjoner, der hvert sekund teller.</p>

      <h2>Installert ombord på M/B Geir</h2>
      <p>De første kassene er allerede installert ombord på M/B Geir, der mannskapet har gitt svært positive tilbakemeldinger. «Enkelt å bruke, og leideren er alltid i perfekt stand» er kommentaren fra kaptein Olav Moen, som har operert langs kysten i over 20 år.</p>
      <p>Kassene er nå tilgjengelig for bestilling. Ta kontakt med oss for mer informasjon om priser og tilpasning til ditt fartøy.</p>
    `,
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
