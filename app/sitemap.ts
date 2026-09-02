import type { MetadataRoute } from 'next';
import { abs, PAGES } from '@/lib/site';
import { ARTICLES } from '@/lib/articles';
import { isoDate } from '@/lib/structured-data';

/**
 * Generated sitemap.
 *
 * Built from the PAGES registry in lib/site.ts plus the article list, so adding
 * a page or publishing an article can never leave the sitemap stale — the most
 * common reason new pages sit unindexed for weeks.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages = PAGES.map((page) => ({
    url: abs(page.path),
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  const articles = ARTICLES.map((article) => ({
    url: abs(`/nyheter/${article.slug}`),
    // Real publication dates rather than build time: a sitemap where every URL
    // claims to have changed today teaches crawlers to ignore lastModified.
    lastModified: new Date(isoDate(article.date)),
    changeFrequency: 'yearly' as const,
    priority: 0.5,
  }));

  return [...staticPages, ...articles];
}
