import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, company, product, message } = body as Record<string, string>;

  if (!name || !email) {
    return NextResponse.json({ error: 'Navn og e-post er påkrevd' }, { status: 400 });
  }

  // If RESEND_API_KEY is configured, send email
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL ?? 'arve@astep.no';
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@northwestcoast.no';

  if (apiKey) {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Ny forespørsel fra ${name} – ${company ?? 'ukjent firma'}`,
      text: [
        `Navn: ${name}`,
        `E-post: ${email}`,
        `Telefon: ${phone ?? '–'}`,
        `Fartøy/Rederi: ${company ?? '–'}`,
        `Produkt: ${product ?? '–'}`,
        ``,
        `Melding:`,
        message ?? '–',
      ].join('\n'),
    });
  }

  return NextResponse.json({ ok: true });
}
