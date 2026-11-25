import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';
import { requireSupabaseEnv } from './config';
import { DEMO_COOKIE, DEMO_HEADER } from '@/lib/portal/demo';

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
export async function createServerSupabase(headers?: Record<string, string>) {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  // Demovisningen (lib/portal/demo.ts). Databasen ser bort fra hodet for alle
  // som ikke er administratorer.
  const all = {
    ...(cookieStore.get(DEMO_COOKIE)?.value ? { [DEMO_HEADER]: '1' } : {}),
    ...headers,
  };

  return createServerClient<Database>(url, anonKey, {
    // Ekstra hoder følger med på alle kall fra denne klienten. Brukes av
    // /los/[token], som sender nøkkelen fra lenken så lagringen slipper
    // bildene i rapporten gjennom (se app.can_read_share_photo), og av
    // demovisningen.
    ...(Object.keys(all).length > 0 ? { global: { headers: all } } : {}),
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
