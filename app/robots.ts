import type { MetadataRoute } from 'next';
import { abs, SITE_URL } from '@/lib/site';

/**
 * A permissive robots.txt, with the AI crawlers named explicitly.
 *
 * A blanket "allow everything" would technically cover them all. Naming them
 * does two things: it documents that indexing by answer engines is a deliberate
 * business decision (this site *wants* to be quoted by ChatGPT, Perplexity,
 * Claude and Google AI Overviews), and it survives someone later adding a
 * restrictive default group without thinking about generative traffic.
 *
 * Note the split between the two kinds of AI agent:
 *  - Training/index crawlers (GPTBot, ClaudeBot, CCBot, Google-Extended…)
 *  - Live "user asked a question right now" fetchers (OAI-SearchBot,
 *    ChatGPT-User, Perplexity-User, Claude-User) — these are the ones that
 *    actually drive referral traffic, so blocking them costs visits.
 */

const AI_CRAWLERS = [
  // OpenAI
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  // Anthropic
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  // Perplexity
  'PerplexityBot',
  'Perplexity-User',
  // Google / Microsoft AI surfaces
  'Google-Extended',
  'GoogleOther',
  'BingBot',
  // Others worth being visible in
  'Applebot',
  'Applebot-Extended',
  'DuckAssistBot',
  'Amazonbot',
  'meta-externalagent',
  'cohere-ai',
  'CCBot',
  'YouBot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // API routes hold form handlers only: nothing indexable, and keeping
        // them out of the index avoids crawl budget spent on 405 responses.
        disallow: ['/api/'],
      },
      {
        userAgent: AI_CRAWLERS,
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: abs('/sitemap.xml'),
    host: SITE_URL,
  };
}
