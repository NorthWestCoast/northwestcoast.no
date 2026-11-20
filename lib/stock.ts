/**
 * Regning og formatering for lageret. Uten importer, så den kan brukes både
 * på serveren og i klientkomponenter, og testes med plain node.
 *
 * Tallene i databasen er numeric(12,3). Supabase gir dem som number, men
 * verdier kan også komme som tekst fra skjemaer, derfor tolkes alt gjennom
 * num().
 */

/** Tall fra databasen eller et skjema. Tomt og ugyldig blir 0. */
export function num(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const parsed = Number(value.trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Mengde fra et skjemafelt: norsk eller engelsk desimaltegn, høyst tre
 * desimaler, og innenfor det kolonnen tåler. Null når det ikke er et tall.
 */
export function parseQty(value: FormDataEntryValue | string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d{1,8}(\.\d{1,3})?$/.test(text)) return null;
  return Number(text);
}

/** «12», «8,5» eller «11,55»: uten unødige nuller, med norsk komma. */
export function fmtQty(value: unknown, unit?: string | null): string {
  const text = num(value).toLocaleString('nb-NO', { maximumFractionDigits: 3 });
  return unit ? `${text} ${unit}` : text;
}

/** En linje i stykklista: fast mengde per enhet, pluss mengde per meter leider. */
export type ComponentQty = { qty: unknown; qty_per_metre: unknown };

/** Det én enhet bruker av en del, for en leider på `lengthM` meter. */
export function requiredQty(component: ComponentQty, lengthM: unknown): number {
  const need = num(component.qty) + num(component.qty_per_metre) * num(lengthM);
  // Tre desimaler, som kolonnene i databasen.
  return Math.round(need * 1000) / 1000;
}

/** «13 stk» eller «1 stk + 3 stk per meter», slik stykklista vises. */
export function describeQty(component: ComponentQty, unit: string): string {
  const fixed = num(component.qty);
  const perMetre = num(component.qty_per_metre);
  const parts = [
    fixed > 0 ? fmtQty(fixed, unit) : '',
    perMetre > 0 ? `${fmtQty(perMetre, unit)} per meter` : '',
  ].filter(Boolean);
  return parts.join(' + ') || '–';
}

/**
 * Hvor mange enheter av et produkt som kan settes sammen av det som ligger
 * på lager nå. `available` er beholdning minus det åpne jobber har bundet.
 * Null når produktet ikke har stykkliste.
 */
export function buildable(
  components: Array<ComponentQty & { available: unknown }>,
  lengthM: unknown,
): number | null {
  if (components.length === 0) return null;
  let units = Infinity;
  for (const component of components) {
    const need = requiredQty(component, lengthM);
    if (need <= 0) continue;
    units = Math.min(units, Math.floor(Math.max(num(component.available), 0) / need));
  }
  return Number.isFinite(units) ? units : null;
}

/** Den delen som begrenser hvor mange som kan bygges. */
export function bottleneck<T extends ComponentQty & { available: unknown }>(
  components: T[],
  lengthM: unknown,
): T | null {
  let worst: T | null = null;
  let fewest = Infinity;
  for (const component of components) {
    const need = requiredQty(component, lengthM);
    if (need <= 0) continue;
    const units = Math.floor(Math.max(num(component.available), 0) / need);
    if (units < fewest) {
      fewest = units;
      worst = component;
    }
  }
  return worst;
}

export type StockState = 'ok' | 'low' | 'empty' | 'negative';

/** Tilstanden til en vare, til merkelapp og sortering. */
export function stockState(item: { on_hand: unknown; available: unknown; reorder_point: unknown }): StockState {
  const onHand = num(item.on_hand);
  if (onHand < 0) return 'negative';
  if (onHand === 0) return 'empty';
  const minimum = num(item.reorder_point);
  if (minimum > 0 && num(item.available) < minimum) return 'low';
  return 'ok';
}

export const STOCK_STATE: Record<StockState, { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }> = {
  ok: { label: 'På lager', tone: 'ok' },
  low: { label: 'Under minimum', tone: 'warn' },
  empty: { label: 'Tomt', tone: 'neutral' },
  // Det er registrert mer ut enn inn: beholdningen må telles.
  negative: { label: 'Må telles', tone: 'danger' },
};

/** Periodene forbruksoversikten tilbyr. Datoene er ISO (YYYY-MM-DD) eller null. */
export function usagePeriod(key: string, today: string): { from: string | null; to: string | null; label: string } {
  const year = Number(today.slice(0, 4));
  switch (key) {
    case 'i-fjor':
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31`, label: `${year - 1}` };
    case '12-mnd': {
      const from = new Date(Date.UTC(year - 1, Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)) + 1));
      return { from: from.toISOString().slice(0, 10), to: today, label: 'Siste 12 måneder' };
    }
    case 'alt':
      return { from: null, to: null, label: 'Hele perioden' };
    default:
      return { from: `${year}-01-01`, to: today, label: `Hittil i ${year}` };
  }
}
