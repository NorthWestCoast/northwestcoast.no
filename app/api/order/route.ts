import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, langOf, rateLimit, tr } from '@/lib/api-guard';
import { fetchPriceTable } from '@/lib/catalog';
import {
  cabinetAvailable,
  lineTotal,
  orderTotal,
  rowFor,
  type OrderLine,
  type PriceTable,
} from '@/lib/pricing';
import { createServiceSupabase, hasServiceRole } from '@/lib/supabase/server';
import { ORDER_EMAIL, SUPPORT_PHONE, sendMail } from '@/lib/mail';
import { orderInternal, orderReceipt, type OrderLineView } from '@/lib/mail/templates';

// Signering av opplastings-URL-er og e-postutsending kan ta noen
// sekunder; standardgrensen er knapp når flere bilder er med.
export const maxDuration = 30;

const MAX_LINES = 20;
const MAX_QTY = 99;

const genericError = (lang: 'no' | 'en') =>
  tr(
    lang,
    `Vi klarte ikke å ta imot bestillingen akkurat nå. Ring oss på ${SUPPORT_PHONE}.`,
    `We could not take your order right now. Please call us on ${SUPPORT_PHONE}.`,
  );

/** Plukker ut gyldige ordrelinjer. Priser kommer aldri fra klienten. */
function parseLines(raw: unknown, table: PriceTable): OrderLine[] {
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
    .filter((line) => table.some((row) => row.length === line.length));
}

function toView(lines: OrderLine[], table: PriceTable): OrderLineView[] {
  return lines.map((line) => {
    const row = rowFor(line.length, table);
    return {
      productName: row.productName,
      productNumber: row.productNumber,
      steps: row.steps,
      qty: line.qty,
      cabinetName: line.cabinet ? row.cabinetName : null,
      lineTotal: lineTotal(line, table),
      onRequest: row.onRequest === true,
    };
  });
}

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Målene fra leiderkalkulatoren. Lagres som tekst i notatfeltet så de følger
 * ordren og kan etterprøves før vi bekrefter – de påvirker aldri prisen.
 */
