import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, rateLimit } from '@/lib/api-guard';
import { createServiceSupabase, hasServiceRole } from '@/lib/supabase/server';
import { SUPPORT_PHONE } from '@/lib/mail';
import { notifyMaintenance } from './notify';

// Signering av opplastings-URL-er og e-postutsending kan ta noen
// sekunder; standardgrensen er knapp når flere bilder er med.
export const maxDuration = 20;

/**
 * Trinn 1 av vedlikeholdsinnsending: lagre teksten, og gi klienten signerte
 * opplastings-URL-er for bildene.
 *
 * Bildebytes går ALDRI gjennom denne ruten. Tidligere kom de som base64 i
 * JSON-bodyen, og ett eneste 5 MB-bilde ble 6,7 MB – godt over Vercels
 * 4,5 MB grense for serverless-funksjoner. Nå laster nettleseren opp direkte
 * til Supabase Storage, og ruten håndterer bare metadata.
 */

type PhotoRequest = { name?: string; type?: string; capturedAt?: string | null };

const MAX_IMAGES = 10;
const BUCKET = 'maintenance-photos';
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
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (isBot(body)) return NextResponse.json({ ok: true, uploads: [] });

  if (!rateLimit(`maintenance:${clientIp(req)}`)) {
    return NextResponse.json(
      { error: 'For mange forsøk. Prøv igjen om noen minutter.' },
      { status: 429 },
    );
  }

  const name = clean(body.name, 120);
  const boat = clean(body.boat, 160);
  const imo = clean(body.imo, 20);
  const serial = clean(body.serial, 60);
  const email = clean(body.email, 160);
  const notes = clean(body.notes, 4000);
  const photos = (Array.isArray(body.photos) ? body.photos : []).slice(
    0,
    MAX_IMAGES,
  ) as PhotoRequest[];

  if (!name || !boat || !serial) {
    return NextResponse.json(
      { error: 'Navn, navn på båt og serienummer er påkrevd' },
      { status: 400 },
    );
  }
  if (email && !isEmail(email)) {
    return NextResponse.json({ error: 'E-postadressen ser ikke gyldig ut.' }, { status: 400 });
  }

  if (!hasServiceRole()) {
    console.error('[maintenance] Supabase er ikke konfigurert – rapport tapt.');
    return NextResponse.json(
      { error: `Vi klarte ikke å lagre rapporten nå. Ring oss på ${SUPPORT_PHONE}.` },
      { status: 500 },
    );
  }

  const supabase = createServiceSupabase();

  // Prøv å koble serienummeret til en registrert leider. Treffer vi ikke,
  // lagres innsendingen likevel med råteksten – en rapport skal aldri gå tapt
  // fordi oppslaget bommet.
  const { data: ladder } = await supabase
    .from('ladders')
    .select('id, vessel_id')
    .eq('serial_number', serial)
    .maybeSingle();

  const { data: log, error: logError } = await supabase
    .from('maintenance_logs')
    .insert({
      ladder_id: ladder?.id ?? null,
      vessel_id: ladder?.vessel_id ?? null,
      serial_number_raw: serial,
      vessel_name_raw: boat,
      imo_raw: imo || null,
      reporter_name: name,
      reporter_email: email || null,
      notes: notes || null,
      source: 'web',
    })
    .select('id')
    .single();

  if (logError || !log) {
    console.error('[maintenance] Kunne ikke lagre rapport:', logError);
    return NextResponse.json(
      { error: `Vi klarte ikke å lagre rapporten nå. Ring oss på ${SUPPORT_PHONE}.` },
      { status: 500 },
    );
  }

  // ── Signerte opplastings-URL-er ─────────────────────────────────────────
  // `index` peker tilbake på klientens photos-array. Uten den ville et
  // bilde som filtreres bort her forskyve alle de påfølgende, og filene
  // havne på feil sti.
  const uploads: { index: number; path: string; token: string }[] = [];

  for (const [index, photo] of photos.entries()) {
    const type = clean(photo.type, 80);
    if (!ALLOWED_TYPES.includes(type)) continue;

    const path = `${log.id}/${index + 1}-${safeName(photo.name ?? '', index)}`;

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (signError || !signed) {
      console.error('[maintenance] Kunne ikke signere opplasting:', signError);
      continue;
    }

    // Raden opprettes nå; fullfør-steget rydder bort de som aldri ble lastet opp.
    await supabase.from('maintenance_photos').insert({
      maintenance_log_id: log.id,
      storage_path: path,
      captured_at: typeof photo.capturedAt === 'string' ? photo.capturedAt : null,
    });

    uploads.push({ index, path, token: signed.token });
  }

  // Uten bilder er rapporten komplett med én gang – varsle nå.
  if (uploads.length === 0) {
    await notifyMaintenance(log.id);
  }

  return NextResponse.json({
    ok: true,
    logId: log.id,
    bucket: BUCKET,
    uploads,
    matchedLadder: Boolean(ladder),
  });
}
