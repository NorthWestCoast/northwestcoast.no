import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { redeemInvitations } from '@/lib/invitations';

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
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth] Kunne ikke veksle kode mot sesjon:', error.message);
    return NextResponse.redirect(`${origin}/logg-inn?feil=ugyldig-lenke`);
  }

  // Løs inn eventuelle invitasjoner. Uten dette ville en invitert person
  // logget inn og tilhørt ingenting – RLS ville gitt henne en tom side.
  // Adressen er verifisert i og med at hun klikket lenken i innboksen sin.
  const user = data.user;
  if (user?.email) {
    try {
      await redeemInvitations(user.id, user.email);
    } catch (err) {
      // En feilet innløsning skal ikke hindre innlogging; personen lander
      // bare på en tom Min side og kan få invitasjonen sendt på nytt.
      console.error('[auth] Innløsning av invitasjon feilet:', err);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
