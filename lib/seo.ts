import { ARTICLES, localizeArticle } from './articles';
import { FAQ_ITEMS } from './faq-items';
import { getDict, localePath, SITE_URL, type Lang } from './i18n';
import { PRICE_TABLE } from './pricing';
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

export function productLd(lang: Lang) {
  const t = getDict(lang);
  const priced = PRICE_TABLE.filter((r) => !r.onRequest);
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
      offerCount: PRICE_TABLE.length,
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

export function articleLd(lang: Lang, slug: string) {
  const found = ARTICLES.find((a) => a.slug === slug);
  if (!found) return null;
  const a = localizeArticle(found, lang);
  const [d, m, y] = a.date.split('.');
  const iso = `${y}-${m}-${d}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.excerpt,
    image: abs(a.image),
    datePublished: iso,
    dateModified: iso,
    inLanguage: lang === 'no' ? 'nb-NO' : 'en',
    mainEntityOfPage: abs(localePath(lang, `/nyheter/${slug}`)),
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
  };
}
