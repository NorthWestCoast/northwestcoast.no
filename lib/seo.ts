import type { LocalizedArticle } from './articles';
import { FAQ_ITEMS } from './faq-items';
import { getDict, localePath, SITE_URL, type Lang } from './i18n';
import type { PriceTable } from './pricing';
import { SOCIAL_URLS } from './site';

/**
 * Strukturert data (JSON-LD) for søkemotorer og AI-assistenter. Alt her er
 * hentet fra det som allerede står på nettstedet – ingen nye påstander.
 * Bevisst utelatt: Review-markup (kundeuttalelsene er ikke verifiserbare
 * anmeldelser).
 */
const abs = (path: string) => `${SITE_URL}${path}`;

export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'NorthWest Coast',
    legalName: 'Northwestcoast AS',
    url: SITE_URL,
    logo: abs('/images/logo/NY-logo.png'),
    telephone: '+4790407341',
    email: 'arve@astep.no',
    identifier: '998196159',
    sameAs: Object.values(SOCIAL_URLS),
    address: {
      '@type': 'PostalAddress',
      postOfficeBoxNumber: '79',
      postalCode: '6281',
      addressLocality: 'Søvik',
      addressCountry: 'NO',
    },
    founder: [
      { '@type': 'Person', name: 'Kristian B. Dyb' },
      { '@type': 'Person', name: 'Arve Toven' },
      { '@type': 'Person', name: 'Tor Arne Reitan' },
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      telephone: '+4790407341',
      email: 'arve@astep.no',
      availableLanguage: ['nb', 'en'],
    },
  };
}

export function websiteLd(lang: Lang) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: SITE_URL,
    name: 'NorthWest Coast',
    inLanguage: lang === 'no' ? 'nb-NO' : 'en',
    publisher: { '@id': ORG_ID },
  };
}

export function productLd(lang: Lang, table: PriceTable) {
  const t = getDict(lang);
  const priced = table.filter((r) => !r.onRequest);
  const prices = priced.map((r) => r.price);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${SITE_URL}/#argostep`,
    name: t.product.title,
    description: t.meta.produkt.description,
    image: [abs('/images/ladder-full.png'), abs('/images/leider_in_use.jpg')],
    brand: { '@type': 'Brand', name: 'Argostep' },
    manufacturer: { '@id': ORG_ID },
    category: 'Marine safety equipment > Embarkation ladders',
    material: lang === 'no' ? 'Glassfiberarmert plast' : 'Glass-fibre reinforced plastic',
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Standard', value: 'ISO 799-1:2019' },
      {
        '@type': 'PropertyValue',
        name: lang === 'no' ? 'Godkjenning' : 'Approval',
        value: lang === 'no' ? 'Sjøfartsdirektoratet' : 'Norwegian Maritime Authority',
      },
      { '@type': 'PropertyValue', name: lang === 'no' ? 'Lengder' : 'Lengths', value: '2–15 m' },
    ],
    url: abs(localePath(lang, '/produkt')),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'NOK',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: table.length,
      offers: priced.map((r) => ({
        '@type': 'Offer',
        name: r.productName,
        sku: r.productNumber,
        price: r.price,
        priceCurrency: 'NOK',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: r.price,
          priceCurrency: 'NOK',
          valueAddedTaxIncluded: false,
        },
        url: abs(localePath(lang, '/bestill')),
        seller: { '@id': ORG_ID },
      })),
    },
  };
}

export function faqLd(lang: Lang, limit?: number) {
  const t = getDict(lang);
  const items = limit ? FAQ_ITEMS.slice(0, limit) : FAQ_ITEMS;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: lang === 'no' ? 'nb-NO' : 'en',
    mainEntity: items.map(({ key }) => ({
      '@type': 'Question',
      name: t.faq.items[key].q,
      acceptedAnswer: { '@type': 'Answer', text: t.faq.items[key].a },
    })),
  };
}

export function breadcrumbLd(lang: Lang, trail: { name: string; path: string }[]) {
  const all = [{ name: 'NorthWest Coast', path: '/' }, ...trail];
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
    inLanguage: lang === 'no' ? 'nb-NO' : 'en',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'NOK' },
    provider: { '@id': ORG_ID },
  };
}

/** Om oss: peker på organisasjonen som allerede er beskrevet i organizationLd(). */
export function aboutLd(lang: Lang) {
  const t = getDict(lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: t.meta.omOss.title,
    description: t.meta.omOss.description,
    url: abs(localePath(lang, '/om-oss')),
    inLanguage: lang === 'no' ? 'nb-NO' : 'en',
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
    '@id': `${SITE_URL}/#oppbevaringsskap`,
    name: `Argostep ${t.products.storage.title}`,
    description: t.products.storage.desc,
    image: [abs('/images/leider_cabinet.jpg'), abs('/images/leider_cabinet2.jpg')],
    brand: { '@type': 'Brand', name: 'Argostep' },
    manufacturer: { '@id': ORG_ID },
    url: abs(`${localePath(lang, '/produkter')}#oppbevaring`),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'NOK',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: new Set(withCabinet.map((r) => r.cabinetName)).size,
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
    inLanguage: lang === 'no' ? 'nb-NO' : 'en',
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
    inLanguage: lang === 'no' ? 'nb-NO' : 'en',
    encoding: [
      {
        '@type': 'MediaObject',
        contentUrl: abs('/3d-models/leider-compressed-v2.glb'),
        encodingFormat: 'model/gltf-binary',
      },
    ],
    isPartOf: { '@id': SITE_ID },
    creator: { '@id': ORG_ID },
  };
}

/** Strukturert data for ett innlegg (fra lib/posts.ts). */
export function articleLd(lang: Lang, a: LocalizedArticle) {
  const [d, m, y] = a.date.split('.');
  const iso = y && m && d ? `${y}-${m}-${d}` : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.excerpt,
    // Forsidebilder fra admin er fulle adresser; de faste ligger i /public.
    image: /^https?:\/\//i.test(a.image) ? a.image : abs(a.image),
    datePublished: iso,
    dateModified: iso,
    inLanguage: lang === 'no' ? 'nb-NO' : 'en',
    mainEntityOfPage: abs(localePath(lang, `/nyheter/${a.slug}`)),
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
  };
}
