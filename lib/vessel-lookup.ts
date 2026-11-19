import { isValidImo, normalizeImo } from './imo';

export type VesselInfo = {
  imo: string;
  name?: string;
  /** Lengde overalt i meter. */
  loa?: number;
  type?: 'fishing' | 'service' | 'cargo' | 'passenger' | 'other';
  /** Hvor opplysningene kommer fra, vist til brukeren. */
  source: string;
};

export type LookupResult =
  | { status: 'found'; vessel: VesselInfo }
  | { status: 'not_found' }
  | { status: 'invalid' }
  | { status: 'unavailable' };

/**
 * En kilde for fartøyopplysninger. Kobles til her når det finnes en kilde som
 * kan slås opp på IMO-nummer og som vi har tilgang til.
 *
 * Status per nå: ingen kilde er koblet til. BarentsWatch sitt åpne AIS-API
 * slår opp på MMSI (ikke IMO) og gir bare fartøy som sender AIS, og krever
 * klient-ID/hemmelighet. Fribord finnes uansett ikke i noe register – det
 * varierer med lasting og må måles om bord.
 */
export type VesselProvider = (imo: string) => Promise<VesselInfo | null>;

const PROVIDERS: VesselProvider[] = [];

export async function lookupVessel(raw: string): Promise<LookupResult> {
  if (!isValidImo(raw)) return { status: 'invalid' };
  if (PROVIDERS.length === 0) return { status: 'unavailable' };

  const imo = normalizeImo(raw);
  try {
    for (const provider of PROVIDERS) {
      const vessel = await provider(imo);
      if (vessel) return { status: 'found', vessel };
    }
    return { status: 'not_found' };
  } catch {
    return { status: 'unavailable' };
  }
}
