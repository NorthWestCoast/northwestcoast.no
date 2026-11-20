import type { CompanyHit } from '@/lib/brreg';
import type { VesselHit } from '@/lib/vessel-lookup';
import { isValidImo } from '@/lib/imo';

/**
 * Fyller ut skjemafelt fra et treff i Brønnøysundregistrene eller
 * fartøyregisteret.
 *
 * Feltene i portalen er vanlige, ukontrollerte felt (defaultValue). Treffet
 * skrives rett inn i dem etter navn, så brukeren kan rette på alt etterpå og
 * skjemaene virker som før for den som fyller ut for hånd.
 */

type Values = Record<string, string | null>;

/** «998 196 159» – slik organisasjonsnummer vanligvis skrives. */
export function orgNumberText(value: string): string {
  return /^\d{9}$/.test(value) ? `${value.slice(0, 3)} ${value.slice(3, 6)} ${value.slice(6)}` : value;
}

/** Tall med norsk desimalkomma og høyst to desimaler: 34.567 → «34,57». */
export function decimalText(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

/**
 * Skriver verdiene inn i feltene med samme navn i skjemaet.
 *
 * - Felt som ikke finnes i skjemaet hoppes over.
 * - `null` tømmer feltet, så opplysninger fra forrige treff ikke blir stående.
 * - Feltene i `soft` (kontaktopplysninger o.l.) røres bare når de er tomme
 *   eller inneholder det som ble fylt inn sist (`previous`). Det brukeren har
 *   skrevet selv blir aldri overskrevet.
 *
 * Returnerer det som ble skrevet, til bruk som `previous` neste gang.
 */
export function fillFields(
  form: HTMLFormElement | null | undefined,
  values: Values,
  options: { previous?: Record<string, string>; soft?: string[] } = {},
): Record<string, string> {
  const written: Record<string, string> = {};
  if (!form) return written;

  for (const [name, value] of Object.entries(values)) {
    const field = form.elements.namedItem(name);
    if (
      !(field instanceof HTMLInputElement) &&
      !(field instanceof HTMLTextAreaElement) &&
      !(field instanceof HTMLSelectElement)
    ) {
      continue;
    }

    const ours = field.value === (options.previous?.[name] ?? '');
    if (options.soft?.includes(name) && field.value.trim() !== '' && !ours) continue;

    field.value = value ?? '';
    if (value) written[name] = value;
  }
  return written;
}

/** Feltene som bare fylles når de står tomme. */
export const COMPANY_SOFT_FIELDS = ['contact_email', 'contact_phone', 'phone'];

/**
 * Et treff i Enhetsregisteret som skjemaverdier. Skjemaene for selskap bruker
 * `contact_phone` (admin) eller `phone` (kundens egen registrering); begge
 * fylles, og det som ikke finnes i skjemaet hoppes over.
 */
export function companyHitValues(hit: CompanyHit): Values {
  return {
    name: hit.name,
    org_number: hit.orgNumber,
    address: hit.address,
    postal_code: hit.postalCode,
    city: hit.city,
    contact_email: hit.email,
    contact_phone: hit.phone,
    phone: hit.phone,
  };
}

/** Typen settes bare når feltet står tomt. */
export const vesselSoftFields = (prefix = '') => [`${prefix}vessel_type`];

/**
 * Et treff i fartøyregisteret som skjemaverdier. `prefix` brukes der fartøyet
 * står i samme skjema som et selskap (begge har et felt som heter «name»).
 */
export function vesselHitValues(hit: VesselHit, prefix = ''): Values {
  return {
    [`${prefix}name`]: hit.name,
    // Registeret har enkelte IMO-nummer med feil kontrollsiffer. De ville
    // blitt avvist ved lagring, så de fylles ikke inn.
    [`${prefix}imo`]: hit.imo && isValidImo(hit.imo) ? hit.imo : null,
    [`${prefix}call_sign`]: hit.callSign,
    [`${prefix}registration_mark`]: hit.registrationMark,
    [`${prefix}length_m`]: decimalText(hit.length),
    [`${prefix}beam_m`]: decimalText(hit.width),
    [`${prefix}build_year`]: hit.buildYear ? String(hit.buildYear) : null,
    [`${prefix}registry_id`]: hit.id,
    // Registeret har bare fiskefartøy.
    [`${prefix}vessel_type`]: 'Fiskefartøy',
  };
}
