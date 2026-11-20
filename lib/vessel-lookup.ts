import { normalizeImo } from './imo';

/**
 * Oppslag i Fiskeridirektoratets fartøyregister.
 *
 * Registeret er et åpent API uten nøkkel («Et åpent API for uthenting av
 * fartøy- og eieropplysninger», https://api.fiskeridir.no/vessel-api/swagger-ui/).
 * Det dekker merkeregistrerte fiskefartøy. Andre fartøy (servicebåter,
 * lasteskip, passasjerbåter) står i Sjøfartsdirektoratets skipsregistre, som
 * ikke har noe dokumentert åpent API – de legges inn for hånd.
 *
 * Fribord står ikke i noe register: det varierer med lasting og må måles om
 * bord. Registeret gir navn, kallesignal, IMO, lengde, bredde og eier.
 */
export const VESSEL_SOURCE = 'Fiskeridirektoratets fartøyregister';

const API = 'https://api.fiskeridir.no/vessel-api/api/v1/vessels';
const TIMEOUT_MS = 6000;
const MAX_RESULTS = 10;

export type VesselOwner = {
  name: string;
  /** Bare for selskap. Privatpersoner har ikke organisasjonsnummer. */
  orgNumber: string | null;
  postalCode: string | null;
  city: string | null;
};

export type VesselHit = {
  /** Registerets egen id. */
  id: string;
  name: string;
  imo: string | null;
  callSign: string | null;
  /** Registreringsmerke, f.eks. «M 0200HØ». */
  registrationMark: string | null;
  /** Største lengde i meter. */
  length: number | null;
  /** Bredde i meter. */
  width: number | null;
  buildYear: number | null;
  owner: VesselOwner | null;
  source: string;
};

export type VesselSearch =
  | { status: 'ok'; results: VesselHit[] }
  | { status: 'unavailable'; results: [] };

type RawOwner = { id?: string; entityType?: string; name?: string; postalCode?: string; city?: string };
type RawVessel = {
  id?: string;
  name?: string;
  registrationMark?: string;
  radioCallSign?: string;
  imoNumber?: string;
  width?: number;
  length?: number;
  buildYear?: number;
  owners?: RawOwner[];
};

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const positive = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);

function toHit(raw: RawVessel): VesselHit | null {
  const id = text(raw.id);
  const name = text(raw.name);
  if (!id || !name) return null;

  const first = raw.owners?.find((owner) => text(owner.name)) ?? null;
  const ownerId = text(first?.id);

  return {
    id,
    name,
    imo: text(raw.imoNumber),
    callSign: text(raw.radioCallSign),
    registrationMark: text(raw.registrationMark),
    length: positive(raw.length),
    width: positive(raw.width),
    buildYear: positive(raw.buildYear),
    owner: first
      ? {
          name: text(first.name) as string,
          orgNumber: first.entityType === 'COMPANY' && ownerId && /^\d{9}$/.test(ownerId) ? ownerId : null,
          postalCode: text(first.postalCode),
          city: text(first.city),
        }
      : null,
    source: VESSEL_SOURCE,
  };
}

async function fetchVessels(params: Record<string, string>): Promise<VesselHit[]> {
  const url = `${API}?${new URLSearchParams({ per_page: '20', ...params })}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // Registeret endres sjelden; ett oppslag per søk i timen holder.
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Fartøyregisteret svarte ${res.status}`);

  const body: unknown = await res.json();
  if (!Array.isArray(body)) return [];
  return body.flatMap((raw) => toHit(raw as RawVessel) ?? []);
}

/** Små bokstaver uten æ, ø, å og aksenter, så «skar senior» finner «SKÅR SENIOR». */
const fold = (value: string) =>
  value
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const compact = (value: string) => fold(value).replace(/[\s-]/g, '');

/** Lavest tall først: eksakt navn, så navn som starter med søket, så resten. */
function rank(hit: VesselHit, needle: string): number {
  const name = fold(hit.name);
  if (name === needle) return 0;
  if (hit.callSign && fold(hit.callSign) === needle) return 0;
  if (hit.registrationMark && compact(hit.registrationMark) === compact(needle)) return 0;
  if (name.startsWith(needle)) return 1;

  const words = name.split(/\s+/);
  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.every((token) => words.some((word) => word.startsWith(token)))) return 2;
  if (name.includes(needle)) return 3;
  return 4;
}

/**
 * Søk på navn, kallesignal, registreringsmerke eller IMO-nummer.
 *
 * Registeret har to søk som utfyller hverandre: `name` treffer deler av
 * navnet («skår» finner «SKÅR SENIOR»), mens `query` treffer hele ord på
 * tvers av felt (kallesignal, merke, IMO). Begge kjøres, og treffene flettes.
 */
export async function searchVessels(raw: string): Promise<VesselSearch> {
  const query = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (query.length < 2) return { status: 'ok', results: [] };

  const imo = normalizeImo(query);
  const looksLikeImo = /^(IMO\s*)?\d{7}$/i.test(query);

  try {
    if (looksLikeImo) {
      const hits = await fetchVessels({ query: imo });
      return { status: 'ok', results: hits.filter((hit) => hit.imo === imo).slice(0, MAX_RESULTS) };
    }

    // Registreringsmerker skrives på mange måter («M-200-HØ», «M 0200HØ»).
    // Registeret har et eget filter som tåler det.
    const looksLikeMark = /^[a-zæøå]{1,2}[\s-]*\d{1,4}[\s-]*[a-zæøå]{1,2}$/i.test(query);

    const [byName, byQuery, byMark] = await Promise.allSettled([
      fetchVessels({ name: query }),
      fetchVessels({ query }),
      looksLikeMark ? fetchVessels({ registration_mark: query }) : Promise.resolve<VesselHit[]>([]),
    ]);
    if (byName.status === 'rejected' && byQuery.status === 'rejected') {
      return { status: 'unavailable', results: [] };
    }

    const merged = new Map<string, VesselHit>();
    for (const settled of [byMark, byName, byQuery]) {
      if (settled.status !== 'fulfilled') continue;
      for (const hit of settled.value) if (!merged.has(hit.id)) merged.set(hit.id, hit);
    }

    const marks = new Set(byMark.status === 'fulfilled' ? byMark.value.map((hit) => hit.id) : []);
    const needle = fold(query);
    const results = [...merged.values()]
      .map((hit) => ({ hit, score: marks.has(hit.id) ? 0 : rank(hit, needle) }))
      // `query` treffer ett og ett ord, også i eiernavn. Uten treff i navn,
      // kallesignal eller merke er det støy for den som leter etter en båt.
      .filter(({ score }) => score < 4)
      .sort((a, b) => a.score - b.score || a.hit.name.localeCompare(b.hit.name, 'nb'))
      .slice(0, MAX_RESULTS)
      .map(({ hit }) => hit);

    return { status: 'ok', results };
  } catch {
    return { status: 'unavailable', results: [] };
  }
}
