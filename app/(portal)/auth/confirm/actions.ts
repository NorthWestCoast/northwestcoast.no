'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { landingPath } from '@/lib/portal/landing';
import { wantedPath } from '@/lib/portal/login';
import { rateLimit } from '@/lib/api-guard';

/**
 * Løser inn engangskoden fra e-posten, for den som leser e-posten på en annen
 * enhet enn den hun logger inn på. Svarer med en feiltekst, eller med siden
 * brukeren skal til.
 *
 * Adressen sendes tilbake i stedet for en videresending herfra. Skjemaet
 * laster da siden helt på nytt. En videresending fra en serverhandling settes
 * sammen i siden som allerede står åpen, og den kan være eldre enn serveren
 * (åpnet før en utrulling). Da er innloggingen gjort, men siden klarer ikke å
 * vise det den får tilbake, og brukeren ser bare en feilmelding.
 *
 * Lenken i e-posten løses inn av /auth/confirm/verify, av samme grunn.
 */
export async function confirmCode(
  email: string,
  code: string,
): Promise<{ error: string } | { next: string }> {
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

  return { next: await landingPath(supabase, await wantedPath()) };
}
