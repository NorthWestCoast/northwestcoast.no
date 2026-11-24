import type { LocalizedArticle } from './articles';
import type { FaqEntry } from './faq';
import { getDict, LANGS, localePath, SITE_NAME, SITE_URL, type Lang } from './i18n';
import type { PriceTable } from './pricing';
import { CONFIRMED_SOCIAL_URLS, ORG } from './site';

/**
 * Strukturert data (JSON-LD) for søkemotorer og AI-assistenter. Alt her er
 * hentet fra det som allerede står på nettstedet: ordbøkene, prislista og
 * lib/site.ts. Ingen nye påstander.
 *
 * Bevisst utelatt, fordi nettstedet ikke gir grunnlag for det:
 * - Review/aggregateRating (kundeuttalelsene er ikke verifiserbare anmeldelser)
 * - availability og priceValidUntil på tilbudene (lagerstatus og gyldighet
 *   står ingen steder; prisene er veiledende og bekreftes etter kontakt)
 * - stiftelsesår, antall ansatte og lignende om selskapet
 *
 * Hver funksjon returnerer ETT objekt med `@context`. components/json-ld.tsx
 * skriver ett objekt per script-tagg (Safari tåler ikke lister).
 */
const abs = (path: string) => `${SITE_URL}${path}`;
const bcp47 = (lang: Lang) => (lang === 'no' ? 'nb-NO' : 'en');

export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;
const PRODUCT_ID = `${SITE_URL}/#argostep`;
const CABINET_ID = `${SITE_URL}/#oppbevaringsskap`;

/** Kvadratisk logo (512×512) fra scripts/generate-icons.mjs. */
const LOGO_PATH = '/icons/icon-512.png';

const orgNumber = ORG.orgNumber.replace(/\s/g, '');

export function organizationLd(lang: Lang = 'no') {
  const t = getDict(lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    legalName: ORG.legalName,
    // Navnet har vært skrevet i to ord på nettstedet og i omtaler.
    alternateName: ['NorthWest Coast', 'Northwestcoast', 'NWC'],
    description: t.footer.tagline,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      '@id': `${SITE_URL}/#logo`,
      url: abs(LOGO_PATH),
      contentUrl: abs(LOGO_PATH),
      width: 512,
      height: 512,
      caption: SITE_NAME,
    },
    image: abs(LOGO_PATH),
    telephone: ORG.phone,
    email: ORG.email,
    // Organisasjonsnummeret, også på ISO 6523-form (0192 = Enhetsregisteret).
    identifier: {
      '@type': 'PropertyValue',
      name: lang === 'no' ? 'Organisasjonsnummer' : 'Norwegian organisation number',
      value: orgNumber,
    },
    iso6523Code: `0192:${orgNumber}`,
    // Bare profiler selskapet selv har lagt inn (se CONFIRMED_SOCIAL_URLS).
    ...(CONFIRMED_SOCIAL_URLS.length > 0 ? { sameAs: CONFIRMED_SOCIAL_URLS } : {}),
    address: {
      '@type': 'PostalAddress',
      postOfficeBoxNumber: ORG.street.replace(/^Postboks\s+/i, ''),
      postalCode: ORG.postalCode,
      addressLocality: ORG.city,
      addressCountry: ORG.country,
    },
    founder: [
      { '@type': 'Person', name: 'Kristian B. Dyb' },
      { '@type': 'Person', name: 'Arve Toven' },
      { '@type': 'Person', name: 'Tor Arne Reitan' },
    ],
    brand: { '@type': 'Brand', name: 'Argostep' },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      telephone: ORG.phone,
      email: ORG.email,
      availableLanguage: ['nb', 'en'],
    },
  };
}

export function websiteLd(lang: Lang) {
  const t = getDict(lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    alternateName: ['Northwestcoast', 'NWC'],
    description: t.meta.home.description,
    inLanguage: LANGS.map(bcp47),
    publisher: { '@id': ORG_ID },
  };
}

