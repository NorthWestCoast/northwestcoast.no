/**
 * Oppslag i Enhetsregisteret (Brønnøysundregistrene).
 *
 * Åpent API uten nøkkel: https://data.brreg.no/enhetsregisteret/api/docs/
 * Brukes til å fylle ut navn, organisasjonsnummer og adresse når et selskap
 * opprettes, så ingen trenger å taste det inn.
 */
export const BRREG_SOURCE = 'Enhetsregisteret (Brønnøysundregistrene)';

const API = 'https://data.brreg.no/enhetsregisteret/api/enheter';
const TIMEOUT_MS = 6000;

export type CompanyHit = {
  orgNumber: string;
  name: string;
  /** Organisasjonsform, f.eks. «AS» eller «ENK». */
  orgForm: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  /** Landkode, f.eks. «NO». */
  country: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  /** Konkurs, under avvikling eller slettet – vises som advarsel. */
  inactive: boolean;
};

export type CompanySearch =
  | { status: 'ok'; results: CompanyHit[] }
  | { status: 'unavailable'; results: [] };

type RawAddress = { adresse?: string[]; postnummer?: string; poststed?: string; landkode?: string };
type RawUnit = {
  organisasjonsnummer?: string;
  navn?: string;
  organisasjonsform?: { kode?: string };
  forretningsadresse?: RawAddress;
  postadresse?: RawAddress;
  epostadresse?: string;
  telefon?: string;
  mobil?: string;
  hjemmeside?: string;
  konkurs?: boolean;
  underAvvikling?: boolean;
  underTvangsavviklingEllerTvangsopplosning?: boolean;
  slettedato?: string;
};

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

function toHit(raw: RawUnit): CompanyHit | null {
  const orgNumber = text(raw.organisasjonsnummer);
  const name = text(raw.navn);
  if (!orgNumber || !name) return null;

  const address = raw.forretningsadresse ?? raw.postadresse;
  const lines = (address?.adresse ?? []).map((line) => line.trim()).filter(Boolean);

  return {
    orgNumber,
    name,
    orgForm: text(raw.organisasjonsform?.kode),
    address: lines.length ? lines.join(', ') : null,
    postalCode: text(address?.postnummer),
    city: text(address?.poststed),
    country: text(address?.landkode),
    email: text(raw.epostadresse),
    phone: text(raw.telefon) ?? text(raw.mobil),
    website: text(raw.hjemmeside),
    inactive: Boolean(
      raw.konkurs || raw.underAvvikling || raw.underTvangsavviklingEllerTvangsopplosning || raw.slettedato,
    ),
  };
}

async function get(url: string): Promise<unknown | null> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: 3600 },
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`Enhetsregisteret svarte ${res.status}`);
  return res.json();
}

/** Søk på navn, eller slå opp ett organisasjonsnummer (ni sifre). */
export async function searchCompanies(raw: string): Promise<CompanySearch> {
  const query = raw.replace(/\s+/g, ' ').trim().slice(0, 80);
  const digits = query.replace(/[\s.]/g, '');

  try {
    if (/^\d{9}$/.test(digits)) {
      const unit = await get(`${API}/${digits}`);
      const hit = unit ? toHit(unit as RawUnit) : null;
      return { status: 'ok', results: hit ? [hit] : [] };
    }

    if (query.length < 2) return { status: 'ok', results: [] };

    const body = (await get(`${API}?${new URLSearchParams({ navn: query, size: '10' })}`)) as
      | { _embedded?: { enheter?: RawUnit[] } }
      | null;
    const units = body?._embedded?.enheter ?? [];
    return { status: 'ok', results: units.flatMap((unit) => toHit(unit) ?? []) };
  } catch {
    return { status: 'unavailable', results: [] };
  }
}
