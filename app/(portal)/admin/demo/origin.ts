import type { NextRequest } from 'next/server';

/**
 * Kommer skjemaet fra portalen selv? Serverhandlinger sjekker dette av seg
 * selv; disse to stiene er vanlige route handlers og gjør det her. Mangler
 * Origin (eldre nettlesere), holder det at innloggingscookien er SameSite=Lax.
 */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === (request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
  } catch {
    return false;
  }
}
