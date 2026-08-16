import { NextRequest, NextResponse } from 'next/server';

type ImagePayload = { name: string; type: string; dataUrl: string };

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, boat, serial, notes, images } = body as {
    name?: string;
    boat?: string;
    serial?: string;
    notes?: string;
    images?: ImagePayload[];
  };

  if (!name || !boat || !serial) {
    return NextResponse.json(
      { error: 'Navn, navn på båt og serienummer er påkrevd' },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = 'arve@astep.no';
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@northwestcoast.no';

  if (apiKey) {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const attachments = (images ?? [])
      .filter((img) => typeof img.dataUrl === 'string' && img.dataUrl.includes(','))
      .map((img) => ({
        filename: img.name,
        content: img.dataUrl.split(',')[1], // base64 uten data-URL-prefiks
      }));

    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Vedlikehold registrert – ${boat} (${serial})`,
      text: [
        `Navn: ${name}`,
        `Navn på båt: ${boat}`,
        `Serienummer på leider: ${serial}`,
        ``,
        `Kommentar:`,
        notes || '–',
        ``,
        `Antall vedlagte bilder: ${attachments.length}`,
      ].join('\n'),
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }

  return NextResponse.json({ ok: true });
}