/**
 * Leideren som produkt. Beskrivelsen og spesifikasjonene er de samme som
 * vises på /produkt og /3d-leider; prisene kommer fra prislista som sendes
 * inn (veiledende, eks. mva.). Lengder uten fast pris tas ikke med som tilbud.
 */
export function productLd(lang: Lang, table: PriceTable) {
  const t = getDict(lang);
  const priced = table.filter((r) => !r.onRequest);
  const prices = priced.map((r) => r.price);
  const orderUrl = abs(localePath(lang, '/bestill'));

  const specs = [...Object.values(t.product.specs), ...Object.values(t.viewerPage.specs)];

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': PRODUCT_ID,
    name: t.product.title,
    alternateName: t.products.ladder.title,
    description: t.product.answerBody,
    image: [abs('/images/ladder-full.png'), abs('/images/leider_in_use.jpg')],
    brand: { '@type': 'Brand', name: 'Argostep' },
    manufacturer: { '@id': ORG_ID },
    category: lang === 'no' ? 'Maritimt sikkerhetsutstyr > Leidere' : 'Marine safety equipment > Embarkation ladders',
    material: t.product.specs.material.val,
    additionalProperty: [
      ...specs.map(({ key, val }) => ({
        '@type': 'PropertyValue',
        name: key,
        value: val,
        // Godkjenningen gjelder norske fartøy under 15 meter: si det her også.
        ...(key === t.product.specs.approval.key ? { description: t.certs.cards.nma.sub } : {}),
      })),
      {
        '@type': 'PropertyValue',
        name: t.certs.vesselsLabel,
        value: Object.values(t.certs.vessels).join(', '),
      },
    ],
    url: abs(localePath(lang, '/produkt')),
    mainEntityOfPage: abs(localePath(lang, '/produkt')),
    ...(priced.length > 0
      ? {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'NOK',
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: priced.length,
            url: orderUrl,
            offers: priced.map((r) => ({
              '@type': 'Offer',
              name: r.productName,
              description: `${r.length} m, ${r.steps} ${t.order.steps}`,
              sku: r.productNumber,
              price: r.price,
              priceCurrency: 'NOK',
              priceSpecification: {
                '@type': 'UnitPriceSpecification',
                price: r.price,
                priceCurrency: 'NOK',
                valueAddedTaxIncluded: false,
              },
              url: orderUrl,
              seller: { '@id': ORG_ID },
            })),
          },
        }
      : {}),
  };
}

/** Strukturert data for spørsmålene som vises på siden (lib/faq.ts). */
export function faqLd(lang: Lang, items: FaqEntry[]) {
  const t = getDict(lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    name: t.faq.title,
    inLanguage: bcp47(lang),
    isPartOf: { '@id': SITE_ID },
    about: { '@id': PRODUCT_ID },
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

export function breadcrumbLd(lang: Lang, trail: { name: string; path: string }[]) {
  const all = [{ name: SITE_NAME, path: '/' }, ...trail];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: abs(localePath(lang, item.path)),
    })),
  };
}

/** Leiderkalkulatoren: et gratis verktøy i nettleseren, uten innlogging. */
export function calculatorLd(lang: Lang) {
  const t = getDict(lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t.calculator.label,
    description: t.meta.kalkulator.description,
    url: abs(localePath(lang, '/kalkulator')),
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    inLanguage: bcp47(lang),
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'NOK' },
    provider: { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
    about: { '@id': PRODUCT_ID },
  };
}

/** Om oss: peker på organisasjonen som allerede er beskrevet i organizationLd(). */
export function aboutLd(lang: Lang) {
  const t = getDict(lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `${t.about.navLabel} – ${SITE_NAME}`,
    description: t.meta.omOss.description,
    url: abs(localePath(lang, '/om-oss')),
    inLanguage: bcp47(lang),
    isPartOf: { '@id': SITE_ID },
    about: { '@id': ORG_ID },
    mainEntity: { '@id': ORG_ID },
  };
}

