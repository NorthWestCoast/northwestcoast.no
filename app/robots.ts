import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Alle får lese de offentlige sidene. Søkemotorene og AI-tjenestene under er
 * likevel nevnt ved navn: en robot som finner sitt eget navn i robots.txt,
 * følger den gruppen og ikke «*», så tilgangen står svart på hvitt og kan
 * ikke misforstås. Lista er de som brukes til søk og svar i dag:
 *
 * - søk: Google, Bing, Apple, DuckDuckGo
 * - AI-søk og henting på vegne av en bruker: OpenAI (OAI-SearchBot,
 *   ChatGPT-User), Anthropic (Claude-SearchBot, Claude-User), Perplexity,
 *   DuckDuckGo (DuckAssistBot), Mistral, Meta
 * - innsamling til modellene: GPTBot, ClaudeBot, Google-Extended,
 *   Applebot-Extended, Amazonbot, CCBot
 */
const NAMED_CRAWLERS = [
  'Googlebot', 'Bingbot', 'Applebot', 'DuckDuckBot',
  'OAI-SearchBot', 'ChatGPT-User', 'GPTBot',
  'Claude-SearchBot', 'Claude-User', 'ClaudeBot',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended',
  'DuckAssistBot', 'MistralAI-User', 'Meta-ExternalAgent', 'Amazonbot', 'CCBot',
];

/**
 * Innloggede områder, API-et og delingslenker (/los/ er unike, kortlivede
 * rapporter til los, /sertifikat/ er kontrollsider for ett bestemt dokument). /logg-inn står ikke her: siden har noindex, og den må
 * kunne leses for at søkemotorene skal se det.
 */
const PRIVATE = ['/minside', '/admin', '/produksjon', '/api/', '/auth/', '/los/', '/sertifikat/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      { userAgent: NAMED_CRAWLERS, allow: '/', disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
