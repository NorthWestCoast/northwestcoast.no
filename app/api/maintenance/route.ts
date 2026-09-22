import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, rateLimit } from '@/lib/api-guard';

type ImagePayload = { name: string; type: string; dataUrl: string };

const MAX_IMAGES = 8;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (isBot(body)) return NextResponse.json({ ok: true });

  if (!rateLimit(`maintenance:${clientIp(req)}`)) {
    return NextResponse.json(
      { error: 'For mange forsøk. Prøv igjen om noen minutter.' },
      { status: 429 },
    );
  }

  const name = clean(body.name, 120);
  const boat = clean(body.boat, 160);
  const imo = clean(body.imo, 20);
  const serial = clean(body.serial, 60);
  const email = clean(body.email, 160);
  const notes = clean(body.notes, 4000);
  const images = (Array.isArray(body.images) ? body.images : []) as ImagePayload[];

  if (!name || !boat || !serial) {
    return NextResponse.json(
      { error: 'Navn, navn på båt og serienummer er påkrevd' },
      { status: 400 },
    );
  }
  if (email && !isEmail(email)) {
    return NextResponse.json({ error: 'E-postadressen ser ikke gyldig ut.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.MAINTENANCE_TO_EMAIL ?? process.env.CONTACT_TO_EMAIL ?? 'arve@astep.no';
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@northwestcoast.no';

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[maintenance] RESEND_API_KEY mangler – rapport kunne ikke leveres');
      return NextResponse.json(
        { error: 'Vi klarte ikke å sende rapporten nå. Ring oss på +47 904 07 341.' },
        { status: 500 },
      );
    }
    console.info('[maintenance] Ingen RESEND_API_KEY (dev) – rapport:', { name, boat, serial });
    return NextResponse.json({ ok: true, dev: true });
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  const attachments = images
    .slice(0, MAX_IMAGES)
    .filter((img) => typeof img?.dataUrl === 'string' && img.dataUrl.includes(','))
    .map((img) => ({
      filename: clean(img.name, 120) || 'bilde.jpg',
      content: img.dataUrl.split(',')[1], // base64 uten data-URL-prefiks
    }));

  const report = [
    `Navn: ${name}`,
    `Navn på båt: ${boat}`,
    `IMO nr: ${imo || '–'}`,
    `Serienummer på leider: ${serial}`,
    `E-post: ${email || '–'}`,
    ``,
    `Kommentar:`,
    notes || '–',
    ``,
    `Antall vedlagte bilder: ${attachments.length}`,
  ].join('\n');

  const result = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    replyTo: email || undefined,
    subject: `Vedlikehold registrert – ${boat} (${serial})`,
    text: report,
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  if (result.error) {
    console.error('[maintenance] Kunne ikke sende e-post:', result.error);
    return NextResponse.json(
      { error: 'Vi klarte ikke å sende rapporten nå. Ring oss på +47 904 07 341.' },
      { status: 502 },
    );
  }

  // Kvittering til fartøyet – dokumentasjon de kan vise ved tilsyn.
  if (email) {
    const receipt = await resend.emails
      .send({
        from: fromEmail,
        to: email,
        replyTo: toEmail,
        subject: `Kvittering: vedlikehold registrert – ${boat} (${serial})`,
        text: [
          `Hei ${name},`,
          ``,
          `Vi har registrert utført vedlikehold på Argostep-leideren deres.`,
          `Ta vare på denne e-posten som dokumentasjon.`,
          ``,
          report,
          ``,
          `Med vennlig hilsen`,
          `NorthWest Coast AS`,
        ].join('\n'),
      })
      .catch((err: unknown) => ({ error: err }));

    if ('error' in receipt && receipt.error) {
      console.error('[maintenance] Kunne ikke sende kvittering:', receipt.error);
    }
  }

  return NextResponse.json({ ok: true });
}
