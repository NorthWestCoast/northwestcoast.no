import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import ServiceBadge from '@/components/minside/service-badge';
import { dato } from '@/lib/format';

export default async function FartoyPage() {
  const supabase = await createServerSupabase();

  const [{ data: vessels }, { data: ladders }] = await Promise.all([
    supabase.from('vessels').select('id, name, imo, vessel_type, home_port').order('name'),
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, vessel_id, next_service_due, days_until_service, service_state'),
  ]);

  return (
    <>
      <h1>Fartøy</h1>

      {vessels?.length ? (
        <div className="ms-cards">
          {vessels.map((v) => {
            const own = (ladders ?? []).filter((l) => l.vessel_id === v.id);
            const worst =
              own.find((l) => l.service_state === 'overdue') ??
              own.find((l) => l.service_state === 'due_soon') ??
              own[0];
            return (
              <Link key={v.id} href={`/minside/fartoy/${v.id}`} className="ms-card">
                <h3>{v.name}</h3>
                <dl className="ms-kv">
                  <div><dt>IMO</dt><dd>{v.imo ?? '–'}</dd></div>
                  <div><dt>Type</dt><dd>{v.vessel_type ?? '–'}</dd></div>
                  <div><dt>Leidere</dt><dd>{own.length}</dd></div>
                  <div><dt>Neste service</dt><dd>{dato(worst?.next_service_due)}</dd></div>
                </dl>
                <ServiceBadge state={worst?.service_state ?? null} days={worst?.days_until_service} />
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="ms-muted">Ingen fartøy registrert på selskapet ennå.</p>
      )}
    </>
  );
}
