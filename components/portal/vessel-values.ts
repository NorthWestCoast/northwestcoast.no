import { type ActionResult, digits, err, fail, optional, text } from '@/lib/portal/forms';
import { isValidImo } from '@/lib/imo';

/**
 * Leser og kontrollerer feltene fra components/portal/vessel-inputs.tsx.
 * Felles for nytt og endret fartøy, på Min side og i admin.
 */
export type VesselValues = {
  name: string;
  imo: string | null;
  call_sign: string | null;
  registration_mark: string | null;
  vessel_type: string | null;
  home_port: string | null;
  length_m: number | null;
  beam_m: number | null;
  build_year: number | null;
  registry_id: string | null;
};

type Parsed = { error: string } | { error: null; values: VesselValues };

/** Meter med komma eller punktum («34,5»). Tomt felt gir null, ugyldig gir NaN. */
function meters(value: FormDataEntryValue | null): number | null {
  const raw = text(value, 12).replace(/\s/g, '').replace(',', '.');
  if (!raw) return null;
  if (!/^\d{1,3}(\.\d+)?$/.test(raw)) return Number.NaN;
  const n = Math.round(Number(raw) * 100) / 100;
  return n > 0 && n < 1000 ? n : Number.NaN;
}

export function readVessel(formData: FormData, prefix = ''): Parsed {
  const get = (field: string) => formData.get(`${prefix}${field}`);

  const name = text(get('name'), 160);
  if (name.length < 2) return { error: 'Skriv inn navnet på fartøyet.' };

  // Bare siffer («IMO 9074729» og «9074729» er det samme).
  const imo = digits(get('imo'));
  if (imo && !isValidImo(imo)) {
    return { error: 'IMO-nummeret er ikke gyldig. Det skal ha 7 siffer, og kontrollsifferet må stemme.' };
  }

  const length = meters(get('length_m'));
  if (Number.isNaN(length)) return { error: 'Lengden må være et tall i meter, for eksempel 34,5.' };
  const beam = meters(get('beam_m'));
  if (Number.isNaN(beam)) return { error: 'Bredden må være et tall i meter, for eksempel 8,2.' };

  const yearRaw = text(get('build_year'), 8);
  const year = yearRaw ? Number(yearRaw) : null;
  if (year !== null && !(/^\d{4}$/.test(yearRaw) && year >= 1800 && year <= new Date().getFullYear() + 2)) {
    return { error: 'Byggeåret er ikke gyldig. Skriv fire siffer, for eksempel 2014.' };
  }

  const registryId = text(get('registry_id'), 60);

  return {
    error: null,
    values: {
      name,
      imo: imo || null,
      call_sign: optional(get('call_sign'), 20)?.toUpperCase() ?? null,
      registration_mark: optional(get('registration_mark'), 20)?.toUpperCase() ?? null,
      vessel_type: optional(get('vessel_type'), 80),
      home_port: optional(get('home_port'), 80),
      length_m: length,
      beam_m: beam,
      build_year: year,
      registry_id: /^[\w-]{1,60}$/.test(registryId) ? registryId : null,
    },
  };
}

/** Databasen har siste ord om IMO-nummeret (kontrollsiffer og unikhet). */
export function vesselError(
  error: { code?: string; message: string },
  fallback: string,
  /** Hva brukeren kan gjøre når IMO-nummeret alt er registrert. */
  takenHint = '',
): ActionResult {
  if (error.code === '23514') {
    return err(
      /imo/i.test(error.message)
        ? 'IMO-nummeret er ikke gyldig. Det skal ha 7 siffer, og kontrollsifferet må stemme.'
        : 'Lengde, bredde eller byggeår er ikke gyldig.',
    );
  }
  if (error.code === '23505') {
    return err(`Et fartøy med dette IMO-nummeret er allerede registrert.${takenHint ? ` ${takenHint}` : ''}`);
  }
  return fail(error, fallback);
}
