import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';

/**
 * Admin-oversikt.
 *
 * Viser det som krever handling, ikke pene totaler: leidere med forfalt
 * service (som også er salgssignaler), rapporter som ikke fant leideren sin,
 * og ubehandlede bestillinger.
 */
export default async function AdminPage() {
  const { supabase } = await requireStaff();

  const [companies, vessels, ladders, overdue, unmatched, newOrders] = await Promise.all([
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('vessels').select('*', { count: 'exact', head: true }),
    supabase.from('ladders').select('*', { count: 'exact', head: true }),
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, vessel_name, next_service_due, days_until_service')
      .in('service_state', ['overdue', 'due_soon'])
      .order('next_service_due', { ascending: true })
      .limit(15),
    supabase
      .from('maintenance_logs')
      .select('id, serial_number_raw, vessel_name_raw, created_at')
      .is('ladder_id', null)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('orders')
      .select('id, order_number, contact_name, vessel_name, total_nok, created_at')
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const nok = (n: number) => n.toLocaleString('nb-NO');

  return (
    <>
      <h1>Oversikt</h1>

      <div className="adm-stats">
        <div className="adm-stat"><b>{companies.count ?? 0}</b><span>Selskap</span></div>
        <div className="adm-stat"><b>{vessels.count ?? 0}</b><span>Fartøy</span></div>
        <div className="adm-stat"><b>{ladders.count ?? 0}</b><span>Leidere</span></div>
      </div>

      <section className="adm-section">
        <h2>Service forfaller</h2>
        <p className="adm-hint">
          Forfalt service er både et avvik hos kunden og et salgssignal for dere.
        </p>
        {overdue.data?.length ? (
          <table className="adm-table">
            <thead>
              <tr><th>Serienr</th><th>Fartøy</th><th>Frist</th><th>Status</th></tr>
            </thead>
            <tbody>
              {overdue.data.map((row) => (
                <tr key={row.ladder_id}>
                  <td>{row.serial_number}</td>
                  <td>{row.vessel_name ?? '–'}</td>
                  <td>{row.next_service_due ?? '–'}</td>
                  <td>
                    {(row.days_until_service ?? 0) < 0 ? (
                      <span className="adm-badge adm-badge-red">
                        {Math.abs(row.days_until_service ?? 0)} dager på overtid
                      </span>
                    ) : (
                      <span className="adm-badge adm-badge-amber">
                        om {row.days_until_service} dager
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="adm-empty">Ingen leidere med forfallende service.</p>
        )}
      </section>

      <section className="adm-section">
        <h2>Uparede vedlikeholdsrapporter</h2>
        <p className="adm-hint">
          Innsendt med et serienummer som ikke finnes i registeret. Rapporten er
          tatt vare på – den mangler bare kobling.
        </p>
        {unmatched.data?.length ? (
          <table className="adm-table">
            <thead>
              <tr><th>Oppgitt serienr</th><th>Fartøy</th><th>Mottatt</th><th /></tr>
            </thead>
            <tbody>
              {unmatched.data.map((row) => (
                <tr key={row.id}>
                  <td>{row.serial_number_raw ?? '–'}</td>
                  <td>{row.vessel_name_raw ?? '–'}</td>
                  <td>{new Date(row.created_at).toLocaleDateString('nb-NO')}</td>
                  <td><Link href="/admin/vedlikehold">Koble →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="adm-empty">Ingen uparede rapporter.</p>
        )}
      </section>

      <section className="adm-section">
        <h2>Nye bestillinger</h2>
        {newOrders.data?.length ? (
          <table className="adm-table">
            <thead>
              <tr><th>Ordrenr</th><th>Kunde</th><th>Fartøy</th><th>Sum</th><th>Mottatt</th></tr>
            </thead>
            <tbody>
              {newOrders.data.map((row) => (
                <tr key={row.id}>
                  <td>{row.order_number}</td>
                  <td>{row.contact_name}</td>
                  <td>{row.vessel_name ?? '–'}</td>
                  <td>{nok(row.total_nok)} kr</td>
                  <td>{new Date(row.created_at).toLocaleDateString('nb-NO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="adm-empty">Ingen ubehandlede bestillinger.</p>
        )}
      </section>
    </>
  );
}
