import { NextRequest, NextResponse } from 'next/server';
import { CONTACT_TO_EMAIL, notConfiguredMessage, resolveLang, sendMail } from '@/lib/email';
import { orderReceipt } from '@/lib/email-copy';
import { PRICE_TABLE, fmt, rowFor, unitPrice } from '@/lib/pricing';

type OrderItem = { length: number; qty: number; cabinet: boolean };

/** Sendes fra leiderkalkulatoren, slik at vi kan etterprøve målene. */
type Calculation = {
  freeboard?: number;
  mountHeight?: number;
  margin?: number;
  required?: number;
  chosenLength?: number;
  vesselType?: string;
  loa?: number;
};

const m = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? `${value} m` : '–';

const VALID_LENGTHS = new Set(PRICE_TABLE.map((r) => r.length));

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, company, imo, notes, items, calculation, lang: rawLang } = body as {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    imo?: string;
    notes?: string;
    items?: OrderItem[];
    calculation?: Calculation;
    lang?: string;
  };

  const lang = resolveLang(rawLang);

  if (!name || !email) {
    return NextResponse.json({ error: 'Navn og e-post er påkrevd' }, { status: 400 });
  }

  // Sanér linjene og regn ut summen på nytt – klienten bestemmer ikke prisen.
  const lines = (items ?? [])
    .filter((it) => VALID_LENGTHS.has(Number(it?.length)))
    .map((it) => {
      const row = rowFor(Number(it.length));
      const qty = Math.min(Math.max(Math.round(Number(it.qty) || 1), 1), 99);
      const cabinet = Boolean(it.cabinet) && !row.onRequest;
      return {
        row,
        qty,
        cabinet,
        total: unitPrice(row, cabinet) * qty,
      };
    });

  if (lines.length === 0) {
    return NextResponse.json({ error: 'Bestillingen er tom' }, { status: 400 });
  }

  const grandTotal = lines.reduce((sum, l) => sum + l.total, 0);
  const totalQty = lines.reduce((sum, l) => sum + l.qty, 0);

  const itemLines = lines.map(
    (l) =>
      l.row.onRequest
        ? `${l.qty} × ${l.row.productName} – pris på forespørsel`
        : `${l.qty} × ${l.row.productName} (produktnr. ${l.row.productNumber}, ${l.row.steps} trinn)` +
          `${l.cabinet ? ` + oppbevaringsskap ${l.row.cabinetName}` : ''} – ${fmt(l.total)} kr`,
  );

  const calcLines = calculation
    ? [
        ``,
        `Fra leiderkalkulatoren:`,
        `  Fribord: ${m(calculation.freeboard)}`,
        `  Festepunkt over dekk: ${m(calculation.mountHeight)}`,
        `  Tillegg under vannlinjen: ${m(calculation.margin)}`,
        `  Nødvendig lengde: ${m(calculation.required)}`,
        `  Valgt lengde: ${m(calculation.chosenLength)}`,
        `  Fartøystype: ${calculation.vesselType ?? '–'}`,
        `  LOA: ${m(calculation.loa)}`,
      ]
    : [];

  const summary = [
    ...itemLines,
    ``,
    `Totalsum: ${fmt(grandTotal)} kr eks. mva (veiledende)${lines.some((l) => l.row.onRequest) ? ' – eksl. linjer med pris på forespørsel' : ''}`,
  ].join('\n');

  let delivered = false;
  try {
    delivered = await sendMail({
      to: CONTACT_TO_EMAIL,
      replyTo: email,
      subject: `Ny bestilling: ${totalQty} leider(e) – ${company || name} (${fmt(grandTotal)} kr)`,
      text: [
        `Navn: ${name}`,
        `E-post: ${email}`,
        `Telefon: ${phone || '–'}`,
        `Fartøy/Rederi: ${company || '–'}`,
        `IMO nr: ${imo || '–'}`,
        ``,
        `Bestilling:`,
        summary,
        ``,
        `Kommentar:`,
        notes || '–',
        ...calcLines,
      ].join('\n'),
    });
  } catch {
    return NextResponse.json({ error: notConfiguredMessage(lang) }, { status: 502 });
  }

  if (!delivered) {
    return NextResponse.json({ error: notConfiguredMessage(lang) }, { status: 503 });
  }

  // Kvittering til kunden. Bestillingen er allerede mottatt hos oss, så en
  // feil her skal ikke få kunden til å bestille på nytt.
  try {
    const receipt = orderReceipt(lang, { name, summary });
    await sendMail({
      to: email,
      replyTo: CONTACT_TO_EMAIL,
      subject: receipt.subject,
      text: receipt.text,
    });
  } catch {
    // Ignorert med vilje – kvitteringen er en bonus, ikke et krav.
  }

  return NextResponse.json({ ok: true });
}
