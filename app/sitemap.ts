import type { MetadataRoute } from 'next';
import { getArticles } from '@/lib/posts';
import { SITE_URL } from '@/lib/site';
import { LANGS, buildAlternates, localePath } from '@/lib/i18n';

/** Datoer i artiklene er på formatet DD.MM.YYYY. */
function parseNorwegianDate(date: string): Date {
  const [day, month, year] = date.split('.').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

const PAGES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'monthly' },
  { path: '/produkt', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/produkter', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/3d-leider', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/om-oss', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/kalkulator', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/bestill', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/vedlikehold', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/galleri', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/nyheter', priority: 0.6, changeFrequency: 'weekly' },
];

/**
 * Én oppføring per språk. Begge lister de samme språkalternativene (nb-NO, en
 * og x-default), slik Google ber om for hreflang i sitemap: hver språkutgave
 * er sin egen adresse og peker på alle utgavene, seg selv medregnet.
 */
function entries(
  path: string,
  priority: number,
  changeFrequency: 'weekly' | 'monthly' | 'yearly',
  lastModified?: Date,
  images?: string[],
): MetadataRoute.Sitemap {
  const { languages } = buildAlternates(path);
  return LANGS.map((lang) => ({
    url: `${SITE_URL}${localePath(lang, path)}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages },
    ...(images?.length ? { images } : {}),
  }));
}

/** Full adresse til et bilde (nettstedets egne ligger i /public). */
const absImage = (src: string) => (/^https?:\/\//i.test(src) ? src : `${SITE_URL}${src}`);

/** Sist innlegget ble lagret, ellers publiseringsdatoen. */
const modified = (a: { modifiedAt: string | null; date: string }) =>
  a.modifiedAt ? new Date(a.modifiedAt) : parseNorwegianDate(a.date);

// Nyheter redigeres i admin. Hvert innlegg har datoen det sist ble lagret, og
// bildene sine (forsidebildet og lysbildeshowet), så de kan finnes i
// bildesøk. Sitemapet bygges på nytt hver time, og med en gang når et
// innlegg lagres (getArticles er tagget med POSTS_TAG).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getArticles('no');

  // Bare offentlige sider. Innlogging og de innloggede områdene (/logg-inn,
  // /minside, /admin, /produksjon, /los) hører ikke hjemme her.
  // Nyhetssiden er endret når det nyeste innlegget ble lagret.
  const newsChanged = articles.length
    ? new Date(Math.max(...articles.map((a) => modified(a).getTime())))
    : undefined;

  return [
    ...PAGES.flatMap((p) =>
      entries(p.path, p.priority, p.changeFrequency, p.path === '/nyheter' ? newsChanged : undefined),
    ),
    ...articles.flatMap((a) =>
      entries(
        `/nyheter/${a.slug}`,
        0.5,
        'yearly',
        modified(a),
        [...new Set([a.image, ...a.images].map(absImage))].slice(0, 20),
      ),
    ),
    // Personvernerklæringen finnes bare på norsk.
    { url: `${SITE_URL}/personvern`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
