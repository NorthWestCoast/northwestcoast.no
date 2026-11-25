import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { DEMO_COOKIE } from '@/lib/portal/demo';
import { sameOrigin } from '../origin';

/**
 * Slår av demovisningen. Med logg-ut=1 logger den også ut: i demovisningen
 * stopper middleware serverhandlingene, også den vanlige utloggingen.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse('Ugyldig forespørsel.', { status: 403 });

  const form = await request.formData().catch(() => null);
  const logOut = form?.get('logg-ut') === '1';

  if (logOut) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(DEMO_COOKIE);

  const url = request.nextUrl.clone();
  url.pathname = logOut ? '/logg-inn' : '/admin/demo';
  url.search = '';
  return NextResponse.redirect(url, 303);
}
