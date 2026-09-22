/**
 * Kanonisk nettadresse. Brukes av metadataBase, sitemap, robots og JSON-LD.
 * På Vercel settes NEXT_PUBLIC_SITE_URL til produksjonsdomenet; VERCEL_URL
 * gir riktig adresse i previews slik at OG-bilder også virker der.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://northwestcoast.no')
).replace(/\/$/, '');

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
