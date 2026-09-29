import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LANG } from '@/lib/i18n';

/**
 * Norsk skal ligge på rot (/produkt) og engelsk under /en (/en/produkt),
 * mens filene ligger under app/[lang]. Derfor:
 *   /produkt      → rewrite til /no/produkt (URL-en i nettleseren står stille)
 *   /no/produkt   → redirect til /produkt   (én kanonisk URL per side)
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === `/${DEFAULT_LANG}` || pathname.startsWith(`/${DEFAULT_LANG}/`)) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(DEFAULT_LANG.length + 1) || '/';
    return NextResponse.redirect(url, 308);
  }

  if (pathname === '/en' || pathname.startsWith('/en/')) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${DEFAULT_LANG}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Alt bortsett fra API-ruter, Next-interne filer og statiske filer (som har punktum i navnet).
  matcher: ['/((?!api|og/|_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
