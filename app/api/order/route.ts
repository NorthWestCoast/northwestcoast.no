import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, langOf, rateLimit, tr } from '@/lib/api-guard';
import { fetchPriceTable } from '@/lib/catalog';
import { cabinetAvailable, type OrderLine, type PriceRow, type PriceTable } from '@/lib/pricing';
import { createServerSupabase } from '@/lib/supabase/server';
import { ORDER_EMAIL, SUPPORT_PHONE, sendMail } from '@/lib/mail';
import { orderInternal, orderReceipt, type OrderLineView } from '@/lib/mail/templates';

// E-postutsendingen kan ta noen sekunder; standardgrensen er knapp.
export const maxDuration = 30;

const MAX_LINES = 20;
const MAX_QTY = 99;

const genericError = (lang: 'no' | 'en') =>
  tr(
    lang,
    `Vi klarte ikke å ta imot bestillingen akkurat nå. Ring oss på ${SUPPORT_PHONE}.`,
    `We could not take your order right now. Please call us on ${SUPPORT_PHONE}.`,
  );

type ParsedLine = OrderLine & { row: PriceRow };

/** Plukker ut gyldige ordrelinjer. Priser kommer aldri fra klienten. */
function parseLines(raw: unknown, table: PriceTable): ParsedLine[] {
  if (!Array.isArray(raw)) return [];

  return raw.slice(0, MAX_LINES).flatMap((item) => {
    const line = (item ?? {}) as Record<string, unknown>;
    const length = Number(line.length);
    const row = table.find((r) => r.length === length);
    if (!row) return [];

    return [{
      length,
      qty: Math.min(MAX_QTY, Math.max(1, Math.round(Number(line.qty) || 1))),
      // Skap kan bare bestilles der raden har et tilgjengelig skap.
      cabinet: line.cabinet === true && cabinetAvailable(row),
      row,
    }];
  });
}

/** Linjene slik place_order returnerer dem, med prisene databasen regnet ut. */
type PlacedLine = {
  product_number: string;
  name: string;
  steps: number | null;
  qty: number;
  with_cabinet: boolean;
  cabinet_name: string | null;
  line_total_nok: number;
  on_request: boolean;
};

type PlacedOrder = {
  id: string;
  order_number: string;
  total_nok: number;
  units: number;
  lines: PlacedLine[];
};

function isPlacedOrder(value: unknown): value is PlacedOrder {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const order = value as Record<string, unknown>;
  return typeof order.id === 'string'
    && typeof order.order_number === 'string'
    && typeof order.total_nok === 'number'
    && typeof order.units === 'number'
    && Array.isArray(order.lines);
}

/** Skapmodellen uten «Oppbevaringsskap »-prefikset, slik malene forventer. */
const cabinetModel = (name: string | null) =>
  name ? name.replace(/^Oppbevaringsskap\s+/i, '').trim() : null;

