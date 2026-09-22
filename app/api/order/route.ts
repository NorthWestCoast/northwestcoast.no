import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, rateLimit } from '@/lib/api-guard';
import {
  LENGTHS,
  PRICE_TABLE,
  lineTotal,
  orderTotal,
  rowFor,
  type OrderLine,
} from '@/lib/pricing';
import { createServiceSupabase, hasServiceRole } from '@/lib/supabase/server';
import { ORDER_EMAIL, SUPPORT_PHONE, sendMail } from '@/lib/mail';
import { orderInternal, orderReceipt, type OrderLineView } from '@/lib/mail/templates';

// Signering av opplastings-URL-er og e-postutsending kan ta noen
// sekunder; standardgrensen er knapp når flere bilder er med.
export const maxDuration = 30;

const MAX_LINES = 20;
const MAX_QTY = 99;

const GENERIC_ERROR = `Vi klarte ikke å ta imot bestillingen akkurat nå. Ring oss på ${SUPPORT_PHONE}.`;

/** Plukker ut gyldige ordrelinjer. Priser kommer aldri fra klienten. */
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

function toView(lines: OrderLine[]): OrderLineView[] {
  return lines.map((line) => {
    const row = rowFor(line.length);
    return {
      productName: row.productName,
      productNumber: row.productNumber,
      steps: row.steps,
      qty: line.qty,
      cabinetName: line.cabinet ? row.cabinetName : null,
      lineTotal: lineTotal(line),
    };
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (isBot(body)) return NextResponse.json({ ok: true });

  if (!rateLimit(`order:${clientIp(req)}`)) {
    return NextResponse.json(
      { error: `For mange forespørsler. Prøv igjen om noen minutter, eller ring ${SUPPORT_PHONE}.` },
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
  const view = toView(lines);

  // ── 1. Lagre bestillingen. Dette er leveransen. ──────────────────────────
  //
  // Databasen er fasit, ikke e-posten. Så lenge raden ligger inne er
  // bestillingen trygg, og en e-post som feiler kan sendes på nytt.
  if (!hasServiceRole()) {
    console.error('[order] Supabase er ikke konfigurert – kan ikke ta imot bestilling.');
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }

  const supabase = createServiceSupabase();

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
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }

  // Produkt-ID-ene slås opp fra katalogen, slik at ordrelinjene peker på
  // ekte produkter og ikke bare en tekststreng.
  const { data: products } = await supabase
    .from('products')
    .select('id, product_number, price_nok');

  const productIdByNumber = new Map(
    (products ?? []).map((p) => [p.product_number, p.id]),
  );

  // Prisene finnes nå to steder: lib/pricing.ts (som konfiguratoren viser
  // kunden) og products-tabellen. lib/pricing.ts vinner her – kunden skal få
  // prisen hun faktisk så – men et avvik betyr at katalogen har drevet fra
  // koden, og det må oppdages med én gang, ikke ved neste avstemming.
  for (const product of products ?? []) {
    const row = PRICE_TABLE.find((r) => r.productNumber === product.product_number);
    if (row && row.price !== product.price_nok) {
      console.error(
        `[order] PRISAVVIK ${product.product_number}: lib/pricing.ts=${row.price} ` +
          `products.price_nok=${product.price_nok}. Katalogen må avstemmes.`,
      );
    }
  }

  const lineRows = lines.flatMap((line) => {
    const row = rowFor(line.length);
    const productId = productIdByNumber.get(row.productNumber);
    if (!productId) return [];
    return [{
      order_id: order.id,
      product_id: productId,
      qty: line.qty,
      with_cabinet: line.cabinet,
      unit_price_nok: row.price,
      cabinet_price_nok: line.cabinet ? row.cabinetPrice : 0,
      line_total_nok: lineTotal(line),
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
