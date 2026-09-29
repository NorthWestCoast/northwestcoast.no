import { requireStaff } from '@/lib/supabase/staff';
import ActionForm from '@/components/action-form';
import { recordService } from '../actions';

export default async function ServicePage() {
  const { supabase } = await requireStaff();

  const [{ data: ladders }, { data: reports }] = await Promise.all([
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, vessel_name, next_service_due')
      .not('ladder_id', 'is', null)
      .order('next_service_due', { ascending: true, nullsFirst: false })
      .limit(300),
    supabase
      .from('service_reports')
      .select('id, ladder_id, performed_at, performed_by, result, next_service_due')
      .order('performed_at', { ascending: false })
      .limit(25),
  ]);

  const serialById = new Map(
    (ladders ?? []).map((l) => [l.ladder_id, l.serial_number]),
  );

  const RESULT_LABEL: Record<string, string> = {
    ok: 'Godkjent',
    ok_with_remarks: 'Godkjent med anmerkning',
    failed: 'Ikke godkjent',
  };

  return (
    <>
      <h1>Service</h1>

      <section className="adm-section">
        <h2>Registrer servicerapport</h2>
        <p className="adm-hint">
          Dette er fagmessig kontroll, ikke mannskapets egenrapportering – det
          er denne som teller ved tilsyn. Settes ikke neste frist manuelt,
          beregnes den fra leiderens eget serviceintervall.
        </p>
        <ActionForm action={recordService} submitLabel="Lagre rapport">
          <div className="adm-grid">
            <label>
              Leider *
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
            <label>Utført *<input name="performed_at" type="date" required /></label>
            <label>Utført av *<input name="performed_by" required placeholder="Navn" /></label>
            <label>
              Resultat *
              <select name="result" required defaultValue="ok">
                <option value="ok">Godkjent</option>
                <option value="ok_with_remarks">Godkjent med anmerkning</option>
                <option value="failed">Ikke godkjent</option>
              </select>
            </label>
            <label>Neste frist<input name="next_service_due" type="date" /></label>
          </div>
          <label className="adm-wide">
            Funn
            <textarea name="findings" rows={4} placeholder="Tilstand, utskiftede deler, avvik…" />
          </label>
        </ActionForm>
      </section>

      <section className="adm-section">
        <h2>Siste rapporter</h2>
        {reports?.length ? (
          <table className="adm-table">
            <thead>
              <tr><th>Leider</th><th>Dato</th><th>Utført av</th><th>Resultat</th><th>Neste</th></tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{serialById.get(r.ladder_id) ?? r.ladder_id.slice(0, 8)}</td>
                  <td>{r.performed_at}</td>
                  <td>{r.performed_by}</td>
                  <td>
                    <span
                      className={`adm-badge ${
                        r.result === 'failed'
                          ? 'adm-badge-red'
                          : r.result === 'ok_with_remarks'
                            ? 'adm-badge-amber'
                            : 'adm-badge-green'
                      }`}
                    >
                      {RESULT_LABEL[r.result]}
                    </span>
                  </td>
                  <td>{r.next_service_due ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="adm-empty">Ingen servicerapporter registrert.</p>
        )}
      </section>
    </>
  );
}
