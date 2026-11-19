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

let noted = false;

/**
 * Sier fra én gang per serverprosess at sidene går på reserveinnhold. Som
 * advarsel, ikke feil: uten Supabase er reserven det forventede svaret, og
 * en console.error ville lagt seg som feilmelding over siden i utvikling.
 */
export function noteSupabaseMissing() {
  if (noted || typeof window !== 'undefined') return;
  noted = true;
  console.warn(
    '[supabase] Ikke konfigurert – prisliste og nyheter vises fra de faste reservene (se .env.example).',
  );
}

export function requireSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase er ikke konfigurert. Sett NEXT_PUBLIC_SUPABASE_URL og ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY (se .env.example).',
    );
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}
