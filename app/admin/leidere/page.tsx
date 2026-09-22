import { requireStaff } from '@/lib/supabase/staff';
import ActionForm from '@/components/action-form';
import { assignLadder, registerLadders } from '../actions';

export default async function LeiderePage() {
  const { supabase } = await requireStaff();

  const [{ data: products }, { data: ladders }, { data: vessels }] = await Promise.all([
    supabase
      .from('products')
      .select('id, product_number, name')
      .eq('kind', 'ladder')
      .eq('active', true)
      .order('product_number'),
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, product_name, status, vessel_name, next_service_due')
      .order('serial_number')
      .limit(200),
    supabase.from('vessels').select('id, name').order('name'),
  ]);

  const unassigned = (ladders ?? []).filter((l) => !l.vessel_name);

  return (
    <>
      <h1>Leidere</h1>

      <section className="adm-section">
        <h2>Registrer produserte leidere</h2>
        <p className="adm-hint">
          Produksjon skjer i serier, så serienumrene limes inn – ett per linje.
          Finnes ett av dem fra før, avvises hele partiet og ingenting lagres.
        </p>
        <ActionForm action={registerLadders} submitLabel="Registrer parti">
          <div className="adm-grid">
            <label>
              Produkt *
              <select name="product_id" required defaultValue="">
                <option value="" disabled>Velg produkt…</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.product_number} · {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>Produsert<input name="produced_at" type="date" /></label>
          </div>
          <label className="adm-wide">
            Serienumre *
            <textarea
              name="serial_numbers"
              required
              rows={6}
              placeholder={'ARG-2026-0101\nARG-2026-0102\nARG-2026-0103'}
            />
          </label>
        </ActionForm>
      </section>

      <section className="adm-section">
        <h2>Koble leider til fartøy</h2>
        <p className="adm-hint">
          {unassigned.length} leider(e) på lager uten fartøy. Settes
          installasjonsdato, regnes leideren som installert og
          servicefristen begynner å løpe.
        </p>
        <ActionForm action={assignLadder} submitLabel="Koble til fartøy">
          <div className="adm-grid">
            <label>
              Leider *
              <select name="ladder_id" required defaultValue="">
                <option value="" disabled>Velg leider…</option>
                {unassigned.map((l) => (
                  <option key={l.ladder_id} value={l.ladder_id ?? ''}>
                    {l.serial_number} · {l.product_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fartøy *
              <select name="vessel_id" required defaultValue="">
                <option value="" disabled>Velg fartøy…</option>
                {vessels?.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </label>
            <label>Installert<input name="installed_at" type="date" /></label>
          </div>
        </ActionForm>
      </section>

      <section className="adm-section">
        <h2>Registrerte ({ladders?.length ?? 0})</h2>
        {ladders?.length ? (
          <table className="adm-table">
            <thead>
              <tr><th>Serienr</th><th>Produkt</th><th>Status</th><th>Fartøy</th><th>Neste service</th></tr>
            </thead>
            <tbody>
              {ladders.map((l) => (
                <tr key={l.ladder_id}>
                  <td>{l.serial_number}</td>
                  <td>{l.product_name}</td>
                  <td>{l.status}</td>
                  <td>{l.vessel_name ?? <span className="adm-muted">på lager</span>}</td>
                  <td>{l.next_service_due ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="adm-empty">Ingen leidere registrert ennå.</p>
        )}
      </section>
    </>
  );
}
