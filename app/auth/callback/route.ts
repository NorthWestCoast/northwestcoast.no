import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Tar imot magic link-retur og veksler koden inn i en sesjon.
 *
 * Åpen omdirigering er en reell risiko her: `neste` kommer fra URL-en og kan
 * peke hvor som helst. Vi tillater derfor kun relative stier på eget domene.
 */
function safeNext(value: string | null): string {
  if (!value) return '/minside';
  if (!value.startsWith('/') || value.startsWith('//')) return '/minside';
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('neste'));

  if (!code) {
    return NextResponse.redirect(`${origin}/logg-inn?feil=manglende-kode`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth] Kunne ikke veksle kode mot sesjon:', error.message);
    return NextResponse.redirect(`${origin}/logg-inn?feil=ugyldig-lenke`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
