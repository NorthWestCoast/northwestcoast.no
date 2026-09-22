import { NextRequest } from 'next/server';

/**
 * Enkel misbruksbeskyttelse for de offentlige skjema-endepunktene.
 *
 * Merk: telleren ligger i minnet på den enkelte serverless-instansen. På
 * Vercel betyr det at grensen er per instans, ikke global – nok til å stoppe
 * en enkel bot-loop og holde Resend-forbruket nede, men ikke en erstatning
 * for et delt lager (Upstash/Redis) hvis trafikken vokser.
 */
const HITS = new Map<string, number[]>();

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function rateLimit(
  key: string,
  { limit = 5, windowMs = 10 * 60 * 1000 } = {},
): boolean {
  const now = Date.now();
  const recent = (HITS.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    HITS.set(key, recent);
    return false;
  }

  recent.push(now);
  HITS.set(key, recent);

  // Rydd sporadisk så kartet ikke vokser i en langlevd instans.
  if (HITS.size > 500) {
    for (const [k, times] of HITS) {
      if (times.every((t) => now - t >= windowMs)) HITS.delete(k);
    }
  }

  return true;
}

/** Trimmer og kutter fritekst før den havner i en e-post. */
export function clean(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string): boolean {
  return EMAIL.test(value);
}

/**
 * Honeypot: et skjult felt som mennesker aldri fyller ut, men som bots
 * fyller automatisk. Er det utfylt later vi som alt gikk bra (200) i stedet
 * for å svare 400 – da lærer ikke boten hva som avslørte den.
 */
export function isBot(body: Record<string, unknown>): boolean {
  return clean(body.company_website).length > 0;
}
