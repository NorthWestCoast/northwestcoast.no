import { requireStaff } from '@/lib/supabase/staff';
import { createServiceSupabase, hasServiceRole } from '@/lib/supabase/server';
import ActionForm from '@/components/action-form';
import { updatePrices } from './actions';

const kr = (n: number | null) => (n === null ? '–' : `${n.toLocaleString('nb-NO')} kr`);

type Product = {
  id: string;
  product_number: string;
  name: string;
  kind: 'ladder' | 'cabinet' | 'spare_part';
  length_m: number | null;
  steps: number | null;
  price_nok: number;
  price_on_request: boolean;
  active: boolean;
};

export default async function PriserPage() {
  const { supabase } = await requireStaff();

  const { data, error } = await supabase
    .from('products')
    .select('id, product_number, name, kind, length_m, steps, price_nok, price_on_request, active')
    .order('product_number');

  const products = (data ?? []) as Product[];
  const ladders = products
    .filter((p) => p.kind === 'ladder')
    .sort((a, b) => (a.length_m ?? 0) - (b.length_m ?? 0));
  const cabinets = products.filter((p) => p.kind === 'cabinet');
  const others = products.filter((p) => p.kind === 'spare_part');

  const { data: history } = await supabase
    .from('product_price_history')
    .select('id, changed_at, old_price_nok, new_price_nok, old_on_request, new_on_request, changed_by, products(name)')
    .order('changed_at', { ascending: false })
    .limit(20);

  // Hvem gjorde endringen? E-post ligger i auth.users og kan bare leses med
  // service-role. Siden er allerede bare for ansatte. Mangler nøkkelen, viser
  // vi bare «ansatt».
  const emails = new Map<string, string>();
  if (hasServiceRole()) {
    const admin = createServiceSupabase();
    const ids = [...new Set((history ?? []).map((h) => h.changed_by).filter((id): id is string => Boolean(id)))];
    await Promise.all(
      ids.map(async (id) => {
        const { data: res } = await admin.auth.admin.getUserById(id).catch(() => ({ data: null }));
        if (res?.user?.email) emails.set(id, res.user.email);
      }),
    );
  }

  const describe = (h: NonNullable<typeof history>[number]) => {
    if (h.old_on_request !== h.new_on_request) {
      return h.new_on_request
        ? `${kr(h.old_price_nok)} → pris på forespørsel`
        : `pris på forespørsel → ${kr(h.new_price_nok)}`;
    }
    return `${kr(h.old_price_nok)} → ${kr(h.new_price_nok)}`;
  };

  return (
    <>
      <h1>Priser</h1>
      <p className="adm-hint">
        Prisene her er det nettsiden, bestillingsskjemaet og kalkulatoren viser, og det
        serveren regner med når en bestilling kommer inn. Alle priser er hele kroner
        <strong> eks. mva</strong>. Endringer gjelder med en gang, og ordrer som allerede
        er lagt inn beholder prisen de ble lagt inn med.
      </p>

      {error && <p className="adm-error">Kunne ikke lese prislista: {error.message}</p>}

      <ActionForm action={updatePrices} submitLabel="Lagre priser">
        <section className="adm-section">
          <h2>Leidere</h2>
          <table className="adm-table adm-price-table">
            <thead>
              <tr>
                <th>Lengde</th>
                <th>Navn</th>
                <th>Produktnr.</th>
                <th>Trinn</th>
                <th>Pris eks. mva</th>
                <th>Pris på forespørsel</th>
                <th>Aktiv</th>
              </tr>
            </thead>
            <tbody>
              {ladders.map((p) => (
                <tr key={p.id}>
                  <td>{p.length_m} m</td>
                  <td>{p.name}</td>
                  <td>
                    <input
                      name={`p:${p.id}:number`}
                      defaultValue={p.product_number}
                      aria-label={`Produktnummer ${p.name}`}
                      maxLength={40}
                      required
                    />
                    {/^ARG-/i.test(p.product_number) && (
                      <span className="adm-badge adm-badge-amber">midlertidig nummer</span>
                    )}
                  </td>
                  <td>
                    <input
                      name={`p:${p.id}:steps`}
                      type="number"
                      min={1}
                      max={200}
                      defaultValue={p.steps ?? ''}
                      aria-label={`Antall trinn ${p.name}`}
                    />
                  </td>
                  <td>
                    <input
                      name={`p:${p.id}:price`}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      defaultValue={p.price_nok}
                      aria-label={`Pris ${p.name}`}
                    />
                  </td>
                  <td>
                    <input
                      name={`p:${p.id}:request`}
                      type="checkbox"
                      defaultChecked={p.price_on_request}
                      aria-label={`Pris på forespørsel ${p.name}`}
                    />
                  </td>
                  <td>
                    <input
                      name={`p:${p.id}:active`}
                      type="checkbox"
                      defaultChecked={p.active}
                      aria-label={`Aktiv ${p.name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="adm-hint">
            <strong>Pris på forespørsel:</strong> leideren vises i bestillingsskjemaet uten
            pris og teller ikke i totalsummen. Før du setter fast pris på en slik rad må
            du legge inn offisielt produktnummer og antall trinn.{' '}
            <strong>Aktiv:</strong> en leider som ikke er aktiv vises ikke på nettsiden.
          </p>
        </section>

        <section className="adm-section">
          <h2>Oppbevaringsskap</h2>
          <table className="adm-table adm-price-table">
            <thead>
              <tr>
                <th>Modell</th>
                <th>Produktnr.</th>
                <th>Pris eks. mva</th>
                <th>Aktiv</th>
              </tr>
            </thead>
            <tbody>
              {cabinets.map((p) => (
                <tr key={p.id}>
                  <td>{p.name.replace(/^Oppbevaringsskap\s+/i, '')}</td>
                  <td>
                    <input
                      name={`p:${p.id}:number`}
                      defaultValue={p.product_number}
                      aria-label={`Produktnummer ${p.name}`}
                      maxLength={40}
                      required
                    />
                  </td>
                  <td>
                    <input
                      name={`p:${p.id}:price`}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      defaultValue={p.price_nok}
                      aria-label={`Pris ${p.name}`}
                    />
                  </td>
                  <td>
                    <input
                      name={`p:${p.id}:active`}
                      type="checkbox"
                      defaultChecked={p.active}
                      aria-label={`Aktiv ${p.name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="adm-hint">
            Skapene er identifisert med modellnavn. Den gamle prislista brukte de samme
            400-06x-numrene på flere ulike modeller (for eksempel 400-062 både på
            ASC-LC3-5 og ASC-LC6-8), så de offisielle numrene må avklares før de legges
            inn her. Hvert skap må ha et unikt nummer.
          </p>
        </section>

        {others.length > 0 && (
          <section className="adm-section">
            <h2>Reservedeler</h2>
            <table className="adm-table adm-price-table">
              <thead>
                <tr>
                  <th>Navn</th>
                  <th>Produktnr.</th>
                  <th>Pris eks. mva</th>
                  <th>Aktiv</th>
                </tr>
              </thead>
              <tbody>
                {others.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      <input name={`p:${p.id}:number`} defaultValue={p.product_number} maxLength={40} required />
                    </td>
                    <td>
                      <input name={`p:${p.id}:price`} type="number" min={0} step={1} defaultValue={p.price_nok} />
                    </td>
                    <td>
                      <input name={`p:${p.id}:active`} type="checkbox" defaultChecked={p.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <label className="adm-check">
          <input name="confirm_large" type="checkbox" />
          Jeg har kontrollert store endringer (over 50 %)
        </label>
      </ActionForm>

      <section className="adm-section">
        <h2>Siste prisendringer</h2>
        {!history || history.length === 0 ? (
          <p className="adm-empty">Ingen prisendringer er registrert ennå.</p>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Tidspunkt</th>
                <th>Vare</th>
                <th>Endring</th>
                <th>Av</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.changed_at).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>{h.products?.name ?? '–'}</td>
                  <td>{describe(h)}</td>
                  <td>{h.changed_by ? (emails.get(h.changed_by) ?? 'ansatt') : 'system / SQL'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
