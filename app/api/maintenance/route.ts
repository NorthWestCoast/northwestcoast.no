import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, langOf, line, rateLimit, readBody, rejected, tr } from '@/lib/api-guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { SUPPORT_PHONE } from '@/lib/mail';
import { MAINTENANCE_BUCKET, finishMaintenance } from './notify';

// E-postutsendingen (når rapporten er uten bilder) kan ta noen sekunder.
export const maxDuration = 20;

/**
 * Trinn 1 av vedlikeholdsinnsending: lagre teksten, og fortell klienten hvor
 * bildene skal lastes opp.
 *
 * Bildebytes går ALDRI gjennom denne ruten. Nettleseren laster opp direkte
 * til Supabase Storage, i en mappe med rapportens id. En lagringspolicy åpner
 * den mappen for opplasting i 30 minutter, til rapporten er avsluttet. Ruten
 * kjører med besøkerens egen (anonyme) sesjon, uten service-role.
 */

type PhotoRequest = { name?: string; type?: string };

const MAX_IMAGES = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/** Gjør filnavnet trygt som storage-sti uten å miste gjenkjennelighet. */
function safeName(name: string, index: number): string {
  const cleaned = clean(name, 80)
    .toLowerCase()
    .replace(/[^\w.\-]/g, '_')
    .replace(/_+/g, '_');
  return cleaned || `bilde-${index + 1}.jpg`;
}

export async function POST(req: NextRequest) {
  const body = await readBody(req);
  if (!body) return rejected();
  const lang = langOf(body);

  if (isBot(body)) return NextResponse.json({ ok: true, uploads: [] });

  if (!rateLimit(`maintenance:${clientIp(req)}`)) {
    return NextResponse.json(
      { error: tr(lang, 'For mange forsøk. Prøv igjen om noen minutter.', 'Too many attempts. Please try again in a few minutes.') },
      { status: 429 },
    );
  }

  const name = line(body.name, 120);
  const boat = line(body.boat, 160);
  const imo = line(body.imo, 20);
  const serial = line(body.serial, 60);
  const email = line(body.email, 160);
  const notes = clean(body.notes, 4000);
  const photos = (Array.isArray(body.photos) ? body.photos : []).slice(
    0,
    MAX_IMAGES,
  ) as (PhotoRequest | null)[];

  if (!name || !boat || !serial) {
    return NextResponse.json(
      { error: tr(lang, 'Navn, navn på båt og serienummer er påkrevd', 'Name, vessel name and serial number are required') },
      { status: 400 },
    );
  }
  if (email && !isEmail(email)) {
    return NextResponse.json({ error: tr(lang, 'E-postadressen ser ikke gyldig ut.', 'The email address does not look valid.') }, { status: 400 });
  }

  const failed = tr(
    lang,
    `Vi klarte ikke å lagre rapporten nå. Ring oss på ${SUPPORT_PHONE}.`,
    `We could not save the report right now. Please call us on ${SUPPORT_PHONE}.`,
  );

  let supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  try {
    supabase = await createServerSupabase();
  } catch (error) {
    console.error('[maintenance] Supabase er ikke konfigurert – rapport tapt:', error);
    return NextResponse.json({ error: failed }, { status: 500 });
  }

  // submit_maintenance_report() prøver å koble serienummeret til en registrert
  // leider. Treffer den ikke, lagres rapporten likevel med råteksten – en
  // rapport skal aldri gå tapt fordi oppslaget bommet.
  const { data, error } = await supabase.rpc('submit_maintenance_report', {
    payload: { name, boat, imo, serial, email, notes },
  });

  if (error?.code === 'P0001') {
    // Databasens egne avslag (manglende felt, for mange rapporter).
    return NextResponse.json({ error: tr(lang, error.message, failed) }, { status: 400 });
  }

  const result = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  const logId = typeof result?.log_id === 'string' ? result.log_id : null;

  if (error || !logId) {
    console.error('[maintenance] Kunne ikke lagre rapport:', error?.code, error?.message);
    return NextResponse.json({ error: failed }, { status: 500 });
  }

  // ── Hvor bildene skal lastes opp ────────────────────────────────────────
  // `index` peker tilbake på klientens photos-array. Uten den ville et bilde
  // som filtreres bort her forskyve alle de påfølgende, og filene havne på
  // feil sti.
  const uploads: { index: number; path: string }[] = [];

  for (const [index, photo] of photos.entries()) {
    if (!ALLOWED_TYPES.includes(clean(photo?.type, 80))) continue;
    uploads.push({ index, path: `${logId}/${index + 1}-${safeName(photo?.name ?? '', index)}` });
  }

  // Uten bilder er rapporten komplett med én gang – avslutt og varsle nå.
  if (uploads.length === 0) {
    await finishMaintenance(supabase, logId, [], lang);
  }

  return NextResponse.json({
    ok: true,
    logId,
    bucket: MAINTENANCE_BUCKET,
    uploads,
  });
}
