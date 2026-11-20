'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';
import { landingPath, safeNext } from '@/lib/portal/landing';
import { rateLimit } from '@/lib/api-guard';

const TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup', 'invite', 'recovery', 'email_change'];

/** Kortlevd informasjonskapsel innloggingsskjemaet setter med siden man var på vei til. */
const NEXT_COOKIE = 'nwc_neste';

/** Dit brukeren skulle da hun ba om lenken, hvis det var i denne nettleseren. */
async function wantedPath(): Promise<string> {
  const jar = await cookies();
  const wanted = safeNext(jar.get(NEXT_COOKIE)?.value ?? null);
  jar.delete(NEXT_COOKIE);
  return wanted;
}

/**
 * Løser inn lenken fra e-posten. Kalles først når brukeren trykker «Logg inn»
 * på /auth/confirm, aldri av at siden bare åpnes.
 */
export async function confirmLink(formData: FormData): Promise<void> {
  const tokenHash = String(formData.get('token_hash') ?? '').slice(0, 300);
  const type = String(formData.get('type') ?? '') as EmailOtpType;
  if (!tokenHash || !TYPES.includes(type)) redirect('/logg-inn?feil=manglende-kode');

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.error('[auth] Kunne ikke løse inn lenken:', error.message);
    redirect('/logg-inn?feil=ugyldig-lenke');
  }

  redirect(await landingPath(supabase, await wantedPath()));
}

/**
 * Løser inn engangskoden fra e-posten, for den som leser e-posten på en annen
 * enhet enn den hun logger inn på. Svarer med en feiltekst, eller sender
 * brukeren videre.
 */
export async function confirmCode(email: string, code: string): Promise<{ error: string }> {
  const address = String(email ?? '').trim().toLowerCase().slice(0, 200);
  const token = String(code ?? '').replace(/\D/g, '').slice(0, 12);
  if (!address || token.length < 6) return { error: 'Skriv inn koden fra e-posten.' };

  // Noen få forsøk per adresse. Supabase har sine egne grenser per IP-adresse;
  // denne stopper gjetting som går gjennom vår egen side. Telleren er per
  // serverinstans, så den er et tillegg, ikke hovedvernet: det er lengden på
  // koden (settes i Supabase, se DEPLOYMENT.md).
  if (!rateLimit(`otp:${address}`, { limit: 5, windowMs: 15 * 60 * 1000 })) {
    return { error: 'For mange forsøk. Be om en ny lenke og prøv igjen om litt.' };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ email: address, token, type: 'email' });
  if (error) {
    return { error: 'Koden stemmer ikke, eller den er brukt opp eller utløpt. Be om en ny lenke.' };
  }

  redirect(await landingPath(supabase, await wantedPath()));
}
