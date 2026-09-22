import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /*
   * Bevisst smal matcher.
   *
   * Nettstedet er nesten utelukkende statiske markedsføringssider. Kjørte
   * middleware på alt, ville hver eneste sidevisning – også forsiden – gått
   * gjennom en Supabase-sesjonssjekk, og hver invokasjon faktureres. Sesjonen
   * betyr bare noe der man faktisk er innlogget.
   *
   * /auth/callback står utenfor med vilje: den route handleren setter
   * cookiene sine selv via createServerSupabase().
   */
  matcher: ['/minside/:path*', '/admin/:path*', '/logg-inn'],
};
