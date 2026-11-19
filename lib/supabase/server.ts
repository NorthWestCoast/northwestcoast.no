import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';
import { requireSupabaseEnv } from './config';

/**
 * Klient for server-komponenter og route handlers, knyttet til brukerens
 * sesjonscookie (eller anonym for besøkende som ikke er logget inn). Leser
 * gjennom RLS – dette er autorisasjonslaget, og et glemt WHERE-ledd kan derfor
 * ikke lekke data mellom rederier.
 *
 * Det finnes med vilje ingen service-role-klient i nettlaget. Det som krever
 * mer enn brukeren selv har lov til, gjøres av funksjoner i databasen som
 * autoriserer selv (se docs/PORTAL.md).
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
