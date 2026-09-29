import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Både søkemotorer og AI-assistenter skal kunne lese og sitere de offentlige
// sidene, så de store AI-crawlerne er nevnt eksplisitt i stedet for å stole
// på «*». Innloggede områder og delingslenker holdes utenfor for alle.
const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'CCBot',
];

// /los/ er delingslenker til los – unike, kortlivede og ikke for søk.
const PRIVATE = ['/api/', '/minside', '/admin', '/logg-inn', '/auth/', '/los/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
