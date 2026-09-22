import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, rateLimit } from '@/lib/api-guard';
import { LENGTHS, fmt, lineTotal, orderTotal, rowFor, type OrderLine } from '@/lib/pricing';

const MAX_LINES = 20;
const MAX_QTY = 99;

/** Plukker ut gyldige ordrelinjer. Alt annet forkastes – priser kommer aldri fra klienten. */
function parseLines(raw: unknown): OrderLine[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .slice(0, MAX_LINES)
    .map((item) => {
      const line = item as Record<string, unknown>;
      return {
        length: Number(line.length),
        qty: Math.min(MAX_QTY, Math.max(1, Math.round(Number(line.qty) || 1))),
        cabinet: line.cabinet === true,
      };
    })
    .filter((line) => LENGTHS.includes(line.length));
}

function orderSummary(lines: OrderLine[]): string {
  return lines
    .map((line) => {
      const row = rowFor(line.length);
      const parts = [
        `${line.qty} × ${row.productName} (${row.productNumber}, ${row.steps} trinn)`,
        line.cabinet ? `  + Oppbevaringsskap ${row.cabinetName} (${row.cabinetNumber})` : null,
        `  Sum: ${fmt(lineTotal(line))} kr`,
      ];
      return parts.filter(Boolean).join('\n');
    })
    .join('\n\n');
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Bot fanget av honeypot: svar 200 uten å sende noe.
  if (isBot(body)) return NextResponse.json({ ok: true });

  if (!rateLimit(`order:${clientIp(req)}`)) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om noen minutter, eller ring +47 904 07 341.' },
      { status: 429 },
    );
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const phone = clean(body.phone, 40);
  const vessel = clean(body.vessel, 160);
  const notes = clean(body.notes, 2000);
  const lines = parseLines(body.items);

  if (!name || !email) {
    return NextResponse.json({ error: 'Navn og e-post er påkrevd.' }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: 'E-postadressen ser ikke gyldig ut.' }, { status: 400 });
  }
  if (lines.length === 0) {
    return NextResponse.json({ error: 'Bestillingen er tom.' }, { status: 400 });
  }

  const total = orderTotal(lines);
  const units = lines.reduce((sum, line) => sum + line.qty, 0);

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.ORDER_TO_EMAIL ?? process.env.CONTACT_TO_EMAIL ?? 'arve@astep.no';
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@northwestcoast.no';

  if (!apiKey) {
    // Uten nøkkel kan vi ikke levere bestillingen. Da skal kunden IKKE få
    // "takk, vi har mottatt" – da er forespørselen tapt uten at noen vet det.
    if (process.env.NODE_ENV === 'production') {
      console.error('[order] RESEND_API_KEY mangler – bestilling kunne ikke leveres');
      return NextResponse.json(
        { error: 'Vi klarte ikke å sende bestillingen akkurat nå. Ring oss på +47 904 07 341.' },
        { status: 500 },
      );
    }
    console.info('[order] Ingen RESEND_API_KEY (dev) – bestilling:', { name, email, lines, total });
    return NextResponse.json({ ok: true, total, units, dev: true });
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  const internalText = [
    `Ny bestillingsforespørsel fra nettsiden`,
    ``,
    `Kunde:     ${name}`,
    `E-post:    ${email}`,
    `Telefon:   ${phone || '–'}`,
    `Fartøy/Rederi: ${vessel || '–'}`,
    ``,
    `--- Bestilling (${units} leider(e)) ---`,
    ``,
    orderSummary(lines),
    ``,
    `TOTALSUM: ${fmt(total)} kr eks. mva.`,
    ``,
    `--- Kommentar ---`,
    notes || '–',
  ].join('\n');

  // Intern e-post er selve leveransen. Feiler den, feiler forespørselen.
  const internal = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    replyTo: email,
    subject: `Bestilling: ${units} leider(e) – ${fmt(total)} kr – ${vessel || name}`,
    text: internalText,
  });

  if (internal.error) {
    console.error('[order] Kunne ikke sende intern e-post:', internal.error);
    return NextResponse.json(
      { error: 'Vi klarte ikke å sende bestillingen akkurat nå. Ring oss på +47 904 07 341.' },
      { status: 502 },
    );
  }

  // Kvittering til kunden. Feiler den er bestillingen likevel trygt inne hos
  // oss, så vi logger og lar kunden få bekreftelsen sin.
  const receipt = await resend.emails
    .send({
      from: fromEmail,
      to: email,
      replyTo: toEmail,
      subject: 'Vi har mottatt bestillingsforespørselen din – NorthWest Coast',
      text: [
        `Hei ${name},`,
        ``,
        `Takk for forespørselen! Vi har mottatt følgende og tar kontakt for bekreftelse og leveringstid.`,
        ``,
        orderSummary(lines),
        ``,
        `Totalsum: ${fmt(total)} kr eks. mva.`,
        ``,
        `Prisene er veiledende. Endelig tilbud bekreftes av oss.`,
        ``,
        `Trenger du oss raskt: +47 904 07 341 / ${toEmail}`,
        ``,
        `Med vennlig hilsen`,
        `NorthWest Coast AS`,
        `Postboks 79, 6281 Søvik`,
      ].join('\n'),
    })
    .catch((err: unknown) => ({ error: err }));

  if ('error' in receipt && receipt.error) {
    console.error('[order] Kunne ikke sende kvittering til kunde:', receipt.error);
  }

  return NextResponse.json({ ok: true, total, units });
}
