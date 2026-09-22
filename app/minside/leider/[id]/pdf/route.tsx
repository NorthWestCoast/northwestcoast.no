import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import MaintenanceLogDocument, {
  type MaintenanceLogData,
  type PdfPhoto,
} from '@/lib/pdf/maintenance-log';
import { createServerSupabase, createServiceSupabase, hasServiceRole } from '@/lib/supabase/server';

// Henting av bilder fra Storage og PDF-rendering tar noen sekunder.
export const maxDuration = 60;

const BUCKET = 'maintenance-photos';
/** Flere enn dette gjør dokumentet tungt uten å tilføre dokumentasjonsverdi. */
const MAX_PHOTOS = 12;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // ── Autorisasjon: brukerens EGEN sesjon, filtrert av RLS ────────────────
  // Er leideren et annet rederis, finnes den ikke for denne brukeren, og
  // oppslaget gir null. Ingen egen eierskapssjekk trengs i koden.
  const supabase = await createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/logg-inn?neste=/minside', _request.nextUrl.origin));
  }

  const { data: ladder } = await supabase
    .from('ladder_status')
    .select('ladder_id, serial_number, product_name, product_number, length_m, steps, produced_at, installed_at, next_service_due, vessel_id, vessel_name, imo, company_id')
    .eq('ladder_id', id)
    .maybeSingle();

  if (!ladder) {
    return NextResponse.json({ error: 'Fant ikke leideren.' }, { status: 404 });
  }

  const [{ data: services }, { data: logs }, { data: company }] = await Promise.all([
    supabase
      .from('service_reports')
      .select('performed_at, performed_by, result, findings, next_service_due')
      .eq('ladder_id', id)
      .order('performed_at', { ascending: false }),
    supabase
      .from('maintenance_logs')
      .select('id, performed_at, reporter_name, notes')
      .eq('ladder_id', id)
      .order('performed_at', { ascending: false }),
    ladder.company_id
      ? supabase.from('companies').select('name').eq('id', ladder.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const logIds = (logs ?? []).map((l) => l.id);

  // Bilderadene leses også gjennom RLS – de er dermed verifisert å tilhøre
  // logger brukeren har tilgang til.
  const { data: photoRows } = logIds.length
    ? await supabase
        .from('maintenance_photos')
        .select('maintenance_log_id, storage_path, captured_at, uploaded_at')
        .in('maintenance_log_id', logIds)
        .order('captured_at', { ascending: false, nullsFirst: false })
    : { data: [] as { maintenance_log_id: string; storage_path: string; captured_at: string | null; uploaded_at: string }[] };

  const photoCountByLog = new Map<string, number>();
  for (const row of photoRows ?? []) {
    photoCountByLog.set(
      row.maintenance_log_id,
      (photoCountByLog.get(row.maintenance_log_id) ?? 0) + 1,
    );
  }

  // ── Bildebytes ──────────────────────────────────────────────────────────
  // Storage-bøttene er private uten policyer, så nedlastingen krever
  // service-role. Den er trygg her fordi stiene kommer fra rader RLS allerede
  // har filtrert: vi henter kun filer brukeren nettopp beviste at hun ser.
  const selected = (photoRows ?? []).slice(0, MAX_PHOTOS);
  const photos: PdfPhoto[] = [];

  if (selected.length > 0 && hasServiceRole()) {
    const service = createServiceSupabase();
    const logDateById = new Map((logs ?? []).map((l) => [l.id, l.performed_at]));

    for (const row of selected) {
      const { data: blob, error } = await service.storage.from(BUCKET).download(row.storage_path);
      if (error || !blob) {
        console.error('[pdf] Kunne ikke hente bilde:', row.storage_path, error);
        continue;
      }

      const buffer = Buffer.from(await blob.arrayBuffer());
      photos.push({
        dataUri: `data:${blob.type || 'image/jpeg'};base64,${buffer.toString('base64')}`,
        capturedAt: row.captured_at,
        logDate: logDateById.get(row.maintenance_log_id) ?? '',
      });
    }
  }

  const generatedAt = new Date();
  const stamp = generatedAt.toISOString().slice(0, 10).replace(/-/g, '');

  const data: MaintenanceLogData = {
    // Dokumentreferanse gjør det mulig å vise til nøyaktig denne utskriften.
    reference: `${ladder.serial_number}-${stamp}-${generatedAt
      .toISOString()
      .slice(11, 16)
      .replace(':', '')}`,
    generatedAt,
    ladder: {
      serial_number: ladder.serial_number ?? '–',
      product_name: ladder.product_name,
      product_number: ladder.product_number,
      length_m: ladder.length_m,
      steps: ladder.steps,
      produced_at: ladder.produced_at,
      installed_at: ladder.installed_at,
      next_service_due: ladder.next_service_due,
    },
    vessel: ladder.vessel_name
      ? { name: ladder.vessel_name, imo: ladder.imo, company: company?.name ?? null }
      : null,
    services: services ?? [],
    maintenance: (logs ?? []).map((l) => ({
      performed_at: l.performed_at,
      reporter_name: l.reporter_name,
      notes: l.notes,
      photoCount: photoCountByLog.get(l.id) ?? 0,
    })),
    photos,
    photosOmitted: Math.max(0, (photoRows?.length ?? 0) - photos.length),
  };

  const buffer = await renderToBuffer(<MaintenanceLogDocument data={data} />);

  const filename = `Vedlikeholdslogg-${ladder.serial_number}-${stamp}.pdf`;

  // Buffer godtas ikke som BodyInit: siden TypeScript 5.7 er Uint8Array
  // generisk over ArrayBufferLike, og det matcher ikke BufferSource. En ren
  // ArrayBuffer er entydig gyldig, så vi kopierer over i en slik.
  const body = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(body).set(buffer);

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Loggen endrer seg, og dokumentet er personopplysninger – ingen caching.
      'Cache-Control': 'private, no-store',
    },
  });
}
