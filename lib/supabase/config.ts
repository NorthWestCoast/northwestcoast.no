/**
 * Felles Supabase-konfigurasjon.
 *
 * Miljøvariablene leses ett sted, slik at en manglende variabel feiler med
 * en tydelig melding i stedet for et kryptisk "Invalid URL" langt inne i
 * klientbiblioteket.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Er Supabase konfigurert i det hele tatt? Brukes til gradvis utrulling. */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export function requireSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase er ikke konfigurert. Sett NEXT_PUBLIC_SUPABASE_URL og ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY (se .env.example).',
    );
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}
