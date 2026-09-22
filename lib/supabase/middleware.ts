import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './config';

/** Stier som krever innlogging. */
const PROTECTED = ['/minside'];

/**
 * Oppdaterer Supabase-sesjonen på hver request og vokter /minside.
 *
 * getUser() (ikke getSession()) er med vilje: getSession leser bare cookien,
 * mens getUser verifiserer tokenet mot Supabase. Cookien kan forfalskes.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Uten Supabase konfigurert skal resten av nettsiden fortsatt virke.
  if (!supabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (needsAuth && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/logg-inn';
    // Ta vare på hvor de skulle, så de lander riktig etter innlogging.
    loginUrl.searchParams.set('neste', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
