import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, rateLimit, langOf, tr } from '@/lib/api-guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { CONTACT_EMAIL, sendMail } from '@/lib/mail';

/**
 * Nyhetsbrevpåmelding.
 *
 * Lista eies av oss, i newsletter_subscribers. NWC kjører selve utsendingen
 * og automatiseringen på sin side, så vi trenger ingen tredjeparts audience –
 * vi trenger bare å ikke miste adressen.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const lang = langOf(body);

  if (isBot(body)) return NextResponse.json({ ok: true });

  if (!rateLimit(`newsletter:${clientIp(req)}`, { limit: 3 })) {
    return NextResponse.json({ error: tr(lang, 'For mange forsøk. Prøv igjen om litt.', 'Too many attempts. Please try again shortly.') }, { status: 429 });
  }

  const email = clean(body.email, 160).toLowerCase();

  if (!isEmail(email)) {
    return NextResponse.json({ error: tr(lang, 'Skriv inn en gyldig e-postadresse.', 'Please enter a valid email address.') }, { status: 400 });
  }

  const failed = tr(lang, 'Vi klarte ikke å registrere deg nå. Prøv igjen senere.', 'We could not sign you up right now. Please try again later.');

  // subscribe_newsletter() kjører med besøkerens egen (anonyme) sesjon. En som
  // melder seg på to ganger får «du er registrert», ikke en duplikatfeil.
  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.rpc('subscribe_newsletter', { p_email: email });

    if (error?.code === 'P0001') {
      // Databasens egne avslag (ugyldig adresse, for mange påmeldinger).
      return NextResponse.json({ error: tr(lang, error.message, failed) }, { status: 400 });
    }
    if (error) {
      console.error('[newsletter] Kunne ikke lagre påmelding:', error.code, error.message);
      return NextResponse.json({ error: failed }, { status: 502 });
    }
  } catch (error) {
    console.error('[newsletter] Supabase er ikke tilgjengelig – påmelding tapt:', error);
    return NextResponse.json({ error: failed }, { status: 500 });
  }

  // Varsel til NWC er nå ren bekvemmelighet – adressen er allerede trygt lagret.
  await sendMail(
    {
      to: CONTACT_EMAIL,
      subject: `Ny nyhetsbrevpåmelding: ${email}`,
      text: `E-post: ${email}\nLagret i newsletter_subscribers: ja`,
    },
    { template: 'newsletter_notice' },
  );

  return NextResponse.json({ ok: true });
}
