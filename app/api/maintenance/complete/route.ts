import { NextRequest, NextResponse } from 'next/server';
import { clean, clientIp, rateLimit } from '@/lib/api-guard';
import { hasServiceRole } from '@/lib/supabase/server';
import { notifyMaintenance } from '../notify';

/**
 * Trinn 2: klienten melder fra at bildene er lastet opp, og vi varsler NWC.
 *
 * Tilgangsvurdering: logId er en tilfeldig UUID som bare den som nettopp
 * sendte inn rapporten kjenner. Kombinert med at operasjonen er idempotent
 * (notified_at) er det verste et treff kan utrette å sende ett varsel om en
 * rapport som uansett finnes. Det forsvarer ikke et eget token-oppsett her.
 *
 * Kommer kallet aldri – mannskapet mistet dekningen – er teksten fortsatt
 * lagret, og raden ligger igjen med notified_at = null (indeksert, så en
 * opprydningsjobb kan plukke den opp).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const logId = clean(body.logId, 64);

  if (!/^[0-9a-f-]{36}$/i.test(logId)) {
    return NextResponse.json({ error: 'Ugyldig id.' }, { status: 400 });
  }

  if (!rateLimit(`maintenance-complete:${clientIp(req)}`, { limit: 20 })) {
    return NextResponse.json({ error: 'For mange forsøk.' }, { status: 429 });
  }

  if (!hasServiceRole()) {
    return NextResponse.json({ error: 'Ikke konfigurert.' }, { status: 500 });
  }

  const notified = await notifyMaintenance(logId);
  return NextResponse.json({ ok: notified });
}
