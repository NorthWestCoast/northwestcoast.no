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

/**
 * Selskapets nettadresse slik kundene kjenner den, uansett hvor nettstedet
 * kjører. Står i bunnteksten på e-postene og i linja om hvorfor mottakeren
 * får dem. SITE_URL er der nettstedet faktisk svarer (vercel.app fram til
 * lanseringen, og en annen adresse i forhåndsvisninger og lokalt), og brukes
 * til lenker og bilder som må virke.
 */
export const PUBLIC_SITE_URL = 'https://northwestcoast.no';

/**
 * Adressen til den innloggede delen: Min side, Admin, Produksjon,
 * innloggingen, delte rapporter (/los) og sertifikater (/sertifikat).
 *
 * Med NEXT_PUBLIC_PORTAL_URL satt (https://portal.northwestcoast.no) ligger
 * den på sitt eget vertsnavn, så innloggingen ikke deler opprinnelse med det
 * offentlige nettstedet. Uten variabelen ligger alt på samme adresse, som i
 * lokal utvikling og i forhåndsvisninger. Vertsreglene står i next.config.mjs.
 */
export const PORTAL_URL = (process.env.NEXT_PUBLIC_PORTAL_URL || SITE_URL).replace(/\/$/, '');

function hostnameOf(url: string | undefined): string | null {
  try {
    return new URL(url ?? '').hostname;
  } catch {
    return null;
  }
}

const SITE_HOSTNAME = hostnameOf(process.env.NEXT_PUBLIC_SITE_URL);
const PORTAL_HOSTNAME = hostnameOf(process.env.NEXT_PUBLIC_PORTAL_URL);

/**
 * Sant når portalen ligger på sitt eget vertsnavn: begge adressene er satt,
 * og vertsnavnene er ulike. Samme vilkår som portalHosts() i
 * next.config.mjs, som setter opp videresendingene mellom de to.
 *
 * Bare NEXT_PUBLIC_-variablene leses her, ikke SITE_URL: i nettleseren
 * finnes ikke VERCEL_*, så SITE_URL kan være en annen der enn på serveren.
 * Lenkene under brukes i klientkomponenter og må bli like begge steder.
 */
export const PORTAL_HAS_OWN_HOST = Boolean(
  SITE_HOSTNAME && PORTAL_HOSTNAME && SITE_HOSTNAME !== PORTAL_HOSTNAME,
);

/**
 * Sider i portaldelen (app/(portal)), som kan vises på portalens vertsnavn.
 * Områdene følger PORTAL_AREAS i next.config.mjs. /personvern er med fordi
 * den svarer på begge vertsnavnene.
 */
const PORTAL_PAGE = /^\/(minside|admin|produksjon|logg-inn|auth|los|sertifikat|personvern)(\/|$)/;

export function isPortalPage(pathname: string): boolean {
  return PORTAL_PAGE.test(pathname);
}

/**
 * Lenke fra en offentlig side inn i portalen, f.eks. portalHref('/logg-inn').
 * Med portalen på eget vertsnavn går den rett dit, så besøkende slipper
 * hoppet via videresendingen. Ellers er den en vanlig relativ lenke.
 */
export function portalHref(path: string): string {
  return PORTAL_HAS_OWN_HOST ? `${PORTAL_URL}${path}` : path;
}

/**
 * Lenke fra en side i portaldelen til en offentlig side. På portalens
 * vertsnavn finnes ikke de offentlige sidene, og «/» er Min side, så lenken
 * må ha nettstedets adresse. Ellers er den en vanlig relativ lenke.
 */
export function siteHref(path: string): string {
  return PORTAL_HAS_OWN_HOST ? `${SITE_URL}${path}` : path;
}

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
 * Hvor lenge lenken og koden i en innloggings-e-post virker, i minutter.
 * Tekstene i e-postene og på innloggingssiden bruker tallet. Selve grensen
 * settes i Supabase (Authentication → Sign In / Providers → Email → «Email
 * OTP Expiration», i sekunder) og må endres samtidig.
 */
export const LOGIN_VALID_MINUTES = 10;

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

/**
 * Delingsbildet som genereres av app/og/[lang]/route.tsx. Med hele adressen:
 * sidene som bruker det ligger i portaldelen, og bildet lages på nettstedet.
 */
const OG_IMAGE = {
  url: `${SITE_URL}/og/no`,
  width: 1200,
  height: 630,
  alt: 'Argostep – modulær leider til båt fra NorthWestCoast',
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
      title: `${title} | NorthWestCoast`,
      description,
      url: path,
      siteName: 'NorthWestCoast',
      locale: 'nb_NO',
      type: 'website' as const,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: `${title} | NorthWestCoast`,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
