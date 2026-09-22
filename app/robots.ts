import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /los/ er delingslenker til los - unike, kortlivede og ikke for soek.
        disallow: ['/api/', '/minside', '/logg-inn', '/auth/', '/los/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
