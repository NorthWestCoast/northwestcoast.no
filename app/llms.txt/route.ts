import { PRICE_TABLE, fmt, MIN_PRICE, MAX_PRICE } from '@/lib/pricing';
import { ORG, SITE_URL } from '@/lib/site';
import { localePath } from '@/lib/i18n';

/**
 * llms.txt: en kort, lesbar oppsummering for AI-assistenter (llmstxt.org).
 * Alt her er hentet fra nettstedet – ikke legg til påstander som ikke står der.
 */
export const dynamic = 'force-static';

export function GET() {
  const sizes = PRICE_TABLE.map((r) =>
    r.onRequest
      ? `- ${r.length} m: price on request`
      : `- ${r.length} m (${r.steps} steps, product no. ${r.productNumber}): NOK ${fmt(r.price)} excl. VAT`,
  ).join('\n');

  const body = `# NorthWest Coast – Argostep

> NorthWest Coast (${ORG.legalName}, org. no. ${ORG.orgNumber}) makes Argostep, a lightweight, modular embarkation and lifeboat ladder in glass-fibre reinforced plastic. Certified to ISO 799-1:2019 and approved by the Norwegian Maritime Authority (Sjøfartsdirektoratet) for Norwegian vessels under 15 metres. Made in Sunnmøre, Norway.

## Key facts

- Product: Argostep Lifeboat Ladder (Norwegian: Argostep Livbåtleider)
- Lengths: 2–15 metres (standard sizes); other needs are tailored on request
- Material: glass-fibre reinforced plastic (steps and fittings), light, strong and corrosion resistant in saltwater
- System: modular click coupling – individual steps can be replaced without replacing the whole ladder; mounted and dismounted without special tools
- Storage: weatherproof storage cabinet available, which extends service life
- Suitable for: fishing vessels under 15 m, service vessels under 15 m, smaller cargo ships, passenger vessels
- Prices are indicative and exclude VAT; the final quote is confirmed after contact
- Price range for priced sizes: NOK ${fmt(MIN_PRICE)}–${fmt(MAX_PRICE)} excl. VAT

## Sizes and indicative prices

${sizes}

## Pages (English)

- [Product](${SITE_URL}${localePath('en', '/produkt')}): specifications, certification and suitable vessels
- [Ladder calculator](${SITE_URL}${localePath('en', '/kalkulator')}): work out the ladder length from freeboard and mounting point, then order. A sizing aid, not a compliance certificate – final requirements are confirmed by class society, flag state or the Norwegian Maritime Authority
- [Order](${SITE_URL}${localePath('en', '/bestill')}): configure length and storage cabinet and send an order
- [FAQ](${SITE_URL}${localePath('en', '/faq')}): approval, lengths, service life, mounting, delivery, material, spare parts
- [Maintenance](${SITE_URL}${localePath('en', '/vedlikehold')}): log completed maintenance for a vessel
- [News](${SITE_URL}${localePath('en', '/nyheter')})

## Sider (norsk)

- [Produkt](${SITE_URL}/produkt)
- [Leiderkalkulator](${SITE_URL}/kalkulator)
- [Bestill](${SITE_URL}/bestill)
- [Ofte stilte spørsmål](${SITE_URL}/faq)
- [Vedlikehold](${SITE_URL}/vedlikehold)
- [Nyheter](${SITE_URL}/nyheter)

## Contact

- Phone: ${ORG.phoneDisplay}
- Email: ${ORG.email}
- Address: ${ORG.street}, ${ORG.postalCode} ${ORG.city}, Norway
`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
