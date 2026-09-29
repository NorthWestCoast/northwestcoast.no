import type { MetadataRoute } from 'next';
import { ARTICLES } from '@/lib/articles';
import { SITE_URL, localePath } from '@/lib/i18n';

const PAGES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/produkt', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/kalkulator', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/bestill', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/vedlikehold', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/galleri', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/nyheter', priority: 0.6, changeFrequency: 'weekly' },
];

const isoFromArticle = (date: string) => {
  const [d, m, y] = date.split('.');
  return new Date(`${y}-${m}-${d}`);
};

function entry(path: string, priority: number, changeFrequency: 'weekly' | 'monthly', lastModified?: Date) {
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

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PAGES.map((p) => entry(p.path, p.priority, p.changeFrequency)),
    ...ARTICLES.map((a) =>
      entry(`/nyheter/${a.slug}`, 0.6, 'monthly', isoFromArticle(a.date)),
    ),
  ];
}
