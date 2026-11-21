import { cookies } from 'next/headers';
import type { EmailOtpType } from '@supabase/supabase-js';
import { safeNext } from './landing';

/** Slagene innlogging Supabase sender lenke eller kode for. */
export const EMAIL_OTP_TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup', 'invite', 'recovery', 'email_change'];

/** Kortlevd informasjonskapsel innloggingsskjemaet setter med siden man var på vei til. */
const NEXT_COOKIE = 'nwc_neste';

/**
 * Dit brukeren skulle da hun ba om lenken, hvis det var i denne nettleseren.
 * Kapselen brukes opp. Bare for serverkode som kan skrive informasjonskapsler
 * (rutehandlere og serverhandlinger).
 */
export async function wantedPath(): Promise<string> {
  const jar = await cookies();
  const wanted = safeNext(jar.get(NEXT_COOKIE)?.value ?? null);
  jar.delete(NEXT_COOKIE);
  return wanted;
}
