import { FAQ_ITEMS } from './faq-items';
import { getDict, localePath, SITE_NAME, SITE_URL, type Lang } from './i18n';
import type { PriceTable } from './pricing';
import { ORG } from './site';

/**
 * Teksten til /llms.txt og /llms-full.txt: en oversikt AI-assistenter kan
 * lese og sitere (llmstxt.org).
 *
 * Alt innhold hentes fra ordbøkene, FAQ-en, prislista og lib/site.ts, altså
 * den samme teksten som står på sidene. Ikke skriv nye påstander her: endres
 * en opplysning, endres den i ordboken, og da følger disse filene med.
 */

const abs = (lang: Lang, path: string) => `${SITE_URL}${localePath(lang, path)}`;

/** Tusenskille med vanlig mellomrom (norsk) eller komma (engelsk), ikke hardt mellomrom. */
const money = (lang: Lang, amount: number) =>
  String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'no' ? ' ' : ',');

const L = {
  no: {
    exVat: 'eks. mva.',
    onRequest: 'pris på forespørsel',
    productNo: 'produktnr.',
    lengths: 'Lengder og veiledende priser',
    cabinets: 'Oppbevaringsskap og veiledende priser',
    fits: 'passer leider',
    orgNo: 'org.nr.',
    phone: 'Telefon',
    email: 'E-post',
    address: 'Adresse',
    country: 'Norge',
    contact: 'Kontakt',
  },
  en: {
    exVat: 'excl. VAT',
    onRequest: 'price on request',
    productNo: 'product no.',
    lengths: 'Lengths and indicative prices',
    cabinets: 'Storage cabinets and indicative prices',
    fits: 'fits ladder',
    orgNo: 'org. no.',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    country: 'Norway',
    contact: 'Contact',
  },
} as const;

/** Én linje per lengde i prislista. */
function sizeLines(lang: Lang, table: PriceTable): string[] {
  const t = getDict(lang);
  const l = L[lang];
  return table.map((r) =>
    r.onRequest
      ? `- ${r.length} m: ${l.onRequest}`
      : `- ${r.length} m (${r.steps} ${t.order.steps}, ${l.productNo} ${r.productNumber}): NOK ${money(lang, r.price)} ${l.exVat}`,
  );
}

/** Skapmodellene i prislista, med lengdene de passer til. */
function cabinetLines(lang: Lang, table: PriceTable): string[] {
  const l = L[lang];
  const models = new Map<string, { price: number; lengths: number[] }>();
  for (const r of table) {
    if (r.onRequest || !r.cabinetName) continue;
    const model = models.get(r.cabinetName) ?? { price: r.cabinetPrice, lengths: [] };
    model.lengths.push(r.length);
    models.set(r.cabinetName, model);
  }
  return [...models].map(([name, { price, lengths }]) => {
    const min = Math.min(...lengths);
    const max = Math.max(...lengths);
    const range = min === max ? `${min} m` : `${min}–${max} m`;
    return `- ${name} (${l.fits} ${range}): NOK ${money(lang, price)} ${l.exVat}`;
  });
}

function lengthRange(table: PriceTable): { min: number; max: number } {
  const lengths = table.map((r) => r.length);
  return { min: Math.min(...lengths), max: Math.max(...lengths) };
}

function contactLines(lang: Lang): string[] {
  const l = L[lang];
  return [
    `- ${ORG.legalName}, ${l.orgNo} ${ORG.orgNumber}`,
    `- ${l.phone}: ${ORG.phoneDisplay}`,
    `- ${l.email}: ${ORG.email}`,
    `- ${l.address}: ${ORG.street}, ${ORG.postalCode} ${ORG.city}, ${l.country}`,
  ];
}

/** Lenkene til de offentlige sidene på ett språk, med sidenes egne beskrivelser. */
function pageLinks(lang: Lang): string[] {
  const t = getDict(lang);
  const page = (label: string, path: string, description: string) =>
    `- [${label}](${abs(lang, path)}): ${description}`;
  return [
    page(t.product.title, '/produkt', t.meta.produkt.description),
    page(t.products.navLabel, '/produkter', t.meta.produkter.description),
    page(t.calculator.label, '/kalkulator', t.meta.kalkulator.description),
    page(t.order.title, '/bestill', t.meta.bestill.description),
    page(t.faq.title, '/faq', t.meta.faq.description),
    page(t.viewerPage.title, '/3d-leider', t.meta.leider3d.description),
    page(t.gallery.title, '/galleri', t.meta.galleri.description),
    page(t.maintenance.title, '/vedlikehold', t.meta.vedlikehold.description),
    page(t.about.navLabel, '/om-oss', t.meta.omOss.description),
    page(t.nav.nyheter, '/nyheter', t.meta.nyheter.description),
  ];
}

