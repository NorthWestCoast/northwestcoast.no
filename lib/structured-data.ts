/**
 * schema.org / JSON-LD builders.
 *
 * Why this file matters more than usual here: classic SEO ranks pages, but
 * generative answer engines (ChatGPT Search, Perplexity, Google AI Overviews,
 * Claude) extract *entities and facts*. Explicit JSON-LD is the cheapest way to
 * hand them unambiguous facts — who the manufacturer is, what the product is
 * made of, which standard it is certified to, what it costs at each length —
 * instead of hoping they parse it out of prose.
 *
 * Everything is emitted as one @graph per page with stable @id values, so the
 * Organization defined on the front page is the same node the Product, the
 * Article and the tool page point back to rather than three unrelated copies.
 */

import { SITE, SITE_URL, abs } from './site';
import { PRICE_TABLE, PRICE_MIN, PRICE_MAX, CURRENCY } from './products';
import type { Article } from './articles';

/* ── Stable entity ids ── */
export const ORG_ID = abs('/#organization');
export const WEBSITE_ID = abs('/#website');
export const PRODUCT_ID = abs('/produkt#argostep');

type Node = Record<string, unknown>;

/** Wraps nodes in a single @graph document. */
export const graph = (nodes: Node[]) => ({
  '@context': 'https://schema.org',
  '@graph': nodes,
});

/* ── Core entities ── */

export function organizationNode(): Node {
  return {
    '@type': ['Organization', 'Manufacturer'],
    '@id': ORG_ID,
    name: SITE.name,
    legalName: SITE.legalName,
    alternateName: ['Northwestcoast', 'NorthWest Coast AS'],
    url: SITE_URL,
    description: SITE.description,
    // The organisation number is the strongest disambiguating identifier a
    // Norwegian company has — it ties the site to Brønnøysund/Proff/1881 data.
    identifier: SITE.orgNumber,
    vatID: `NO${SITE.orgNumber.replace(/\s/g, '')}MVA`,
    taxID: SITE.orgNumber.replace(/\s/g, ''),
    logo: {
      '@type': 'ImageObject',
      url: abs('/images/logo/NY-logo.png'),
      width: 140,
      height: 42,
    },
    image: abs(SITE.ogImage),
    telephone: SITE.phone,
    email: SITE.email,
    address: {
      '@type': 'PostalAddress',
      postOfficeBoxNumber: SITE.address.poBox.replace(/^Postboks\s*/i, ''),
      postalCode: SITE.address.postalCode,
      addressLocality: SITE.address.city,
      addressRegion: SITE.address.region,
      addressCountry: SITE.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: SITE.geo.lat,
      longitude: SITE.geo.lng,
    },
    areaServed: { '@type': 'Country', name: 'Norge' },
    knowsLanguage: ['nb', 'en'],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        telephone: SITE.phone,
        email: SITE.email,
        areaServed: 'NO',
        availableLanguage: ['Norwegian', 'English'],
      },
    ],
    sameAs: SITE.sameAs,
  };
}

export function websiteNode(): Node {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: SITE.name,
    description: SITE.description,
    inLanguage: 'nb-NO',
    publisher: { '@id': ORG_ID },
  };
}

/**
 * Every page gets a WebPage node so answer engines can tell which URL a fact
 * came from, and so breadcrumbs attach to something.
 */
export function webPageNode({
  path,
  name,
  description,
  type = 'WebPage',
}: {
  path: string;
  name: string;
  description: string;
  type?: string;
}): Node {
  return {
    '@type': type,
    '@id': `${abs(path)}#webpage`,
    url: abs(path),
    name,
    description,
    inLanguage: 'nb-NO',
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
  };
}

/* ── Product ── */

/**
 * Argostep as a ProductGroup with one Product variant per standard length.
 *
 * A ProductGroup (rather than 13 loose Products) tells Google these are the
 * same product in different sizes, which is exactly the question a buyer asks
 * an AI assistant: "how much is a 9 metre Argostep?" The offers carry
 * priceValidUntil and a seller reference so the price is quotable with a date.
 */
