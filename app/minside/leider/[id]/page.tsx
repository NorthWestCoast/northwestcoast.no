import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import ServiceBadge from '@/components/minside/service-badge';
import { dato } from '@/lib/format';

const RESULT_LABEL: Record<string, string> = {
  ok: 'Godkjent',
  ok_with_remarks: 'Godkjent med anmerkning',
  failed: 'Ikke godkjent',
};

/**
 * Leiderside: alt som gjelder én fysisk leider.
 *
 * Service og mannskapets vedlikehold vises hver for seg, ikke i én felles
 * liste. Ved tilsyn er det forskjell på en fagmessig godkjenning og en
 * egenrapportering, og siden skal ikke viske ut den forskjellen.
 */
export default async function LeiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: ladder } = await supabase
    .from('ladder_status')
    .select('*')
    .eq('ladder_id', id)
    .maybeSingle();

  if (!ladder) notFound();

  const [{ data: services }, { data: maintenance }] = await Promise.all([
    supabase
      .from('service_reports')
      .select('id, performed_at, performed_by, result, findings, next_service_due')
      .eq('ladder_id', id)
      .order('performed_at', { ascending: false }),
    supabase
      .from('maintenance_logs')
      .select('id, performed_at, reporter_name, notes')
      .eq('ladder_id', id)
      .order('performed_at', { ascending: false }),
  ]);

  return (
    <>
      <p className="ms-crumb">
        {ladder.vessel_id ? (
          <Link href={`/minside/fartoy/${ladder.vessel_id}`}>← {ladder.vessel_name}</Link>
        ) : (
          <Link href="/minside">← Oversikt</Link>
        )}
      </p>

      <div className="ms-title-row">
        <h1>{ladder.serial_number}</h1>
        <ServiceBadge state={ladder.service_state} days={ladder.days_until_service} />
      </div>

      <section className="ms-section">
        <dl className="ms-kv ms-kv-wide">
          <div><dt>Produkt</dt><dd>{ladder.product_name}</dd></div>
          <div><dt>Produktnr.</dt><dd>{ladder.product_number}</dd></div>
          <div><dt>Lengde</dt><dd>{ladder.length_m ? `${ladder.length_m} m` : '–'}</dd></div>
          <div><dt>Trinn</dt><dd>{ladder.steps ?? '–'}</dd></div>
          <div><dt>Produsert</dt><dd>{dato(ladder.produced_at)}</dd></div>
          <div><dt>Installert</dt><dd>{dato(ladder.installed_at)}</dd></div>
          <div><dt>Fartøy</dt><dd>{ladder.vessel_name ?? '–'}</dd></div>
          <div><dt>Neste service</dt><dd>{dato(ladder.next_service_due)}</dd></div>
        </dl>
        <p className="ms-cert">
          Sertifisert etter ISO 799-1:2019 · Godkjent av Sjøfartsdirektoratet
        </p>
      </section>

      <section className="ms-section">
        <h2>Servicehistorikk</h2>
        <p className="ms-muted ms-hint">
          Fagmessig kontroll utført av NorthWest Coast. Dette er dokumentasjonen
          som gjelder ved tilsyn.
        </p>
        {services?.length ? (
          <table className="ms-table">
            <thead>
              <tr><th>Dato</th><th>Utført av</th><th>Resultat</th><th>Neste frist</th><th>Funn</th></tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>{dato(s.performed_at)}</td>
                  <td>{s.performed_by}</td>
                  <td>
                    <span
                      className={`ms-badge ms-badge-${
                        s.result === 'failed' ? 'overdue' : s.result === 'ok_with_remarks' ? 'due_soon' : 'ok'
                      }`}
                    >
                      {RESULT_LABEL[s.result]}
                    </span>
                  </td>
                  <td>{dato(s.next_service_due)}</td>
                  <td>{s.findings ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ms-muted">
            Ingen service registrert ennå. Neste frist er beregnet fra
            installasjonsdato.
          </p>
        )}
      </section>

      <section className="ms-section">
        <h2>Vedlikeholdslogg</h2>
        <p className="ms-muted ms-hint">
          Registrert av mannskapet om bord.
        </p>
        {maintenance?.length ? (
          <table className="ms-table">
            <thead><tr><th>Dato</th><th>Utført av</th><th>Kommentar</th></tr></thead>
            <tbody>
              {maintenance.map((m) => (
                <tr key={m.id}>
                  <td>{dato(m.performed_at)}</td>
                  <td>{m.reporter_name ?? '–'}</td>
                  <td>{m.notes ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ms-muted">
            Ingen egenrapportering registrert.{' '}
            <Link href="/vedlikehold">Registrer vedlikehold →</Link>
          </p>
        )}
      </section>
    </>
  );
}