function toView(lines: PlacedLine[]): OrderLineView[] {
  return lines.map((line) => ({
    productName: line.name,
    productNumber: line.product_number,
    steps: line.steps,
    qty: line.qty,
    cabinetName: line.with_cabinet ? cabinetModel(line.cabinet_name) : null,
    lineTotal: line.line_total_nok,
    onRequest: line.on_request === true,
  }));
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

/**
 * Tar imot en bestilling fra nettsiden eller kalkulatoren.
 *
 * Ruten kjører med besøkerens egen sesjon (anonym eller innlogget), uten
 * service-role. Selve bestillingen legges inn av place_order() i databasen,
 * som leser prisene fra katalogen og regner ut summen selv. Ruten oversetter
 * bare lengde til produkt, og sender e-post etterpå.
 */
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

  // Prislista leses fra databasen akkurat nå – ikke fra en mellomlagret kopi
  // og aldri fra klienten. Kan vi ikke lese den, avviser vi heller bestillingen
  // enn å gjette hvilket produkt kunden mente.
  let supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  let table: PriceTable;
  try {
    supabase = await createServerSupabase();
    table = await fetchPriceTable(supabase);
  } catch (error) {
    console.error('[order] Kunne ikke lese prislista:', error);
    return NextResponse.json({ error: genericError(lang) }, { status: 500 });
  }

  const lines = parseLines(body.items, table);

  if (lines.length === 0) {
    return NextResponse.json({ error: tr(lang, 'Bestillingen er tom.', 'The order is empty.') }, { status: 400 });
  }

  // En rad uten produkt-id kommer fra reservelista, ikke fra databasen. Den
  // kan ikke bestilles, for da finnes det ikke noe produkt å knytte linja til.
  if (lines.some((line) => !line.row.productId)) {
    console.error('[order] Prislista mangler produkt-id – bestillingen ble avvist.');
    return NextResponse.json({ error: genericError(lang) }, { status: 500 });
  }

  const comment = clean(body.notes, 2000);
  const calculation = calculationNote(body.calculation);
  // IMO har sitt eget felt på ordren, og linjer med pris på forespørsel lagres
  // som ordrelinjer. Notatet er derfor bare kundens kommentar og kalkulatoren.
  const notes = [comment, calculation].filter(Boolean).join('\n\n');

  // ── 1. Lagre bestillingen. Dette er leveransen. ──────────────────────────
  const { data, error } = await supabase.rpc('place_order', {
    payload: {
      name,
      email,
      phone,
      vessel,
      imo,
      notes,
      source: calculation ? 'calculator' : 'web',
      items: lines.map((line) => ({
        product_id: line.row.productId as string,
        qty: line.qty,
        with_cabinet: line.cabinet,
      })),
    },
  });

  if (error) {
    // P0001 er databasens egne, ferdig formulerte avslag (tom bestilling,
    // utgått produkt, for mange bestillinger). De er på norsk.
    if (error.code === 'P0001') {
      return NextResponse.json({ error: lang === 'no' ? error.message : genericError('en') }, { status: 400 });
    }
    console.error('[order] Kunne ikke lagre bestilling:', error.code, error.message);
    return NextResponse.json({ error: genericError(lang) }, { status: 500 });
  }

  if (!isPlacedOrder(data)) {
    console.error('[order] Uventet svar fra place_order:', data);
    return NextResponse.json({ error: genericError(lang) }, { status: 500 });
  }

  // Databasens tall er fasit, også i e-postene.
  const { id: orderId, order_number: orderNumber, total_nok: total, units } = data;
  const view = toView(data.lines);

  // ── 2. Varsle. Feiler dette, er bestillingen fortsatt lagret. ────────────
  let notified = false;
  try {
    const requestLines = view
      .filter((line) => line.onRequest)
      .map((line) => `${line.qty} × ${line.productName} – pris på forespørsel`);
    // E-posten til NWC samler alt på ett sted, slik den alltid har gjort.
    const mailNotes = [
      comment,
      imo ? `IMO: ${imo}` : '',
      requestLines.length ? `Pris på forespørsel:\n${requestLines.join('\n')}` : '',
      calculation,
    ]
      .filter(Boolean)
      .join('\n\n');

    const internal = orderInternal({
      orderNumber,
      name, email, phone, vessel,
      notes: mailNotes,
      lines: view, total, units,
    });
    const internalResult = await sendMail(
      { to: ORDER_EMAIL, replyTo: email, ...internal },
      { template: 'order_internal', relatedType: 'order', relatedId: orderId },
    );
    notified = internalResult.ok;

    const receipt = orderReceipt({ lang, orderNumber, name, lines: view, total });
    await sendMail(
      { to: email, replyTo: ORDER_EMAIL, ...receipt },
      { template: 'order_receipt', relatedType: 'order', relatedId: orderId },
    );
  } catch (mailError) {
    console.error('[order] E-post feilet for', orderNumber, mailError);
  }

  return NextResponse.json({
    ok: true,
    orderNumber,
    total,
    units,
    // Bestillingen er mottatt uansett; flagget lar UI-et si fra om kvittering
    // på e-post kan mangle.
    notified,
  });
}
