import { NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/api-guard';
import { lookupVessel } from '@/lib/vessel-lookup';

export async function GET(req: NextRequest) {
  if (!rateLimit(`vessel:${clientIp(req)}`, { limit: 30, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ status: 'unavailable' }, { status: 429 });
  }
  const imo = req.nextUrl.searchParams.get('imo') ?? '';
  const result = await lookupVessel(imo);
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