function calculationNote(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';
  const c = raw as Record<string, unknown>;
  const m = (v: unknown) => {
    const n = num(v);
    return n === null ? '–' : `${n} m`;
  };
  return [
    'Fra leiderkalkulatoren:',
    `  Fribord: ${m(c.freeboard)}`,
    `  Festepunkt over dekk: ${m(c.mountHeight)}`,
    `  Tillegg under vannlinjen: ${m(c.margin)}`,
    `  Nødvendig lengde: ${m(c.required)}`,
    `  Valgt lengde: ${m(c.chosenLength)}`,
    `  Fartøystype: ${clean(c.vesselType, 40) || '–'}`,
    `  LOA: ${m(c.loa)}`,
  ].join('\n');
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const lang = langOf(body);

  if (isBot(body)) return NextResponse.json({ ok: true });

  if (!rateLimit(`order:${clientIp(req)}`)) {
    return NextResponse.json(
      { error: tr(lang, `For mange forespørsler. Prøv igjen om noen minutter, eller ring ${SUPPORT_PHONE}.`, `Too many requests. Please try again in a few minutes, or call ${SUPPORT_PHONE}.`) },
      { status: 429 },
    );
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const phone = clean(body.phone, 40);
  const vessel = clean(body.vessel, 160);
  const imo = clean(body.imo, 20);

  if (!name || !email) {
    return NextResponse.json({ error: tr(lang, 'Navn og e-post er påkrevd.', 'Name and email are required.') }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: tr(lang, 'E-postadressen ser ikke gyldig ut.', 'The email address does not look valid.') }, { status: 400 });
  }

  // Databasen er fasit, ikke e-posten. Så lenge raden ligger inne er
  // bestillingen trygg, og en e-post som feiler kan sendes på nytt.
  if (!hasServiceRole()) {
    console.error('[order] Supabase er ikke konfigurert – kan ikke ta imot bestilling.');
    return NextResponse.json({ error: genericError(lang) }, { status: 500 });
  }

  const supabase = createServiceSupabase();

  // Prisen regnes ut av prislista i databasen akkurat nå – ikke fra en
  // mellomlagret kopi og aldri fra klienten. Kan vi ikke lese den, avviser vi
  // heller bestillingen enn å regne med en annen pris enn kunden så.
  let table: PriceTable;
  try {
    table = await fetchPriceTable(supabase);
  } catch (error) {
    console.error('[order] Kunne ikke lese prislista:', error);
    return NextResponse.json({ error: genericError(lang) }, { status: 500 });
  }

  const lines = parseLines(body.items, table).map((line) => ({
    ...line,
    // Skap kan bare bestilles der raden har et tilgjengelig skap.
    cabinet: line.cabinet && cabinetAvailable(rowFor(line.length, table)),
  }));

  if (lines.length === 0) {
    return NextResponse.json({ error: tr(lang, 'Bestillingen er tom.', 'The order is empty.') }, { status: 400 });
  }

  // Kommentar + IMO + kalkulatoroppsett samles i ett notat, så alt følger ordren.
  const requestLines = lines
    .filter((line) => rowFor(line.length, table).onRequest)
    .map((line) => `${line.qty} × ${rowFor(line.length, table).productName} – pris på forespørsel`);
  const notes = [
    clean(body.notes, 2000),
    imo ? `IMO: ${imo}` : '',
    requestLines.length ? `Pris på forespørsel:\n${requestLines.join('\n')}` : '',
    calculationNote(body.calculation),
  ]
    .filter(Boolean)
    .join('\n\n');

  const total = orderTotal(lines, table);
  const units = lines.reduce((sum, line) => sum + line.qty, 0);
  const view = toView(lines, table);

  // ── 1. Lagre bestillingen. Dette er leveransen. ──────────────────────────

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      contact_name: name,
      contact_email: email,
      contact_phone: phone || null,
      vessel_name: vessel || null,
      notes: notes || null,
      total_nok: total,
      source: 'web',
    })
    .select('id, order_number')
    .single();

  if (orderError || !order) {
    console.error('[order] Kunne ikke lagre bestilling:', orderError);
    return NextResponse.json({ error: genericError(lang) }, { status: 500 });
  }

  // Linjer med pris på forespørsel lagres ikke som ordrelinjer (summen ville
  // blitt 0 kr). De står i notatet og i e-posten, og følges opp manuelt.
  const lineRows = lines.flatMap((line) => {
    const row = rowFor(line.length, table);
    if (row.onRequest || !row.productId) return [];
    return [{
      order_id: order.id,
      product_id: row.productId,
      qty: line.qty,
      with_cabinet: line.cabinet,
      unit_price_nok: row.price,
      cabinet_price_nok: line.cabinet ? row.cabinetPrice : 0,
      line_total_nok: lineTotal(line, table),
    }];
  });

  if (lineRows.length > 0) {
    const { error: linesError } = await supabase.from('order_lines').insert(lineRows);
    if (linesError) {
      // Hovedraden finnes, så bestillingen er ikke tapt. Logg og gå videre –
      // detaljene ligger uansett i e-posten til NWC.
      console.error('[order] Kunne ikke lagre ordrelinjer:', linesError);
    }
  }

  // ── 2. Varsle. Feiler dette, er bestillingen fortsatt lagret. ────────────
  const internal = orderInternal({
    orderNumber: order.order_number,
    name, email, phone, vessel, notes,
    lines: view, total, units,
  });

  const internalResult = await sendMail(
    { to: ORDER_EMAIL, replyTo: email, ...internal },
    { template: 'order_internal', relatedType: 'order', relatedId: order.id },
  );

  const receipt = orderReceipt({
    lang,
    orderNumber: order.order_number,
    name, lines: view, total,
  });

  await sendMail(
    { to: email, replyTo: ORDER_EMAIL, ...receipt },
    { template: 'order_receipt', relatedType: 'order', relatedId: order.id },
  );

  return NextResponse.json({
    ok: true,
    orderNumber: order.order_number,
    total,
    units,
    // Bestillingen er mottatt uansett; flagget lar UI-et si fra om kvittering
    // på e-post kan mangle.
    notified: internalResult.ok,
  });
}
