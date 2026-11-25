import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { getPortalContext } from '@/lib/portal/context';
import { DEMO_COOKIE, DEMO_HOURS, demoTarget } from '@/lib/portal/demo';
import { sameOrigin } from '../origin';

/**
 * Slår på demovisningen (lib/portal/demo.ts) og sender til Min side eller
 * admin. Bare for administratorer, og databasen sjekker det samme selv.
 */
export async function POST(request: NextRequest) {
  const to = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = '';
    return NextResponse.redirect(url, 303);
  };

  if (!sameOrigin(request)) return new NextResponse('Ugyldig forespørsel.', { status: 403 });

  const ctx = await getPortalContext();
  if (!ctx) return to('/logg-inn');
  if (ctx.staffRole !== 'admin') return to('/minside');

  const form = await request.formData().catch(() => null);
  (await cookies()).set(DEMO_COOKIE, ctx.userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEMO_HOURS * 60 * 60,
  });
  return to(demoTarget(form?.get('til')));
}
