import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Alt unntatt statiske filer og bilder. Los-delingssiden (/los/:token)
     * er med vilje IKKE unntatt – den er offentlig, men skal fortsatt gå
     * gjennom middleware slik at den kan få sikkerhetsheadere senere.
     */
    '/((?!_next/static|_next/image|favicon.ico|images|3d-models|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb)$).*)',
  ],
};
