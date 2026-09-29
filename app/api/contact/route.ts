import { NextRequest, NextResponse } from 'next/server';
import { CONTACT_TO_EMAIL, notConfiguredMessage, resolveLang, sendMail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, company, product, message, lang: rawLang } =
    body as Record<string, string>;
  const lang = resolveLang(rawLang);

  if (!name || !email) {
    return NextResponse.json({ error: 'Navn og e-post er påkrevd' }, { status: 400 });
  }

  try {
    const delivered = await sendMail({
      to: CONTACT_TO_EMAIL,
      replyTo: email,
      subject: `Ny forespørsel fra ${name} – ${company || 'ukjent firma'}`,
      text: [
        `Navn: ${name}`,
        `E-post: ${email}`,
        `Telefon: ${phone || '–'}`,
        `Fartøy/Rederi: ${company || '–'}`,
        `Produkt: ${product || '–'}`,
        `Språk: ${lang}`,
        ``,
        `Melding:`,
        message || '–',
      ].join('\n'),
    });

    if (!delivered) {
      return NextResponse.json({ error: notConfiguredMessage(lang) }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ error: notConfiguredMessage(lang) }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
