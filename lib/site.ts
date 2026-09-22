/**
 * Kanonisk nettadresse. Brukes av metadataBase, sitemap, robots og JSON-LD.
 *
 * Rekkefølgen har betydning for SEO. VERCEL_URL er DEPLOY-spesifikk
 * (northwestcoast-bnsl9e85a-…vercel.app) – brukes den i produksjon, peker
 * canonical-lenker og sitemap på en URL som byttes ut ved neste deploy.
 * VERCEL_PROJECT_PRODUCTION_URL er derimot det stabile produksjonsdomenet.
 *
 * I previews vil vi motsatt ha den deploy-spesifikke URL-en, så OG-bilder og
 * lenker peker på nettopp den previewen man ser på.
 *
 * Alle som importerer denne modulen kjører på serveren, så VERCEL_ENV og
 * VERCEL_PROJECT_PRODUCTION_URL (uten NEXT_PUBLIC_-prefiks) er tilgjengelige.
 */
function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;

  if (
    process.env.VERCEL_ENV === 'production' &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return 'https://northwestcoast.no';
}

export const SITE_URL = resolveSiteUrl().replace(/\/$/, '');

export const ORG = {
  name: 'Northwestcoast AS',
  legalName: 'Northwestcoast AS',
  orgNumber: '998 196 159',
  phone: '+4790407341',
  email: 'arve@astep.no',
  street: 'Postboks 79',
  postalCode: '6281',
  city: 'Søvik',
  country: 'NO',
} as const;

/** Delingsbildet som genereres av app/opengraph-image.tsx. */
const OG_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'Argostep – modulær maritim leider fra NorthWest Coast',
};

/**
 * Bygger metadata for en underside. Uten dette arver undersidene forsidens
 * og:title og og:url, slik at en delt /produkt-lenke ser ut som forsiden.
 *
 * Bildet må settes eksplisitt: når en side definerer sitt eget openGraph-objekt
 * erstatter det rotas i sin helhet, og fil-konvensjonens bilde forsvinner.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | NorthWest Coast`,
      description,
      url: path,
      siteName: 'NorthWest Coast',
      locale: 'nb_NO',
      type: 'website' as const,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: `${title} | NorthWest Coast`,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
