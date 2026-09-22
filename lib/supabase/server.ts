import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from './database.types';
import { requireSupabaseEnv } from './config';

/**
 * Klient for server-komponenter og route handlers, knyttet til brukerens
 * sesjonscookie. Leser gjennom RLS – dette er autorisasjonslaget, og et
 * glemt WHERE-ledd kan derfor ikke lekke data mellom rederier.
 */
export async function createServerSupabase() {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Kalt fra en server-komponent: cookies er skrivebeskyttet der.
          // Middleware oppdaterer sesjonen, så dette er trygt å ignorere.
        }
      },
    },
  });
}

/**
 * Service-role-klient. OMGÅR RLS FULLSTENDIG.
 *
 * Kun for route handlers som gjør noe brukeren ikke er autorisert for i seg
 * selv – f.eks. å ta imot en bestilling fra en innlogget-løs besøkende, eller
 * å slå opp en los-deling på token. Må aldri importeres i en klientkomponent.
 */
export function createServiceSupabase() {
  if (typeof window !== 'undefined') {
    throw new Error('createServiceSupabase() kan ikke brukes i nettleseren.');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Er service-role tilgjengelig? Lar rutene degradere pent uten den. */
export function hasServiceRole() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
