import { NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/api-guard';
import { VESSEL_SOURCE, searchVessels } from '@/lib/vessel-lookup';

/**
 * Søk etter fartøy på navn, kallesignal, registreringsmerke eller IMO.
 *
 *   GET /api/vessels?q=skår
 *   → { status: 'ok' | 'unavailable', source, results: VesselHit[] }
 *
 * Brukes av leiderkalkulatoren og av skjemaene for nye fartøy. Opplysningene
 * er offentlige; ruten finnes for å samle oppslaget ett sted, mellomlagre det
 * og holde trafikken mot registeret nede.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`vessels:${clientIp(req)}`, { limit: 90, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ status: 'unavailable', source: VESSEL_SOURCE, results: [] }, { status: 429 });
  }

  const query = req.nextUrl.searchParams.get('q') ?? '';
  const search = await searchVessels(query);

  return NextResponse.json(
    { ...search, source: VESSEL_SOURCE },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  );
}
