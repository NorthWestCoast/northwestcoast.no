import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { landingPath, safeNext } from '@/lib/portal/landing';

/**
 * Tar imot magic link-retur og veksler koden inn i en sesjon.
 *
 * Denne lenken må åpnes i samme nettleser som ba om den (PKCE). Lenker som
 * skal virke på tvers av enheter går til /auth/confirm.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');

  if (!code) {
    // En brukt eller utløpt lenke kommer hit med error_code i stedet for kode.
    const feil = searchParams.has('error_code') ? 'ugyldig-lenke' : 'manglende-kode';
    return NextResponse.redirect(`${origin}/logg-inn?feil=${feil}`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth] Kunne ikke veksle kode mot sesjon:', error.message);
    return NextResponse.redirect(`${origin}/logg-inn?feil=ugyldig-lenke`);
  }

  const next = await landingPath(supabase, safeNext(searchParams.get('neste')));
  return NextResponse.redirect(`${origin}${next}`);
}
