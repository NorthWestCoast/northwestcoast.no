import { NextRequest, NextResponse } from 'next/server';
import { clientIp, gateHeaders, isBot, isEmail, langOf, line, rateLimit, readBody, rejected, tr } from '@/lib/api-guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { CONTACT_EMAIL, sendMail } from '@/lib/mail';
import { newsletterConfirm } from '@/lib/mail/templates';
import { SITE_URL } from '@/lib/site';

/**
 * Påmelding til nyhetsbrevet.
 *
 * Lista eies av oss, i newsletter_subscribers. En påmelding er ventende til
 * mottakeren har bekreftet den med lenken i e-posten: slik kan ingen melde på
 * en adresse som ikke er deres egen, og vi kan vise at samtykket er gitt.
 * Bekreftelsen og avmeldingen ligger i /api/newsletter/confirm.
 */
export async function POST(req: NextRequest) {
  const body = await readBody(req);
  if (!body) return rejected();
  const lang = langOf(body);

  if (isBot(body)) return NextResponse.json({ ok: true });

  if (!rateLimit(`newsletter:${clientIp(req)}`, { limit: 3 })) {
    return NextResponse.json({ error: tr(lang, 'For mange forsøk. Prøv igjen om litt.', 'Too many attempts. Please try again shortly.') }, { status: 429 });
  }

  const email = line(body.email, 160).toLowerCase();

  if (!isEmail(email)) {
    return NextResponse.json({ error: tr(lang, 'Skriv inn en gyldig e-postadresse.', 'Please enter a valid email address.') }, { status: 400 });
  }

  const failed = tr(lang, 'Vi klarte ikke å registrere deg nå. Prøv igjen senere.', 'We could not sign you up right now. Please try again later.');

  let token: string | null = null;
  try {
    const supabase = await createServerSupabase(gateHeaders(req));
    const { data, error } = await supabase.rpc('subscribe_newsletter', { p_email: email });

    if (error?.code === 'P0001') {
      // Databasens egne avslag (ugyldig adresse, for mange påmeldinger).
      return NextResponse.json({ error: tr(lang, error.message, failed) }, { status: 400 });
    }
    if (error) {
      console.error('[newsletter] Kunne ikke lagre påmelding:', error.code, error.message);
      return NextResponse.json({ error: failed }, { status: 502 });
    }

    // Nøkkelen kommer bare når det skal sendes en bekreftelse: ikke for en
    // adresse som alt er påmeldt, og ikke når adressen har fått flere i dag.
    if (data && typeof data === 'object' && !Array.isArray(data) && typeof data.token === 'string') {
      token = data.token;
    }
  } catch (error) {
    console.error('[newsletter] Supabase er ikke tilgjengelig – påmelding tapt:', error);
    return NextResponse.json({ error: failed }, { status: 500 });
  }

  if (token) {
    const confirmUrl = `${SITE_URL}/api/newsletter/confirm?t=${token}${lang === 'en' ? '&l=en' : ''}`;
    await sendMail(
      { to: email, replyTo: CONTACT_EMAIL, ...newsletterConfirm({ confirmUrl, lang }) },
      { template: 'newsletter_confirm' },
    );
  }

  // Samme svar uansett, så skjemaet ikke avslører hvem som står på lista.
  return NextResponse.json({ ok: true });
}
