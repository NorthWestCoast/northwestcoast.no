import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { BRREG_SOURCE, searchCompanies } from '@/lib/brreg';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Søk i Enhetsregisteret på navn eller organisasjonsnummer.
 *
 *   GET /api/brreg?q=skår senior
 *   → { status: 'ok' | 'unavailable', source, results: CompanyHit[] }
 *
 * Bare for innloggede: oppslaget brukes i skjemaene i portalen, og ruten skal
 * ikke stå åpen som en mellomstasjon mot registeret for hvem som helst.
 */
export async function GET(req: NextRequest) {
  const empty = { source: BRREG_SOURCE, results: [] };

  let userId: string | null = null;
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return NextResponse.json({ status: 'unavailable', ...empty }, { status: 401 });

  if (!rateLimit(`brreg:${userId}`, { limit: 120, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ status: 'unavailable', ...empty }, { status: 429 });
  }

  const search = await searchCompanies(req.nextUrl.searchParams.get('q') ?? '');
  return NextResponse.json(
    { ...search, source: BRREG_SOURCE },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  );
}
