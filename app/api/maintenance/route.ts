import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, isBot, isEmail, rateLimit } from '@/lib/api-guard';
import { createServiceSupabase, hasServiceRole } from '@/lib/supabase/server';
import { MAINTENANCE_EMAIL, SUPPORT_PHONE, sendMail } from '@/lib/mail';
import { maintenanceReceipt, maintenanceReport } from '@/lib/mail/templates';

type ImagePayload = { name: string; type: string; dataUrl: string; capturedAt?: string };

const MAX_IMAGES = 8;
const BUCKET = 'maintenance-photos';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (isBot(body)) return NextResponse.json({ ok: true });

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
  const images = (Array.isArray(body.images) ? body.images : []) as ImagePayload[];

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
  // fordi oppslaget bommet. NWC kan koble den manuelt senere.
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

  // ── Bilder til privat storage ───────────────────────────────────────────
  const accepted = images
    .slice(0, MAX_IMAGES)
    .filter((img) => typeof img?.dataUrl === 'string' && img.dataUrl.includes(','));

  const attachments: { filename: string; content: string }[] = [];
  let storedPhotos = 0;

  for (const [index, img] of accepted.entries()) {
    const base64 = img.dataUrl.split(',')[1];
    if (!base64) continue;

    const filename = clean(img.name, 120) || `bilde-${index + 1}.jpg`;
    attachments.push({ filename, content: base64 });

    const path = `${log.id}/${index + 1}-${filename.replace(/[^\w.\-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(base64, 'base64'), {
        contentType: clean(img.type, 80) || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('[maintenance] Kunne ikke laste opp bilde:', uploadError);
      continue;
    }

    // captured_at kommer fra klienten når filen har et tidspunkt. Er det
    // ukjent lar vi det stå tomt heller enn å påstå at opplastingstidspunktet
    // er da bildet ble tatt.
    const capturedAt = typeof img.capturedAt === 'string' ? img.capturedAt : null;

    await supabase.from('maintenance_photos').insert({
      maintenance_log_id: log.id,
      storage_path: path,
      captured_at: capturedAt,
    });
    storedPhotos += 1;
  }

  // ── Varsle NWC ──────────────────────────────────────────────────────────
  const report = maintenanceReport({
    name, boat, imo, serial, email, notes,
    photoCount: storedPhotos,
    matchedLadder: Boolean(ladder),
  });

  await sendMail(
    {
      to: MAINTENANCE_EMAIL,
      replyTo: email || undefined,
      subject: `Vedlikehold registrert – ${boat} (${serial})`,
      text: report,
      attachments: attachments.length > 0 ? attachments : undefined,
    },
    { template: 'maintenance_internal', relatedType: 'maintenance_log', relatedId: log.id },
  );

  if (email) {
    const receipt = maintenanceReceipt({ name, boat, serial, report });
    await sendMail(
      { to: email, replyTo: MAINTENANCE_EMAIL, ...receipt },
      { template: 'maintenance_receipt', relatedType: 'maintenance_log', relatedId: log.id },
    );
  }

  return NextResponse.json({ ok: true, matchedLadder: Boolean(ladder) });
}
