import { NextRequest, NextResponse } from 'next/server';

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

/** Trimmer og kutter fritekst (kommentarer, meldinger) før den lagres eller sendes. */
export function clean(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

/**
 * Enlinjefelt (navn, fartøy, telefon, serienummer): som clean(), men uten
 * linjeskift, kontrolltegn og usynlige formattegn. Da kan ingen legge inn
 * egne «linjer» i den interne e-posten eller skjule hva feltet inneholder.
 */
export function line(value: unknown, maxLength = 200): string {
  if (typeof value !== 'string') return '';
  return Array.from(
    value
      .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .slice(0, maxLength)
    .join('')
    .trim();
}

/**
 * Leser JSON-kroppen i et skjemakall.
 *
 * Gir null når kallet ikke kommer fra vår egen side: skjemaene våre sender
 * alltid JSON fra samme opprinnelse. Uten denne sjekken kunne en hvilken som
 * helst nettside fått besøkendes nettlesere til å sende inn skjemaene for
 * seg (et vanlig HTML-skjema kan poste tekst, men ikke JSON, på tvers av
 * nettsteder). Kall uten Origin og Sec-Fetch-Site kommer ikke fra en
 * nettleser, og slippes gjennom til de vanlige grensene.
 */
export async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return null;

  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return null;

  const origin = req.headers.get('origin');
  if (origin) {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    try {
      if (new URL(origin).host !== host) return null;
    } catch {
      return null;
    }
  }

  const body: unknown = await req.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

/** Svaret når readBody() avviser kallet. */
export const rejected = () => NextResponse.json({ error: 'Ugyldig forespørsel.' }, { status: 403 });

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

export type ApiLang = 'no' | 'en';

/** Språket klienten oppgir. Ukjente verdier faller tilbake på norsk. */
export function langOf(body: Record<string, unknown>): ApiLang {
  return body.lang === 'en' ? 'en' : 'no';
}

/** Velger tekst etter språk – brukes til feilmeldinger som vises til kunden. */
export function tr(lang: ApiLang, no: string, en: string): string {
  return lang === 'en' ? en : no;
}
