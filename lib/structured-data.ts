import { FAQS } from '@/lib/faqs';
import { MAX_PRICE, MIN_PRICE, PRICE_TABLE } from '@/lib/pricing';
import { ORG, SITE_URL } from '@/lib/site';

/**
 * Schema.org-data (JSON-LD).
 *
 * Hvorfor: Google viser pris, tilgjengelighet og FAQ-utdrag direkte i
 * søkeresultatet når produktdataene er maskinlesbare – og AI-søkemotorer
 * (ChatGPT, Perplexity, Google AI Overviews) plukker opp de samme feltene.
 * Prisene ligger allerede i prislista, så dette er ren gratis synlighet.
 */

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export const organizationSchema = {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: ORG.name,
  legalName: ORG.legalName,
  url: SITE_URL,
  logo: `${SITE_URL}/images/logo/NY-logo.png`,
  vatID: `NO${ORG.orgNumber.replace(/\s/g, '')}`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: ORG.street,
    postalCode: ORG.postalCode,
    addressLocality: ORG.city,
    addressCountry: ORG.country,
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: ORG.phone,
    email: ORG.email,
    contactType: 'sales',
    areaServed: 'NO',
    availableLanguage: ['no', 'en'],
  },
};

export const websiteSchema = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: 'NorthWest Coast',
  inLanguage: 'nb-NO',
  publisher: { '@id': ORGANIZATION_ID },
};

export const productSchema = {
  '@type': 'Product',
  '@id': `${SITE_URL}/produkt#product`,
  name: 'Argostep Livbåtleider',
  description:
    'Modulær maritim leider i glassfiberarmert plast. ISO 799-1:2019-sertifisert og godkjent av Sjøfartsdirektoratet. Leveres i lengder fra 2 til 15 meter.',
  image: [`${SITE_URL}/images/ladder-full.png`, `${SITE_URL}/images/leider_in_use.jpg`],
  brand: { '@type': 'Brand', name: 'Argostep' },
  manufacturer: { '@id': ORGANIZATION_ID },
  material: 'Glassfiberarmert plast',
  countryOfOrigin: 'NO',
  hasCertification: {
    '@type': 'Certification',
    name: 'ISO 799-1:2019',
    issuedBy: { '@type': 'Organization', name: 'Sjøfartsdirektoratet' },
  },
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'NOK',
    lowPrice: MIN_PRICE,
    highPrice: MAX_PRICE,
    offerCount: PRICE_TABLE.length,
    availability: 'https://schema.org/InStock',
    seller: { '@id': ORGANIZATION_ID },
    // Prisene i konfiguratoren er eks. mva.
    valueAddedTaxIncluded: false,
  },
};

export const faqSchema = {
  '@type': 'FAQPage',
  '@id': `${SITE_URL}/faq#faq`,
  mainEntity: FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: { '@type': 'Answer', text: faq.a },
  })),
};

/** Pakker ett eller flere skjemaer i én @graph, som Google foretrekker. */
export function graph(...nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
