import { NextRequest, NextResponse } from 'next/server';
import { lookupVessel } from '@/lib/vessel-lookup';

export async function GET(req: NextRequest) {
  const imo = req.nextUrl.searchParams.get('imo') ?? '';
  const result = await lookupVessel(imo);
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
}
