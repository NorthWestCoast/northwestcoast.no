import { NextRequest, NextResponse } from 'next/server';
import { CONTACT_TO_EMAIL, notConfiguredMessage, resolveLang, sendMail } from '@/lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, lang: rawLang } = body as { email?: string; lang?: string };
  const lang = resolveLang(rawLang);

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: lang === 'en' ? 'Invalid email address' : 'Ugyldig e-postadresse' },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  if (!apiKey) {
    return NextResponse.json({ error: notConfiguredMessage(lang) }, { status: 503 });
  }

  try {
    if (audienceId) {
      // Legg påmeldingen rett i listen, slik at nyhetsbrevet kan sendes derfra.
      const { Resend } = await import('resend');
      const { error } = await new Resend(apiKey).contacts.create({
        audienceId,
        email,
        unsubscribed: false,
      });
      if (error) throw new Error(error.message);
    } else {
      // Ingen liste satt opp ennå – send påmeldingen på e-post så den ikke går tapt.
      await sendMail({
        to: CONTACT_TO_EMAIL,
        replyTo: email,
        subject: `Ny nyhetsbrev-påmelding: ${email}`,
        text: `${email} har meldt seg på nyhetsbrevet på northwestcoast.no (språk: ${lang}).`,
      });
    }
  } catch {
    return NextResponse.json({ error: notConfiguredMessage(lang) }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
