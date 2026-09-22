import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, rateLimit } from '@/lib/api-guard';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (isBot(body)) return NextResponse.json({ ok: true });

  if (!rateLimit(`contact:${clientIp(req)}`)) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om noen minutter, eller ring +47 904 07 341.' },
      { status: 429 },
    );
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const phone = clean(body.phone, 40);
  const company = clean(body.company, 160);
  const product = clean(body.product, 120);
  const message = clean(body.message, 4000);

  if (!name || !email) {
    return NextResponse.json({ error: 'Navn og e-post er påkrevd' }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: 'E-postadressen ser ikke gyldig ut.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL ?? 'arve@astep.no';
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@northwestcoast.no';

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[contact] RESEND_API_KEY mangler – henvendelse kunne ikke leveres');
      return NextResponse.json(
        { error: 'Vi klarte ikke å sende meldingen nå. Ring oss på +47 904 07 341.' },
        { status: 500 },
      );
    }
    console.info('[contact] Ingen RESEND_API_KEY (dev) – henvendelse:', { name, email, message });
    return NextResponse.json({ ok: true, dev: true });
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  // replyTo gjør at "Svar" i innboksen går rett til kunden.
  const result = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    replyTo: email,
    subject: `Ny forespørsel fra ${name} – ${company || 'ukjent firma'}`,
    text: [
      `Navn: ${name}`,
      `E-post: ${email}`,
      `Telefon: ${phone || '–'}`,
      `Fartøy/Rederi: ${company || '–'}`,
      `Produkt: ${product || '–'}`,
      ``,
      `Melding:`,
      message || '–',
    ].join('\n'),
  });

  if (result.error) {
    console.error('[contact] Kunne ikke sende e-post:', result.error);
    return NextResponse.json(
      { error: 'Vi klarte ikke å sende meldingen nå. Ring oss på +47 904 07 341.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
