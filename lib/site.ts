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
  // E.164 for tel:-lenker og JSON-LD; lesbar variant for dokumenter.
  phone: '+4790407341',
  phoneDisplay: '+47 904 07 341',
  email: 'arve@astep.no',
  street: 'Postboks 79',
  postalCode: '6281',
  city: 'Søvik',
  country: 'NO',
} as const;

/**
 * Fargen nettleseren får på adresselinja (themeColor) og manifestets
 * bakgrunn. Samme marineblå som toppen av sidene (--navy i globals.css).
 */
export const THEME_COLOR = '#0a1628';

/**
 * Profilene selskapet selv har lagt inn som miljøvariabler. En tom verdi
 * (slik .env.example står) regnes som ikke satt.
 */
const SOCIAL_ENV = {
  facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || undefined,
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || undefined,
  linkedin: process.env.NEXT_PUBLIC_LINKEDIN_URL || undefined,
};

/** Offisielle profiler (hentet fra dagens live-nettsted). Env kan overstyre. */
export const SOCIAL_URLS = {
  facebook: SOCIAL_ENV.facebook ?? 'https://www.facebook.com/northwestcoastas',
  instagram: SOCIAL_ENV.instagram ?? 'https://www.instagram.com/northwestcoastas/',
  linkedin: SOCIAL_ENV.linkedin ?? 'https://www.linkedin.com/company/northwestcoast-as/',
} as const;

/**
 * Profilene som er bekreftet gjennom miljøvariabler, til `sameAs` i de
 * strukturerte dataene. Der sier vi til søkemotorene at profilen ER
 * selskapet, så standardadressene over (som bare er lenker i bunnteksten)
 * tas ikke med før de er lagt inn eksplisitt.
 */
export const CONFIRMED_SOCIAL_URLS: string[] = Object.values(SOCIAL_ENV).filter(
  (url): url is string => typeof url === 'string' && /^https:\/\//i.test(url),
);

/** Delingsbildet som genereres av app/og/[lang]/route.tsx. */
const OG_IMAGE = {
  url: '/og/no',
  width: 1200,
  height: 630,
  alt: 'Argostep – modulær leider til båt fra NorthWest Coast',
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
