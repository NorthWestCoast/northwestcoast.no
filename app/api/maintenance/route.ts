import { NextRequest, NextResponse } from 'next/server';
import { CONTACT_TO_EMAIL, notConfiguredMessage, resolveLang, sendMail } from '@/lib/email';
import { maintenanceReceipt } from '@/lib/email-copy';

type ImagePayload = { name: string; type: string; dataUrl: string };

const MAX_IMAGES = 10;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, boat, imo, serial, notes, reminder, images, lang: rawLang } = body as {
    name?: string;
    email?: string;
    boat?: string;
    imo?: string;
    serial?: string;
    notes?: string;
    reminder?: boolean;
    images?: ImagePayload[];
    lang?: string;
  };

  const lang = resolveLang(rawLang);

  if (!name || !boat || !serial) {
    return NextResponse.json(
      { error: 'Navn, navn på båt og serienummer er påkrevd' },
      { status: 400 },
    );
  }

  const wantsReceipt = Boolean(email && EMAIL_RE.test(email));

  // Bare bilder, og bare så mye som e-posten tåler.
  let totalBytes = 0;
  const attachments = (images ?? [])
    .filter(
      (img) =>
        typeof img?.dataUrl === 'string' &&
        img.dataUrl.startsWith('data:image/') &&
        img.dataUrl.includes(','),
    )
    .slice(0, MAX_IMAGES)
    .map((img) => ({ filename: img.name, content: img.dataUrl.split(',')[1] }))
    .filter((att) => {
      totalBytes += Math.ceil((att.content.length * 3) / 4);
      return totalBytes <= MAX_TOTAL_BYTES;
    });

  const registered = new Date().toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const record = [
    `Dato: ${registered}`,
    `Navn: ${name}`,
    `E-post: ${email || '–'}`,
    `Navn på båt: ${boat}`,
    `IMO nr: ${imo || '–'}`,
    `Serienummer på leider: ${serial}`,
    ``,
    `Kommentar:`,
    notes || '–',
  ].join('\n');

  try {
    const delivered = await sendMail({
      to: CONTACT_TO_EMAIL,
      replyTo: wantsReceipt ? email : undefined,
      subject: `Vedlikehold registrert – ${boat} (${serial})`,
      text: [
        record,
        ``,
        `Ønsker påminnelse før neste vedlikehold: ${reminder && wantsReceipt ? 'Ja' : 'Nei'}`,
        `Antall vedlagte bilder: ${attachments.length}`,
      ].join('\n'),
      attachments,
    });

    if (!delivered) {
      return NextResponse.json({ error: notConfiguredMessage(lang) }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ error: notConfiguredMessage(lang) }, { status: 502 });
  }

  // Kvittering kunden kan legge ved i fartøyets vedlikeholdsdokumentasjon.
  if (wantsReceipt) {
    try {
      const receipt = maintenanceReceipt(lang, {
        name,
        boat,
        serial,
        record,
        reminder: Boolean(reminder),
      });
      await sendMail({
        to: email as string,
        replyTo: CONTACT_TO_EMAIL,
        subject: receipt.subject,
        text: receipt.text,
      });
    } catch {
      // Kvitteringen er en bonus – registreringen er allerede mottatt.
    }
  }

  return NextResponse.json({ ok: true });
}
