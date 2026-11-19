import { NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/site';

/**
 * Bekreftelse av og avmelding fra nyhetsbrevet.
 *
 *   GET  /api/newsletter/confirm?t=<nøkkel>            viser «Bekreft påmeldingen»
 *   GET  /api/newsletter/confirm?t=<nøkkel>&a=avmeld   viser «Meld meg av»
 *   POST samme adresse                                 gjør det
 *
 * Lenken i e-posten gjør ingenting av seg selv: e-postfiltre åpner lenker for
 * å sjekke dem, og skal verken kunne melde noen på eller av. Først når
 * mottakeren trykker på knappen (POST) skjer det noe.
 *
 * Sidene er små og selvstendige (norsk eller engelsk etter &l=en), uten
 * nettstedets skript og analyse, fordi adressen inneholder en nøkkel.
 */
type Lang = 'no' | 'en';

const TOKEN = /^[0-9a-f]{32,64}$/;

const TEXT = {
  no: {
    confirmTitle: 'Bekreft påmeldingen',
    confirmBody: 'Trykk på knappen for å motta nyhetsbrevet fra NorthWest Coast.',
    confirmButton: 'Bekreft påmeldingen',
    confirmed: 'Du er påmeldt',
    confirmedBody: 'Takk. Du får nyhetsbrevet fra NorthWest Coast, og kan melde deg av når som helst med lenken i e-postene.',
    leaveTitle: 'Meld deg av nyhetsbrevet',
    leaveBody: 'Trykk på knappen for å slutte å motta nyhetsbrevet fra NorthWest Coast.',
    leaveButton: 'Meld meg av',
    left: 'Du er meldt av',
    leftBody: 'Du får ikke flere nyhetsbrev fra oss.',
    invalid: 'Lenken er ikke gyldig',
    invalidBody: 'Den er brukt, eller den er for gammel. Meld deg gjerne på igjen fra nettsiden.',
    home: 'Til northwestcoast.no',
  },
  en: {
    confirmTitle: 'Confirm your subscription',
    confirmBody: 'Use the button to receive the newsletter from NorthWest Coast.',
    confirmButton: 'Confirm subscription',
    confirmed: 'You are subscribed',
    confirmedBody: 'Thank you. You will receive the newsletter from NorthWest Coast, and can unsubscribe at any time with the link in the emails.',
    leaveTitle: 'Unsubscribe from the newsletter',
    leaveBody: 'Use the button to stop receiving the newsletter from NorthWest Coast.',
    leaveButton: 'Unsubscribe',
    left: 'You are unsubscribed',
    leftBody: 'You will not receive any more newsletters from us.',
    invalid: 'The link is not valid',
    invalidBody: 'It has been used, or it is too old. You are welcome to sign up again from the website.',
    home: 'Go to northwestcoast.no',
  },
} as const;

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

function page(lang: Lang, title: string, body: string, button?: string, status = 200): Response {
  const t = TEXT[lang];
  const html = `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'nb'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>${esc(title)} | NorthWest Coast</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0a1628; color: #16202e; font: 16px/1.55 Arial, Helvetica, sans-serif; }
  main { width: min(30rem, calc(100vw - 2rem)); background: #fff; border-top: 3px solid #7f2d36; padding: 2rem 1.75rem; box-sizing: border-box; }
  h1 { margin: 0 0 0.75rem; font: 400 1.6rem/1.3 Georgia, 'Times New Roman', serif; color: #0a1628; }
  p { margin: 0 0 1.25rem; }
  button { font: 700 1rem Arial, Helvetica, sans-serif; padding: 0.8rem 1.5rem; border: 0; border-radius: 3px; background: #2ecc71; color: #0a1628; cursor: pointer; }
  a { color: #0a1628; }
</style>
</head>
<body>
<main>
  <h1>${esc(title)}</h1>
  <p>${esc(body)}</p>
  ${button ? `<form method="post"><button type="submit">${esc(button)}</button></form>` : `<p><a href="${esc(SITE_URL)}">${esc(t.home)}</a></p>`}
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function read(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const lang: Lang = params.get('l') === 'en' ? 'en' : 'no';
  const token = params.get('t') ?? '';
  const leaving = params.get('a') === 'avmeld';
  return { lang, token: TOKEN.test(token) ? token : null, leaving };
}

export async function GET(req: NextRequest) {
  const { lang, token, leaving } = read(req);
  const t = TEXT[lang];
  if (!token) return page(lang, t.invalid, t.invalidBody, undefined, 400);
  return leaving
    ? page(lang, t.leaveTitle, t.leaveBody, t.leaveButton)
    : page(lang, t.confirmTitle, t.confirmBody, t.confirmButton);
}

export async function POST(req: NextRequest) {
  const { lang, token, leaving } = read(req);
  const t = TEXT[lang];
  if (!token) return page(lang, t.invalid, t.invalidBody, undefined, 400);

  // Bare skjemaet på vår egen side: andre nettsteder skal ikke kunne sende det inn.
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return page(lang, t.invalid, t.invalidBody, undefined, 403);

  try {
    const supabase = await createServerSupabase();
    const { data, error } = leaving
      ? await supabase.rpc('unsubscribe_newsletter', { p_token: token })
      : await supabase.rpc('confirm_newsletter', { p_token: token });
    if (error) console.error('[newsletter] Bekreftelse feilet:', error.code, error.message);
    if (data === true) return leaving ? page(lang, t.left, t.leftBody) : page(lang, t.confirmed, t.confirmedBody);
  } catch (error) {
    console.error('[newsletter] Supabase er ikke tilgjengelig:', error);
  }
  return page(lang, t.invalid, t.invalidBody, undefined, 400);
}