export function productNode(): Node {
  const priceValidUntil = `${new Date().getUTCFullYear() + 1}-12-31`;

  return {
    '@type': 'ProductGroup',
    '@id': PRODUCT_ID,
    name: 'Argostep Livbåtleider',
    alternateName: ['Argostep maritim leider', 'Argostep entringsleider'],
    description:
      'Modulær maritim leider i glassfiberarmert plast for ombordstigning og evakuering. Leveres i standardlengder fra 3 til 15 meter med utskiftbare enkelttrinn og klikk-koblingssystem. ISO 799-1:2019-sertifisert og godkjent av Sjøfartsdirektoratet.',
    url: abs('/produkt'),
    image: [abs('/images/ladder-full.png'), abs('/images/leider_in_use.jpg')],
    brand: { '@type': 'Brand', name: 'Argostep' },
    manufacturer: { '@id': ORG_ID },
    countryOfOrigin: { '@type': 'Country', name: 'Norge' },
    material: 'Glassfiberarmert plast',
    productGroupID: 'ARGOSTEP-ML',
    // The one dimension that varies between variants.
    variesBy: 'https://schema.org/height',
    category: 'Maritimt sikkerhetsutstyr > Leidere',
    hasCertification: [
      {
        '@type': 'Certification',
        name: 'ISO 799-1:2019',
        issuedBy: { '@type': 'Organization', name: 'ISO' },
        about: 'Skip og maritim teknologi – losleidere',
      },
      {
        '@type': 'Certification',
        name: 'Godkjent av Sjøfartsdirektoratet',
        issuedBy: { '@type': 'Organization', name: 'Sjøfartsdirektoratet' },
      },
    ],
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Standardlengder', value: '3–15 meter' },
      { '@type': 'PropertyValue', name: 'Materiale', value: 'Glassfiberarmert plast' },
      { '@type': 'PropertyValue', name: 'System', value: 'Modulært klikk-koblet' },
      { '@type': 'PropertyValue', name: 'Vedlikehold', value: 'Utskiftbare enkelttrinn' },
      { '@type': 'PropertyValue', name: 'Produksjonsland', value: 'Norge' },
    ],
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: CURRENCY,
      lowPrice: PRICE_MIN,
      highPrice: PRICE_MAX,
      offerCount: PRICE_TABLE.length,
      availability: 'https://schema.org/InStock',
      seller: { '@id': ORG_ID },
    },
    hasVariant: PRICE_TABLE.map((row) => ({
      '@type': 'Product',
      '@id': `${abs('/produkt')}#${row.productNumber}`,
      name: `${row.productName} – ${row.length} meter`,
      sku: row.productNumber,
      mpn: row.productNumber,
      description: `Argostep maritim leider, ${row.length} meter med ${row.steps} trinn. Glassfiberarmert plast, modulært klikk-koblet system.`,
      height: { '@type': 'QuantitativeValue', value: row.length, unitCode: 'MTR' },
      material: 'Glassfiberarmert plast',
      brand: { '@type': 'Brand', name: 'Argostep' },
      isVariantOf: { '@id': PRODUCT_ID },
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Antall trinn', value: row.steps },
        { '@type': 'PropertyValue', name: 'Oppbevaringsskap', value: row.cabinetName },
      ],
      offers: {
        '@type': 'Offer',
        url: abs('/bestill'),
        price: row.price,
        priceCurrency: CURRENCY,
        priceValidUntil,
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@id': ORG_ID },
        // Prices on the site are quoted excluding Norwegian VAT.
        priceSpecification: {
          '@type': 'PriceSpecification',
          price: row.price,
          priceCurrency: CURRENCY,
          valueAddedTaxIncluded: false,
        },
      },
    })),
  };
}

/* ── Supporting nodes ── */

export function faqNode(
  faqs: readonly { q: string; a: string }[],
  path = '/faq',
) {
  return {
    '@type': 'FAQPage',
    '@id': `${abs(path)}#faq`,
    inLanguage: 'nb-NO',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function breadcrumbNode(trail: { name: string; path: string }[]): Node {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

/** Converts the "dd.mm.yyyy" dates used in lib/articles.ts to ISO-8601. */
export function isoDate(norwegian: string): string {
  const [d, m, y] = norwegian.split('.');
  return `${y}-${m}-${d}`;
}

export function articleNode(article: Article): Node {
  const url = abs(`/nyheter/${article.slug}`);
  return {
    '@type': 'NewsArticle',
    '@id': `${url}#article`,
    headline: article.title,
    description: article.excerpt,
    url,
    mainEntityOfPage: { '@id': `${url}#webpage` },
    image: [abs(article.image)],
    datePublished: isoDate(article.date),
    dateModified: isoDate(article.date),
    inLanguage: 'nb-NO',
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': PRODUCT_ID },
  };
}
