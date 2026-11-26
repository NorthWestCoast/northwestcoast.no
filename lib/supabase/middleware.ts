import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './config';
import {
  DEMO_BLOCKED_PARAM,
  DEMO_BLOCKED_VALUE,
  DEMO_COOKIE,
  DEMO_START,
  DEMO_STOP,
} from '@/lib/portal/demo';

/**
 * Stier som krever innlogging.
 *
 * /admin krever i tillegg staff-flagget, men den sjekken ligger i
 * requireStaff() – middleware sørger bare for at man er logget inn i det
 * hele tatt, slik at uinnloggede havner på innloggingssiden framfor en
 * redirect-runde via /minside.
 */
const PROTECTED = ['/minside', '/admin', '/produksjon'];

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

  // ── Demovisningen (lib/portal/demo.ts) ──
  const demo = request.cookies.get(DEMO_COOKIE)?.value;
  if (demo) {
    // Bryteren hører til den som slo den på. Logger noen andre inn i samme
    // nettleser, eller er sesjonen borte, fjernes den før siden lages.
    if (demo !== user?.id) {
      request.cookies.delete(DEMO_COOKIE);
      const next = NextResponse.next({ request });
      response.cookies.getAll().forEach((cookie) => next.cookies.set(cookie));
      next.cookies.delete(DEMO_COOKIE);
      return next;
    }

    // Bare til å se på: ingenting sendes inn. Unntaket er stiene som slår
    // demovisningen av og på.
    const writes = request.method !== 'GET' && request.method !== 'HEAD';
    if (needsAuth && writes && pathname !== DEMO_START && pathname !== DEMO_STOP) {
      return demoBlocked(request);
    }
  }

  return response;
}

/**
 * Svar på et skjema som er stoppet i demovisningen: tilbake til samme side,
 * som da viser en melding i demostripa.
 *
 * En serverhandling (hodet Next-Action) kalles med fetch og følger ikke en
 * vanlig videresending. Next leser i stedet x-action-redirect, og et svar med
 * bare det hodet laster siden på nytt med den nye adressen. Uten JavaScript
 * er skjemaet et vanlig POST, og da holder en vanlig videresending.
 */
function demoBlocked(request: NextRequest) {
  const target = request.nextUrl.clone();
  target.searchParams.set(DEMO_BLOCKED_PARAM, DEMO_BLOCKED_VALUE);

  if (request.headers.has('next-action')) {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'content-type': 'text/plain',
        'x-action-redirect': `${target.pathname}${target.search};replace`,
      },
    });
  }
  return NextResponse.redirect(target, 303);
}
