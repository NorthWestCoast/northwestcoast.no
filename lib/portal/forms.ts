/**
 * Felles verktøy for server actions i portalen.
 *
 * Alle actions returnerer ActionResult, slik at skjemakomponentene kan vise
 * kvittering og feil uten egen tilstand per skjema.
 */
export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export const ok = (message: string): ActionResult => ({ ok: true, message });
export const err = (error: string): ActionResult => ({ ok: false, error });

export const text = (value: FormDataEntryValue | null, max = 200) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export const optional = (value: FormDataEntryValue | null, max = 200) => text(value, max) || null;

/** Bare siffer (org.nr., IMO). Databasen validerer kontrollsifferet. */
export const digits = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : '';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Gyldig UUID eller null. Hindrer at tilfeldig tekst når fram til en spørring. */
export const uuid = (value: FormDataEntryValue | null) => {
  const v = text(value, 40);
  return UUID.test(v) ? v : null;
};

/** ISO-dato (YYYY-MM-DD) eller null. */
export const isoDate = (value: FormDataEntryValue | null) => {
  const v = text(value, 12);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
};

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

/** Heltall innenfor grenser, eller null. */
export const int = (value: FormDataEntryValue | null, min = 0, max = 1_000_000) => {
  const v = text(value, 12).replace(/\s/g, '');
  if (!/^-?\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
};

export const checked = (value: FormDataEntryValue | null) => value === 'on' || value === 'true';

type DbError = { code?: string; message: string } | null | undefined;

/**
 * Oversetter en databasefeil til noe brukeren kan handle på.
 *
 * Funksjonene i databasen kaster P0001 med en ferdig norsk melding; den vises
 * som den er. Alt annet får en generell melding, og detaljene logges.
 */
export function fail(error: DbError, fallback = 'Noe gikk galt. Prøv igjen.'): ActionResult {
  if (!error) return err(fallback);

  switch (error.code) {
    case 'P0001':
      return err(error.message);
    case '42501':
      // Egne meldinger fra funksjonene er på norsk; RLS sine er på engelsk.
      return err(/row-level security|permission denied/i.test(error.message)
        ? 'Du har ikke tilgang til å gjøre dette.'
        : error.message);
    case '23505':
      return err('Dette finnes allerede.');
    case '23503':
      return err('Kan ikke fullføres fordi noe annet er knyttet til dette.');
    case '23514':
    case '22P02':
    case '22007':
      return err('En av verdiene er ikke gyldig.');
    default:
      console.error('[portal] Databasefeil:', error.code, error.message);
      return err(fallback);
  }
}
