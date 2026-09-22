import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import ServiceBadge from '@/components/minside/service-badge';
import { dato } from '@/lib/format';

export default async function FartoyDetaljPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  // RLS gjør oppslaget trygt: er fartøyet et annet rederis, finnes det ikke
  // for denne brukeren, og maybeSingle() gir null.
  const { data: vessel } = await supabase
    .from('vessels')
    .select('id, name, imo, call_sign, mmsi, vessel_type, home_port')
    .eq('id', id)
    .maybeSingle();

  if (!vessel) notFound();

  const [{ data: ladders }, { data: maintenance }] = await Promise.all([
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, product_name, length_m, steps, installed_at, next_service_due, days_until_service, service_state, last_service_at')
      .eq('vessel_id', id)
      .order('serial_number'),
    supabase
      .from('maintenance_logs')
      .select('id, performed_at, reporter_name, notes, serial_number_raw')
      .eq('vessel_id', id)
      .order('performed_at', { ascending: false })
      .limit(10),
  ]);

  return (
    <>
      <p className="ms-crumb"><Link href="/minside/fartoy">← Fartøy</Link></p>
      <h1>{vessel.name}</h1>

      <section className="ms-section">
        <dl className="ms-kv ms-kv-wide">
          <div><dt>IMO</dt><dd>{vessel.imo ?? '–'}</dd></div>
          <div><dt>Kallesignal</dt><dd>{vessel.call_sign ?? '–'}</dd></div>
          <div><dt>MMSI</dt><dd>{vessel.mmsi ?? '–'}</dd></div>
          <div><dt>Type</dt><dd>{vessel.vessel_type ?? '–'}</dd></div>
          <div><dt>Hjemmehavn</dt><dd>{vessel.home_port ?? '–'}</dd></div>
        </dl>
      </section>

      <section className="ms-section">
        <h2>Leidere ({ladders?.length ?? 0})</h2>
        {ladders?.length ? (
          <div className="ms-cards">
            {ladders.map((l) => (
              <Link key={l.ladder_id} href={`/minside/leider/${l.ladder_id}`} className="ms-card">
                <h3>{l.serial_number}</h3>
                <dl className="ms-kv">
                  <div><dt>Produkt</dt><dd>{l.product_name}</dd></div>
                  <div><dt>Lengde</dt><dd>{l.length_m ? `${l.length_m} m` : '–'}</dd></div>
                  <div><dt>Installert</dt><dd>{dato(l.installed_at)}</dd></div>
                  <div><dt>Siste service</dt><dd>{dato(l.last_service_at)}</dd></div>
                  <div><dt>Neste service</dt><dd>{dato(l.next_service_due)}</dd></div>
                </dl>
                <ServiceBadge state={l.service_state} days={l.days_until_service} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="ms-muted">Ingen leidere registrert på dette fartøyet.</p>
        )}
      </section>

      <section className="ms-section">
        <h2>Vedlikeholdslogg</h2>
        {maintenance?.length ? (
          <table className="ms-table">
            <thead><tr><th>Dato</th><th>Leider</th><th>Utført av</th><th>Kommentar</th></tr></thead>
            <tbody>
              {maintenance.map((m) => (
                <tr key={m.id}>
                  <td>{dato(m.performed_at)}</td>
                  <td>{m.serial_number_raw ?? '–'}</td>
                  <td>{m.reporter_name ?? '–'}</td>
                  <td>{m.notes ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ms-muted">
            Ingen vedlikehold registrert. Registrer det på{' '}
            <Link href="/vedlikehold">vedlikeholdssiden</Link>.
          </p>
        )}
      </section>
    </>
  );
}
