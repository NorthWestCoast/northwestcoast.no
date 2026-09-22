import type { MetadataRoute } from 'next';
import { ARTICLES } from '@/lib/articles';
import { SITE_URL } from '@/lib/site';

/** Datoer i artiklene er på formatet DD.MM.YYYY. */
function parseNorwegianDate(date: string): Date {
  const [day, month, year] = date.split('.').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,             changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/bestill`,      changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/produkt`,      changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/galleri`,      changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/faq`,          changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/vedlikehold`,  changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/nyheter`,      changeFrequency: 'weekly',  priority: 0.6 },
  ];

  const articles: MetadataRoute.Sitemap = ARTICLES.map((article) => ({
    url: `${SITE_URL}/nyheter/${article.slug}`,
    lastModified: parseNorwegianDate(article.date),
    changeFrequency: 'yearly',
    priority: 0.5,
  }));

  return [...pages, ...articles];
}