/** /llms.txt: kort oversikt med lenker. Engelsk først, norsk under. */
export function llmsTxt(table: PriceTable): string {
  const no = getDict('no');
  const en = getDict('en');
  const { min, max } = lengthRange(table);
  const priced = table.filter((r) => !r.onRequest);
  const prices = priced.map((r) => r.price);
  const spec = (s: { key: string; val: string }) => `- ${s.key}: ${s.val}`;

  return [
    `# ${SITE_NAME} – Argostep`,
    '',
    `> ${en.product.answerBody}`,
    '',
    `${SITE_NAME} (${ORG.legalName}, org. no. ${ORG.orgNumber}) is the company behind Argostep. The website is in Norwegian (${abs('no', '/')}) and English (${abs('en', '/')}). In Norwegian this kind of ladder is called «leider»; the product is sold as «${no.product.title}» and described as «${no.products.ladder.title}».`,
    '',
    `Norsk sammendrag: ${no.product.answerBody}`,
    '',
    '## Key facts',
    '',
    `- Product: ${en.product.title} (Norwegian: ${no.product.title})`,
    ...Object.values(en.product.specs).map(spec),
    ...Object.values(en.viewerPage.specs).map(spec),
    `- ${en.certs.cards.nma.title}: ${en.certs.cards.nma.sub}`,
    `- ${en.certs.vesselsLabel}: ${Object.values(en.certs.vessels).join(', ')}`,
    `- ${en.products.storage.title}: ${en.products.storage.desc}`,
    `- ${en.products.parts.label}: ${en.products.parts.sub}`,
    ...(prices.length > 0
      ? [`- Price range, ${priced[0].length}–${priced[priced.length - 1].length} m: NOK ${money('en', Math.min(...prices))}–${money('en', Math.max(...prices))} ${L.en.exVat}. ${en.order.note}`]
      : []),
    '',
    `## ${L.en.lengths}`,
    '',
    en.products.range.sub(min, max),
    '',
    ...sizeLines('en', table),
    '',
    '## How to order',
    '',
    `- ${en.product.lengthBody} ${abs('en', '/kalkulator')}`,
    `- ${en.order.sub} ${abs('en', '/bestill')}`,
    `- ${en.order.checkoutSub} ${en.order.note}`,
    `- ${en.calculator.disclaimer}`,
    '',
    '## Pages (English)',
    '',
    ...pageLinks('en'),
    '',
    '## Sider (norsk)',
    '',
    ...pageLinks('no'),
    '',
    `## ${L.en.contact}`,
    '',
    ...contactLines('en'),
    '',
    '## Optional',
    '',
    `- [llms-full.txt](${SITE_URL}/llms-full.txt): the full text behind this overview in Norwegian and English – product description, specifications, prices, storage cabinets, all questions and answers, and the company`,
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
    '',
  ].join('\n');
}

/** Hele innholdet på ett språk, som markdown under en `##`-overskrift. */
function fullSection(lang: Lang, table: PriceTable): string[] {
  const t = getDict(lang);
  const l = L[lang];
  const { min, max } = lengthRange(table);
  const bullets = (items: readonly string[]) => items.map((item) => `- ${item}`);
  const pairs = (items: { title: string; desc: string }[]) => items.map((i) => `- ${i.title}: ${i.desc}`);
  const cabinets = cabinetLines(lang, table);

  return [
    `## ${t.langName}: ${t.product.title}`,
    '',
    `${abs(lang, '/')}`,
    '',
    `### ${t.product.answerTitle}`,
    '',
    t.product.answerBody,
    '',
    t.product.introSub,
    '',
    ...pairs(Object.values(t.features)),
    '',
    `### ${t.how.title}`,
    '',
    t.how.sub,
    '',
    ...pairs(Object.values(t.how.steps)),
    '',
    `### ${t.viewerPage.specsTitle}`,
    '',
    ...[...Object.values(t.product.specs), ...Object.values(t.viewerPage.specs)].map((s) => `- ${s.key}: ${s.val}`),
    '',
    `### ${t.certs.title}`,
    '',
    ...Object.values(t.certs.cards).map((c) => `- ${c.title}: ${c.sub}`),
    `- ${t.certs.vesselsLabel}: ${Object.values(t.certs.vessels).join(', ')}`,
    '',
    `### ${t.products.ladder.title}`,
    '',
    t.products.ladder.desc,
    '',
    ...bullets(t.products.ladder.features),
    '',
    `### ${l.lengths}`,
    '',
    `${t.products.range.sub(min, max)} ${t.order.note}`,
    '',
    ...sizeLines(lang, table),
    '',
    `### ${t.products.storage.title}`,
    '',
    t.products.storage.desc,
    '',
    ...bullets(t.products.storage.features),
    ...(cabinets.length > 0 ? ['', `${l.cabinets}:`, '', ...cabinets] : []),
    '',
    `### ${t.products.parts.label}`,
    '',
    t.products.parts.sub,
    '',
    ...pairs(Object.values(t.products.parts.cards).map(({ title, desc }) => ({ title, desc }))),
    '',
    `### ${t.product.lengthTitle}`,
    '',
    `${t.product.lengthBody} ${abs(lang, '/kalkulator')}`,
    '',
    t.calculator.disclaimer,
    '',
    `### ${t.order.title}`,
    '',
    `${t.order.sub} ${abs(lang, '/bestill')}`,
    '',
    `${t.order.checkoutSub} ${t.order.note}`,
    '',
    `### ${t.maintenance.title}`,
    '',
    `${t.maintenance.sub} ${abs(lang, '/vedlikehold')}`,
    '',
    `### ${t.faq.title}`,
    '',
    ...FAQ_ITEMS.flatMap(({ key }) => [`**${t.faq.items[key].q}**`, '', t.faq.items[key].a, '']),
    `### ${t.about.label}`,
    '',
    t.about.intro,
    '',
    `${t.about.production.sub} ${t.about.production.chain}`,
    '',
    t.about.founders.sub,
    '',
    t.about.supporters.sub,
    '',
    `### ${l.contact}`,
    '',
    ...contactLines(lang),
    '',
  ];
}

/** /llms-full.txt: all teksten bak oversikten, på norsk og engelsk. */
export function llmsFullTxt(table: PriceTable): string {
  const en = getDict('en');
  return [
    `# ${SITE_NAME} – Argostep (full text)`,
    '',
    `> ${en.product.answerBody}`,
    '',
    `This file holds the text of ${SITE_URL} in Norwegian and English: what the product is, specifications, lengths and indicative prices, storage cabinets, how to order, all questions and answers, and who makes it. The short overview with links is at ${SITE_URL}/llms.txt.`,
    '',
    ...fullSection('no', table),
    ...fullSection('en', table),
  ].join('\n');
}
