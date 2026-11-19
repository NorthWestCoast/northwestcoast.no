import type { MetadataRoute } from 'next';
import { getArticles } from '@/lib/posts';
import { SITE_URL } from '@/lib/site';
import { localePath } from '@/lib/i18n';

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

/** Norsk er kanonisk; engelsk oppgis som språkalternativ (hreflang). */
function entry(
  path: string,
  priority: number,
  changeFrequency: 'weekly' | 'monthly' | 'yearly',
  lastModified?: Date,
): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE_URL}${localePath('no', path)}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: {
        'nb-NO': `${SITE_URL}${localePath('no', path)}`,
        en: `${SITE_URL}${localePath('en', path)}`,
      },
    },
  };
}

// Nyheter redigeres i admin. Sitemapet bygges på nytt hver time, og med en
// gang når et innlegg lagres (getArticles er tagget med POSTS_TAG).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getArticles('no');

  return [
    ...PAGES.map((p) => entry(p.path, p.priority, p.changeFrequency)),
    ...articles.map((a) =>
      entry(`/nyheter/${a.slug}`, 0.5, 'yearly', parseNorwegianDate(a.date)),
    ),
    // Personvernerklæringen finnes bare på norsk.
    { url: `${SITE_URL}/personvern`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
