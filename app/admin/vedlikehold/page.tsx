import { requireStaff } from '@/lib/supabase/staff';
import ActionForm from '@/components/admin/action-form';
import { linkMaintenanceLog } from '../actions';

/**
 * Rydder opp i vedlikeholdsrapporter som ikke fant leideren sin.
 *
 * Det offentlige skjemaet tar imot hvilket som helst serienummer og lagrer
 * råteksten selv når oppslaget bommer – en innsending skal aldri gå tapt
 * fordi noen skrev feil. Her kobles de til riktig leider i ettertid.
 */
export default async function AdminVedlikeholdPage() {
  const { supabase } = await requireStaff();

  const [{ data: unmatched }, { data: ladders }, { data: recent }] = await Promise.all([
    supabase
      .from('maintenance_logs')
      .select('id, serial_number_raw, vessel_name_raw, imo_raw, reporter_name, reporter_email, performed_at, notes, created_at')
      .is('ladder_id', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, vessel_name')
      .not('ladder_id', 'is', null)
      .order('serial_number')
      .limit(300),
    supabase
      .from('maintenance_logs')
      .select('id, serial_number_raw, vessel_name_raw, performed_at, reporter_name')
      .not('ladder_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  return (
    <>
      <h1>Vedlikehold</h1>

      <section className="adm-section">
        <h2>Uparede rapporter ({unmatched?.length ?? 0})</h2>
        <p className="adm-hint">
          Serienummeret som ble oppgitt finnes ikke i registeret. Rapporten er
          tatt vare på med råteksten – vanligvis er det en skrivefeil, eller en
          leider som ikke er registrert ennå.
        </p>

        {unmatched?.length ? (
          <div className="adm-cards">
            {unmatched.map((log) => (
              <article key={log.id} className="adm-card">
                <header>
                  <strong>{log.serial_number_raw ?? 'uten serienummer'}</strong>
                  <span>{new Date(log.created_at).toLocaleDateString('nb-NO')}</span>
                </header>
                <dl>
                  <div><dt>Fartøy</dt><dd>{log.vessel_name_raw ?? '–'}</dd></div>
                  <div><dt>IMO</dt><dd>{log.imo_raw ?? '–'}</dd></div>
                  <div><dt>Innsender</dt><dd>{log.reporter_name ?? '–'}</dd></div>
                  <div><dt>E-post</dt><dd>{log.reporter_email ?? '–'}</dd></div>
                  <div><dt>Utført</dt><dd>{log.performed_at}</dd></div>
                </dl>
                {log.notes && <p className="adm-note">{log.notes}</p>}

                <ActionForm action={linkMaintenanceLog} submitLabel="Koble til leider">
                  <input type="hidden" name="log_id" value={log.id} />
                  <label>
                    Riktig leider
                    <select name="ladder_id" required defaultValue="">
                      <option value="" disabled>Velg leider…</option>
                      {ladders?.map((l) => (
                        <option key={l.ladder_id} value={l.ladder_id ?? ''}>
                          {l.serial_number}
                          {l.vessel_name ? ` · ${l.vessel_name}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </ActionForm>
              </article>
            ))}
          </div>
        ) : (
          <p className="adm-empty">Ingen uparede rapporter. 🎉</p>
        )}
      </section>

      <section className="adm-section">
        <h2>Siste koblede rapporter</h2>
        {recent?.length ? (
          <table className="adm-table">
            <thead><tr><th>Serienr</th><th>Fartøy</th><th>Utført</th><th>Innsender</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{r.serial_number_raw ?? '–'}</td>
                  <td>{r.vessel_name_raw ?? '–'}</td>
                  <td>{r.performed_at}</td>
                  <td>{r.reporter_name ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="adm-empty">Ingen registrerte rapporter ennå.</p>
        )}
      </section>
    </>
  );
}
