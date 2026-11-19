import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, langOf, rateLimit, tr } from '@/lib/api-guard';
import { fetchCatalog, type Catalog } from '@/lib/catalog';
import { cabinetAvailable, isCustomLength, type CabinetRow, type PriceRow } from '@/lib/pricing';
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

/**
 * En linje slik klienten sender den, tolket mot katalogen:
 *  - standard: en lengde som står i prislista
 *  - custom:   en halvmeter (eller annen lengde utenom lista), på forespørsel
 *  - cabinet:  et oppbevaringsskap bestilt alene, uten leider
 */
type ParsedLine =
  | { type: 'standard'; row: PriceRow; qty: number; cabinet: boolean }
  | { type: 'custom'; length: number; qty: number; cabinet: boolean }
  | { type: 'cabinet'; product: CabinetRow; qty: number };

/**
 * Tolker ordrelinjene. Priser kommer aldri fra klienten. Null betyr at minst
 * én linje ikke lar seg tolke: da avvises hele bestillingen, heller enn at en
 * linje kunden ba om forsvinner i stillhet.
 */
function parseLines(raw: unknown, catalog: Catalog): ParsedLine[] | null {
  if (!Array.isArray(raw)) return [];

  const lines: ParsedLine[] = [];
  for (const item of raw.slice(0, MAX_LINES)) {
    const line = (item ?? {}) as Record<string, unknown>;
    const qty = Math.min(MAX_QTY, Math.max(1, Math.round(Number(line.qty) || 1)));

    // Skap alene: { cabinetNumber: 'ASC-LC3-5', qty }.
    if (line.cabinetNumber !== undefined && line.cabinetNumber !== null) {
      const number = clean(line.cabinetNumber, 60).toUpperCase();
      const product = catalog.cabinets.find((c) => c.productNumber.toUpperCase() === number);
      if (!product) return null;
      lines.push({ type: 'cabinet', product, qty });
      continue;
    }

    const length = Number(line.length);
    const row = catalog.table.find((r) => r.length === length);
    if (row) {
      // Skap kan bare bestilles der raden har et tilgjengelig skap.
      lines.push({ type: 'standard', row, qty, cabinet: line.cabinet === true && cabinetAvailable(row) });
    } else if (isCustomLength(length)) {
      // Ikke i prislista: spesiallengde. Databasen finner skapet som passer.
      lines.push({ type: 'custom', length, qty, cabinet: line.cabinet === true });
    } else {
      return null;
    }
  }
  return lines;
}

/** Linjene slik place_order returnerer dem, med prisene databasen regnet ut. */
type PlacedLine = {
  product_number: string;
  name: string;
  kind?: 'ladder' | 'cabinet' | 'spare_part';
  custom_length_m?: number | null;
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
    kind: line.kind ?? 'ladder',
    customLength: typeof line.custom_length_m === 'number' ? line.custom_length_m : null,
    steps: line.steps,
    qty: line.qty,
    cabinetName: line.with_cabinet ? cabinetModel(line.cabinet_name) : null,
    lineTotal: line.line_total_nok,
    onRequest: line.on_request === true,
  }));
}

const num = (value: unknown) => {
  // Number(null) og Number('') er 0; et felt som mangler skal ikke bli «0 m».
  if (value === null || value === undefined || value === '') return null;
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
  const deg = (v: unknown) => {
    const n = num(v);
    return n === null ? '–' : `${n}°`;
  };
  // Tillegget regnes ut av bredde og krengevinkel, eller settes for hånd. Er
  // det satt for hånd, er krengevinkelen ikke brukt i regnestykket.
  const manual = c.marginManual === true;
  const marginSource = manual
    ? ' (satt for hånd)'
    : c.marginManual === false ? ' (regnet ut fra bredde og krengevinkel)' : '';
  return [
    'Fra leiderkalkulatoren:',
    `  Fribord: ${m(c.freeboard)}`,
    `  Festepunkt over dekk: ${m(c.mountHeight)}`,
    `  Bredde: ${m(c.beam)}`,
    `  Krengevinkel: ${deg(c.heelDeg)}${manual && num(c.heelDeg) !== null ? ' (ikke brukt)' : ''}`,
    `  Tillegg under vannlinjen: ${m(c.margin)}${marginSource}`,
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
 * bare lengde og skapnummer til produkt, og sender e-post etterpå.
 *
 * Linjene i `items`:
 *   { length, qty, cabinet }    leider. Lengden er en standardlengde eller en
 *                               halvmeter (4.5); halvmetere går på forespørsel.
 *   { cabinetNumber, qty }      oppbevaringsskap alene, uten leider.
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
  let catalog: Catalog;
  try {
    supabase = await createServerSupabase();
    catalog = await fetchCatalog(supabase);
  } catch (error) {
    console.error('[order] Kunne ikke lese prislista:', error);
    return NextResponse.json({ error: genericError(lang) }, { status: 500 });
  }

  const lines = parseLines(body.items, catalog);

  if (lines === null) {
    return NextResponse.json(
      {
        error: tr(
          lang,
          'En linje i bestillingen er ikke gyldig lenger. Last siden på nytt og prøv igjen.',
          'A line in the order is no longer valid. Reload the page and try again.',
        ),
      },
      { status: 400 },
    );
  }
  if (lines.length === 0) {
    return NextResponse.json({ error: tr(lang, 'Bestillingen er tom.', 'The order is empty.') }, { status: 400 });
  }

  // En rad uten produkt-id kommer fra reservelista, ikke fra databasen. Den
  // kan ikke bestilles, for da finnes det ikke noe produkt å knytte linja til.
  if (lines.some((line) => line.type === 'standard' && !line.row.productId)) {
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
      items: lines.map((line) => {
        switch (line.type) {
          case 'custom':
            return { custom_length_m: line.length, qty: line.qty, with_cabinet: line.cabinet };
          case 'cabinet':
            return { product_id: line.product.productId, qty: line.qty };
          default:
            return { product_id: line.row.productId as string, qty: line.qty, with_cabinet: line.cabinet };
        }
      }),
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
      .map((line) =>
        `${line.qty} × ${line.productName}${
          line.cabinetName ? ` med oppbevaringsskap ${line.cabinetName}` : ''
        } – pris på forespørsel`);
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
      lines: view, total,
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
    // Linjer med pris på forespørsel er ikke med i summen.
    onRequest: view.some((line) => line.onRequest),
    // Bestillingen er mottatt uansett; flagget lar UI-et si fra om kvittering
    // på e-post kan mangle.
    notified,
  });
}
