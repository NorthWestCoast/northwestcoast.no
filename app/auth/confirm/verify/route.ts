import type { NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';
import { landingPath } from '@/lib/portal/landing';
import { EMAIL_OTP_TYPES, wantedPath } from '@/lib/portal/login';

/**
 * Løser inn lenken fra innloggings-e-posten. Skjemaet på /auth/confirm
 * sender hit når brukeren trykker «Logg inn».
 *
 * En vanlig skjemainnsending med vanlig videresending, ikke en
 * serverhandling. Nettleseren laster da neste side helt på nytt, med
 * økten på plass. En videresending fra en serverhandling settes sammen i
 * siden som står åpen, ved at serveren henter neste side fra seg selv. Med
 * nettsted og portal på hvert sitt vertsnavn kan det gå galt: økten følger
 * ikke alltid med, og brukeren får da innloggingssiden tilbake selv om
 * innloggingen gikk gjennom.
 */

/** 303 til en sti på samme vertsnavn. Relativ, så den følger adressen brukeren faktisk er på. */
const seeOther = (path: string) => new Response(null, { status: 303, headers: { Location: path } });

/**
 * Skjemaet skal komme fra vår egen side. Uten denne sjekken kunne et annet
 * nettsted logget en besøkende inn på en konto de selv styrer.
 *
 * Nettleseren merker selv hvor en forespørsel kommer fra (Sec-Fetch-Site).
 * Det er den vi stoler på. Origin kan ikke brukes alene: /auth/confirm ber
 * nettleseren om ikke å oppgi avsender (adressen inneholder en engangsnøkkel),
 * og da står Origin som «null» også når skjemaet er vårt eget. Origin brukes
 * bare som reserve for eldre nettlesere uten Sec-Fetch-Site.
 */
function fromOwnPage(request: NextRequest): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';

  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return true;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!fromOwnPage(request)) return seeOther('/logg-inn?feil=ugyldig-lenke');

  const form = await request.formData().catch(() => null);
  const tokenHash = String(form?.get('token_hash') ?? '').slice(0, 300);
  const type = String(form?.get('type') ?? '') as EmailOtpType;
  if (!tokenHash || !EMAIL_OTP_TYPES.includes(type)) return seeOther('/logg-inn?feil=manglende-kode');

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.error('[auth] Kunne ikke løse inn lenken:', error.message);
    return seeOther('/logg-inn?feil=ugyldig-lenke');
  }

  return seeOther(await landingPath(supabase, await wantedPath()));
}
