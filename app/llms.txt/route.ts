import { PRICE_TABLE, fmt } from '@/lib/pricing';
import { SITE_URL, localePath } from '@/lib/i18n';

/**
 * llms.txt: en kort, lesbar oppsummering for AI-assistenter (llmstxt.org).
 * Alt her er hentet fra nettstedet – ikke legg til påstander som ikke står der.
 */
export const dynamic = 'force-static';

export function GET() {
  const priced = PRICE_TABLE.filter((r) => !r.onRequest);
  const sizes = PRICE_TABLE.map((r) =>
    r.onRequest
      ? `- ${r.length} m: price on request`
      : `- ${r.length} m (${r.steps} steps, product no. ${r.productNumber}): NOK ${fmt(r.price)} excl. VAT`,
  ).join('\n');
  const url = (lang: 'no' | 'en', path: string) => `${SITE_URL}${localePath(lang, path)}`;

  const body = `# NorthWest Coast – Argostep

> NorthWest Coast (Northwestcoast AS, org. no. 998 196 159) makes Argostep, a lightweight, modular embarkation and lifeboat ladder in glass-fibre reinforced plastic. Certified to ISO 799-1:2019 and approved by the Norwegian Maritime Authority (Sjøfartsdirektoratet) for Norwegian vessels under 15 metres. Made in Sunnmøre, Norway. The site is available in Norwegian and English.

## Key facts

- Product: Argostep Lifeboat Ladder (Norwegian: Argostep Livbåtleider)
- Lengths: 2–15 metres (standard sizes); other needs are tailored on request
- Material: injection-moulded glass-fibre reinforced plastic (steps and fittings), light, strong and corrosion resistant in saltwater
- System: modular click coupling – individual steps can be replaced without replacing the whole ladder; mounted and dismounted without special tools
- Storage: weatherproof storage cabinet available, which extends service life
- Suitable for: fishing vessels under 15 m, service vessels under 15 m, smaller cargo ships, passenger vessels
- Prices are indicative and exclude VAT; the final quote is confirmed after contact
- Price range for priced sizes: NOK ${fmt(Math.min(...priced.map((r) => r.price)))}–${fmt(Math.max(...priced.map((r) => r.price)))} excl. VAT

## Sizes and indicative prices

${sizes}

## Pages (English)

- [Product](${url('en', '/produkt')}): specifications, certification and suitable vessels
- [Ladder calculator](${url('en', '/kalkulator')}): work out the ladder length from freeboard and mounting point, then order. A sizing aid, not a compliance certificate – final requirements are confirmed by class society, flag state or the Norwegian Maritime Authority
- [Order](${url('en', '/bestill')}): configure length and storage cabinet and send an order
- [FAQ](${url('en', '/faq')}): approval, lengths, service life, mounting, delivery, material, spare parts
- [Maintenance](${url('en', '/vedlikehold')}): log completed maintenance for a vessel
- [News](${url('en', '/nyheter')})

## Sider (norsk)

- [Produkt](${url('no', '/produkt')})
- [Leiderkalkulator](${url('no', '/kalkulator')})
- [Bestill](${url('no', '/bestill')})
- [Ofte stilte spørsmål](${url('no', '/faq')})
- [Vedlikehold](${url('no', '/vedlikehold')})
- [Nyheter](${url('no', '/nyheter')})

## Contact

- Phone: +47 904 07 341
- Email: arve@astep.no
- Address: Postboks 79, 6281 Søvik, Norway
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
