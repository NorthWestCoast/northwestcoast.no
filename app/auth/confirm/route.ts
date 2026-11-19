import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';
import { landingPath, safeNext } from '@/lib/portal/landing';

/**
 * Innlogging med lenke som virker på tvers av enheter.
 *
 * Standardlenken fra Supabase (/auth/callback?code=…) må åpnes i samme
 * nettleser som ba om den. Ber man om lenken på PC-en og åpner e-posten på
 * mobilen, feiler den. Denne ruten tar i stedet imot en token-hash, som kan
 * løses inn hvor som helst.
 *
 * Krever at e-postmalene i Supabase peker hit:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 * (se DEPLOYMENT.md). Inntil malene er endret brukes /auth/callback som før.
 */
const TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup', 'invite', 'recovery', 'email_change'];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  if (!tokenHash || !type || !TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}/logg-inn?feil=manglende-kode`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    console.error('[auth] Kunne ikke løse inn token:', error.message);
    return NextResponse.redirect(`${origin}/logg-inn?feil=ugyldig-lenke`);
  }

  const next = await landingPath(supabase, safeNext(searchParams.get('neste')));
  return NextResponse.redirect(`${origin}${next}`);
}
