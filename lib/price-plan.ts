/**
 * Validerer og planlegger en prisoppdatering fra admin-skjemaet.
 *
 * Bevisst en ren funksjon (ingen Next, ingen database): prislista styrer hva
 * kunder betaler, så reglene her skal kunne testes uten innlogging.
 */

export type CurrentProduct = {
  id: string;
  product_number: string;
  name: string;
  kind: 'ladder' | 'cabinet' | 'spare_part';
  steps: number | null;
  price_nok: number;
  price_on_request: boolean;
  active: boolean;
};

export type ProductPatch = {
  product_number?: string;
  steps?: number | null;
  price_nok?: number;
  price_on_request?: boolean;
  active?: boolean;
};

export type PricePlan =
  | { ok: false; error: string }
  | { ok: true; patches: Map<string, ProductPatch> };

/** Plassholder-nummeret fra migrasjonen. Skal byttes før en fast pris settes. */
const PLACEHOLDER_NUMBER = /^ARG-/i;
const NUMBER_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/ ]{0,39}$/;
export const MAX_PRICE = 1_000_000;
/** Endringer større enn dette krever en ekstra bekreftelse – tastefeil er dyre. */
export const LARGE_CHANGE = 0.5;

const field = (formData: FormData, id: string, name: string) => formData.get(`p:${id}:${name}`);
const nok = (n: number) => n.toLocaleString('nb-NO');

export function planPriceUpdate(current: CurrentProduct[], formData: FormData): PricePlan {
  const patches = new Map<string, ProductPatch>();
  const problems: string[] = [];
  const large: string[] = [];
  const seenNumbers = new Map<string, string>();
  let activePricedLadders = 0;

  for (const product of current) {
    const isLadder = product.kind === 'ladder';

    // Avmerkingsbokser mangler i skjemadata når de er av. Rader som ikke var
    // med i skjemaet i det hele tatt skal derfor ikke røres – ellers ville de
    // blitt satt til «ikke aktiv».
    if (formData.get(`p:${product.id}:price`) === null) {
      // …men et produktnummer som ikke er med må likevel regnes som opptatt.
      seenNumbers.set(product.product_number.toLowerCase(), product.name);
      if (isLadder && product.active && !product.price_on_request) activePricedLadders += 1;
      continue;
    }

    const numberRaw = field(formData, product.id, 'number');
    const number = typeof numberRaw === 'string' ? numberRaw.trim() : product.product_number;

    const priceRaw = field(formData, product.id, 'price');
    const priceText = typeof priceRaw === 'string' ? priceRaw.replace(/\s/g, '') : String(product.price_nok);

    const stepsRaw = field(formData, product.id, 'steps');
    const stepsText = typeof stepsRaw === 'string' ? stepsRaw.trim() : String(product.steps ?? '');

    const onRequest = isLadder && field(formData, product.id, 'request') === 'on';
    const active = field(formData, product.id, 'active') === 'on';

    if (!NUMBER_RE.test(number)) {
      problems.push(`${product.name}: ugyldig produktnummer.`);
      continue;
    }
    const clash = seenNumbers.get(number.toLowerCase());
    if (clash) {
      problems.push(`${product.name}: produktnummer «${number}» brukes også på ${clash}.`);
      continue;
    }
    seenNumbers.set(number.toLowerCase(), product.name);

    if (!/^\d{1,7}$/.test(priceText) || Number(priceText) > MAX_PRICE) {
      problems.push(`${product.name}: prisen må være hele kroner mellom 0 og ${nok(MAX_PRICE)}.`);
      continue;
    }
    const price = Number(priceText);

    let steps: number | null = null;
    if (stepsText !== '') {
      if (!/^\d{1,3}$/.test(stepsText) || Number(stepsText) < 1) {
        problems.push(`${product.name}: antall trinn må være et helt tall.`);
        continue;
      }
      steps = Number(stepsText);
    }

    if (!onRequest && price <= 0) {
      problems.push(
        `${product.name}: sett en pris${isLadder ? ', eller huk av for «pris på forespørsel»' : ''}.`,
      );
      continue;
    }
    if (isLadder && !onRequest && PLACEHOLDER_NUMBER.test(number)) {
      problems.push(
        `${product.name}: bytt det midlertidige produktnummeret «${number}» til det offisielle før du setter fast pris – nummeret vises til kundene.`,
      );
      continue;
    }
    if (isLadder && !onRequest && steps === null) {
      problems.push(`${product.name}: legg inn antall trinn før du setter fast pris.`);
      continue;
    }

    if (isLadder && active && !onRequest) activePricedLadders += 1;

    if (price !== product.price_nok && product.price_nok > 0 && price > 0) {
      const change = Math.abs(price - product.price_nok) / product.price_nok;
      if (change > LARGE_CHANGE) {
        large.push(`${product.name}: ${nok(product.price_nok)} → ${nok(price)} kr`);
      }
    }

    const patch: ProductPatch = {};
    if (number !== product.product_number) patch.product_number = number;
    if (price !== product.price_nok) patch.price_nok = price;
    if (steps !== product.steps) patch.steps = steps;
    if (isLadder && onRequest !== product.price_on_request) patch.price_on_request = onRequest;
    if (active !== product.active) patch.active = active;
    if (Object.keys(patch).length > 0) patches.set(product.id, patch);
  }

  if (problems.length > 0) return { ok: false, error: problems.join(' ') };

  // Uten en eneste aktiv leider med fast pris faller nettsiden tilbake på den
  // innebygde reserveprislista, som kan være utdatert. Det skal ikke skje
  // ved en feiltasting.
  if (activePricedLadders === 0) {
    return { ok: false, error: 'Minst én leider må være aktiv og ha fast pris – ellers vises ikke prislista.' };
  }

  if (large.length > 0 && formData.get('confirm_large') !== 'on') {
    return {
      ok: false,
      error:
        `Store endringer (over ${LARGE_CHANGE * 100} %): ${large.join('; ')}. ` +
        'Stemmer dette? Huk av «Jeg har kontrollert store endringer» og lagre igjen.',
    };
  }

  return { ok: true, patches };
}
