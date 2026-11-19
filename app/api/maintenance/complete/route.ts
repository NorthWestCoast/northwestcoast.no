import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, langOf, rateLimit } from '@/lib/api-guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { finishMaintenance } from '../notify';

// E-postutsendingen kan ta noen sekunder; standardgrensen er knapp.
export const maxDuration = 30;

const MAX_IMAGES = 10;

/**
 * Trinn 2: klienten melder fra hvilke bilder som ble lastet opp, rapporten
 * avsluttes, og NWC varsles.
 *
 * Tilgangsvurdering: logId er en tilfeldig UUID som bare den som nettopp
 * sendte inn rapporten kjenner. finish_maintenance_report() tar bare imot
 * rapporter fra skjemaet de siste to timene, knytter bare til filer som
 * faktisk ligger i rapportens egen mappe, og er idempotent. Det verste et
 * treff kan utrette er å avslutte en rapport som uansett finnes.
 *
 * Kommer kallet aldri – mannskapet mistet dekningen – er teksten fortsatt
 * lagret, og rapporten ligger igjen med notified_at = null.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const logId = clean(body.logId, 64).toLowerCase();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(logId)) {
    return NextResponse.json({ error: 'Ugyldig id.' }, { status: 400 });
  }

  if (!rateLimit(`maintenance-complete:${clientIp(req)}`, { limit: 20 })) {
    return NextResponse.json({ error: 'For mange forsøk.' }, { status: 429 });
  }

  // Bare stier i rapportens egen mappe sendes videre. Databasen sjekker det
  // samme, og at filene faktisk finnes.
  const paths = (Array.isArray(body.paths) ? body.paths : [])
    .filter((path): path is string => typeof path === 'string')
    .map((path) => path.trim())
    .filter((path) => path.length <= 200 && path.startsWith(`${logId}/`))
    .slice(0, MAX_IMAGES);

  try {
    const supabase = await createServerSupabase();
    const result = await finishMaintenance(supabase, logId, paths, langOf(body));
    return NextResponse.json({ ok: result.ok, photos: result.photos });
  } catch (error) {
    console.error('[maintenance] Kunne ikke avslutte rapporten:', error);
    return NextResponse.json({ error: 'Ikke tilgjengelig.' }, { status: 500 });
  }
}