/**
 * Oppbevaringsskapene som eget produkt. Prisene kommer fra prislista; finnes
 * det ingen skap der, returneres null og markupen utelates.
 */
export function cabinetLd(lang: Lang, table: PriceTable) {
  const t = getDict(lang);
  const withCabinet = table.filter((r) => !r.onRequest && r.cabinetName);
  if (withCabinet.length === 0) return null;
  const prices = withCabinet.map((r) => r.cabinetPrice);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': CABINET_ID,
    name: `Argostep ${t.products.storage.title}`,
    description: t.products.storage.desc,
    image: [abs('/images/leider_cabinet.jpg'), abs('/images/leider_cabinet2.jpg')],
    brand: { '@type': 'Brand', name: 'Argostep' },
    // Ingen `manufacturer`: nettstedet sier ikke hvem som produserer skapene.
    isAccessoryOrSparePartFor: { '@id': PRODUCT_ID },
    url: abs(`${localePath(lang, '/produkter')}#oppbevaring`),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'NOK',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: new Set(withCabinet.map((r) => r.cabinetName)).size,
      url: abs(localePath(lang, '/bestill')),
      seller: { '@id': ORG_ID },
    },
  };
}

/** Produktoversikten som liste: leideren og (når den finnes i prislista) skapet. */
export function productListLd(lang: Lang, table: PriceTable) {
  const t = getDict(lang);
  const hasCabinet = table.some((r) => !r.onRequest && r.cabinetName);
  const items = [
    { name: t.product.title, url: abs(localePath(lang, '/produkt')) },
    ...(hasCabinet
      ? [{ name: `Argostep ${t.products.storage.title}`, url: abs(`${localePath(lang, '/produkter')}#oppbevaring`) }]
      : []),
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t.products.title,
    url: abs(localePath(lang, '/produkter')),
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

/** 3D-modellen på /3d-leider (samme fil som visningen laster). */
export function model3dLd(lang: Lang) {
  const t = getDict(lang);
  return {
    '@context': 'https://schema.org',
    '@type': '3DModel',
    name: t.viewer.modelAlt,
    description: t.meta.leider3d.description,
    url: abs(localePath(lang, '/3d-leider')),
    inLanguage: bcp47(lang),
    encoding: [
      {
        '@type': 'MediaObject',
        contentUrl: abs('/3d-models/leider-compressed-v2.glb'),
        encodingFormat: 'model/gltf-binary',
      },
    ],
    about: { '@id': PRODUCT_ID },
    isPartOf: { '@id': SITE_ID },
    creator: { '@id': ORG_ID },
  };
}

/** «30.08.2026» → «2026-08-30». Ukjent format gir undefined, og feltet utelates. */
function isoDate(date: string): string | undefined {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(date.trim());
  if (!match) return undefined;
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Full adresse til et bilde: opplastede bilder har det allerede, nettstedets egne ligger i /public. */
const absImage = (src: string) => (/^https?:\/\//i.test(src) ? src : abs(src));

/**
 * Strukturert data for ett innlegg (fra lib/posts.ts). `Article`, ikke
 * `NewsArticle`: dette er selskapets egne nyheter, ikke en nyhetsredaksjon.
 * Bildene er forsidebildet og bildene i lysbildeshowet; dateModified er
 * sist innlegget ble lagret i admin.
 */
export function articleLd(lang: Lang, a: LocalizedArticle) {
  const url = abs(localePath(lang, `/nyheter/${a.slug}`));
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.excerpt,
    image: [...new Set([a.image, ...a.images].map(absImage))].slice(0, 20),
    datePublished: a.publishedAt ?? isoDate(a.date),
    dateModified: a.modifiedAt ?? a.publishedAt ?? isoDate(a.date),
    articleSection: a.tag,
    inLanguage: bcp47(lang),
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isPartOf: { '@id': SITE_ID },
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
  };
}
