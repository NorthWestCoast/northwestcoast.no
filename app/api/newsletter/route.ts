import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, rateLimit } from '@/lib/api-guard';
import { createServiceSupabase, hasServiceRole } from '@/lib/supabase/server';
import { CONTACT_EMAIL, sendMail } from '@/lib/mail';

/**
 * Nyhetsbrevpåmelding.
 *
 * Lista eies nå av oss, i newsletter_subscribers. NWC kjører selve utsendingen
 * og automatiseringen på sin side, så vi trenger ingen tredjeparts audience –
 * vi trenger bare å ikke miste adressen.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (isBot(body)) return NextResponse.json({ ok: true });

  if (!rateLimit(`newsletter:${clientIp(req)}`, { limit: 3 })) {
    return NextResponse.json({ error: 'For mange forsøk. Prøv igjen om litt.' }, { status: 429 });
  }

  const email = clean(body.email, 160).toLowerCase();

  if (!isEmail(email)) {
    return NextResponse.json({ error: 'Skriv inn en gyldig e-postadresse.' }, { status: 400 });
  }

  if (!hasServiceRole()) {
    console.error('[newsletter] Supabase er ikke konfigurert – påmelding tapt:', email);
    return NextResponse.json(
      { error: 'Vi klarte ikke å registrere deg nå. Prøv igjen senere.' },
      { status: 500 },
    );
  }

  const supabase = createServiceSupabase();

  // upsert: en som melder seg på to ganger skal få "du er registrert",
  // ikke en feilmelding om duplikat.
  const { error } = await supabase
    .from('newsletter_subscribers')
    .upsert({ email, source: 'web' }, { onConflict: 'email' });

  if (error) {
    console.error('[newsletter] Kunne ikke lagre påmelding:', error);
    return NextResponse.json(
      { error: 'Vi klarte ikke å registrere deg nå. Prøv igjen senere.' },
      { status: 502 },
    );
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
