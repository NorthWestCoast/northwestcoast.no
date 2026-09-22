import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, rateLimit } from '@/lib/api-guard';

/**
 * Nyhetsbrevpåmelding.
 *
 * Skjemaet lagret tidligere ingenting – hver påmelding ble kastet. Her går
 * adressen to steder:
 *  1) Resend Audience, hvis RESEND_AUDIENCE_ID er satt (da bygges lista opp
 *     automatisk og kan sendes til fra Resend).
 *  2) Varsel-e-post til NWC, som fallback slik at ingen påmelding går tapt
 *     selv om audience ikke er satt opp ennå.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (isBot(body)) return NextResponse.json({ ok: true });

  if (!rateLimit(`newsletter:${clientIp(req)}`, { limit: 3 })) {
    return NextResponse.json(
      { error: 'For mange forsøk. Prøv igjen om litt.' },
      { status: 429 },
    );
  }

  const email = clean(body.email, 160).toLowerCase();

  if (!isEmail(email)) {
    return NextResponse.json({ error: 'Skriv inn en gyldig e-postadresse.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const toEmail = process.env.CONTACT_TO_EMAIL ?? 'arve@astep.no';
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@northwestcoast.no';

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[newsletter] RESEND_API_KEY mangler – påmelding kunne ikke lagres:', email);
      return NextResponse.json(
        { error: 'Vi klarte ikke å registrere deg nå. Prøv igjen senere.' },
        { status: 500 },
      );
    }
    console.info('[newsletter] Ingen RESEND_API_KEY (dev) – påmelding:', email);
    return NextResponse.json({ ok: true, dev: true });
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  let stored = false;

  if (audienceId) {
    const contact = await resend.contacts
      .create({ email, audienceId, unsubscribed: false })
      .catch((err: unknown) => ({ error: err }));

    if ('error' in contact && contact.error) {
      console.error('[newsletter] Kunne ikke legge til i audience:', contact.error);
    } else {
      stored = true;
    }
  }

  // Varsle NWC uansett – lista er verdiløs hvis noen forsvinner stille.
  const notice = await resend.emails
    .send({
      from: fromEmail,
      to: toEmail,
      subject: `Ny nyhetsbrevpåmelding: ${email}`,
      text: [
        `E-post: ${email}`,
        `Lagt til i Resend Audience: ${stored ? 'ja' : 'nei'}`,
      ].join('\n'),
    })
    .catch((err: unknown) => ({ error: err }));

  if (!stored && 'error' in notice && notice.error) {
    console.error('[newsletter] Påmelding gikk tapt:', notice.error, email);
    return NextResponse.json(
      { error: 'Vi klarte ikke å registrere deg nå. Prøv igjen senere.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
