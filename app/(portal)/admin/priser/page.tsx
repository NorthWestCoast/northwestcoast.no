import { requireStaff } from '@/lib/supabase/staff';
import { Alert, Badge, Card, Disclosure, Empty, PageHeader, Td } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { Check, Hidden, Input, Select, Textarea } from '@/components/admin/fields';
import KeepForm from '@/components/admin/keep-form';
import { PRODUCT_KINDS } from '@/lib/portal/labels';
import { datoTid, nok } from '@/lib/format';
import type { Tables } from '@/lib/supabase/database.types';
import { createProduct, updatePrices, updateProduct } from './actions';

type Product = Pick<
  Tables<'products'>,
  'id' | 'product_number' | 'name' | 'kind' | 'length_m' | 'steps' | 'price_nok' | 'price_on_request' | 'active' | 'description' | 'sort_order'
>;

const kr = (value: number | null) => (value === null ? '–' : nok(value));

/** Produktnummer, pris og «aktiv» for én rad i prislista. Feltnavnene leses av lib/price-plan.ts. */
function NumberCell({ product }: { product: Product }) {
  return (
    <Td label="Produktnr.">
      <div style={{ minWidth: 0, flex: 1 }}>
        <input
          className="pt-input"
          style={{ minWidth: '5.5rem' }}
          name={`p:${product.id}:number`}
          defaultValue={product.product_number}
          aria-label={`Produktnummer ${product.name}`}
          maxLength={40}
          size={10}
          required
        />
        {product.kind === 'ladder' && /^ARG-/i.test(product.product_number) && (
          <Badge tone="warn">Midlertidig nummer</Badge>
        )}
      </div>
    </Td>
  );
}

function PriceCell({ product }: { product: Product }) {
  return (
    <Td label="Pris eks. mva">
      <input
        className="pt-input"
        style={{ minWidth: '4.75rem' }}
        name={`p:${product.id}:price`}
        inputMode="numeric"
        maxLength={9}
        defaultValue={product.price_nok}
        aria-label={`Pris ${product.name}`}
      />
    </Td>
  );
}

function CheckCell({ product, field, label, checked }: { product: Product; field: 'request' | 'active'; label: string; checked: boolean }) {
  return (
    <Td label={label}>
      <span className="pt-check">
        <input
          name={`p:${product.id}:${field}`}
          type="checkbox"
          defaultChecked={checked}
          aria-label={`${label} ${product.name}`}
        />
      </span>
    </Td>
  );
}

export default async function PriserPage() {
  const { supabase } = await requireStaff();

  const [{ data, error }, { data: history }] = await Promise.all([
    supabase
      .from('products')
      .select('id, product_number, name, kind, length_m, steps, price_nok, price_on_request, active, description, sort_order')
      .order('sort_order')
      .order('product_number'),
    supabase
      .from('product_price_history')
      .select('id, changed_at, old_price_nok, new_price_nok, old_on_request, new_on_request, changed_by, products(name)')
      .order('changed_at', { ascending: false })
      .limit(20),
  ]);

  const products: Product[] = data ?? [];
  const ladders = products.filter((p) => p.kind === 'ladder').sort((a, b) => (a.length_m ?? 0) - (b.length_m ?? 0));
  const cabinets = products.filter((p) => p.kind === 'cabinet');
  const spareParts = products.filter((p) => p.kind === 'spare_part');

  // Hvem gjorde endringen: navn fra profilene (ansatte kan lese alle).
  const changerIds = [...new Set((history ?? []).map((h) => h.changed_by).filter((id): id is string => Boolean(id)))];
  const { data: changers } = changerIds.length
    ? await supabase.from('profiles').select('user_id, full_name, email').in('user_id', changerIds)
    : { data: [] };
  const changerById = new Map((changers ?? []).map((p) => [p.user_id, p.full_name ?? p.email]));

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
      <PageHeader
        title="Produkter og priser"
        description="Prisene her er det nettsiden, bestillingsskjemaet og kalkulatoren viser, og det databasen regner med når en bestilling kommer inn. Hele kroner eks. mva."
      />

      {error && (
        <Alert tone="danger" title="Kunne ikke lese produktene">Last siden på nytt. Ingenting er endret.</Alert>
      )}

      <KeepForm action={updatePrices} submitLabel="Lagre priser" uncheckOnSuccess="confirm_large">
        <Card
          title="Leidere"
          description="Endringer gjelder med en gang. Bestillinger som allerede er lagt inn beholder prisen de ble lagt inn med."
          footer="Pris på forespørsel: leideren vises uten pris og teller ikke i summen. Før fast pris settes må raden ha offisielt produktnummer og antall trinn. Aktiv: bare aktive produkter vises for kundene."
          flush
        >
          {ladders.length ? (
            <table className="pt-table">
              <thead>
                <tr>
                  <th>Leider</th><th>Produktnr.</th><th>Trinn</th><th>Pris</th>
                  <th>På forespørsel</th><th>Aktiv</th>
                </tr>
              </thead>
              <tbody>
                {ladders.map((p) => (
                  <tr key={p.id}>
                    <Td label="Leider" className="pt-table-strong">
                      <span style={{ overflowWrap: 'normal' }}>{p.name}<span className="pt-muted"> · {p.length_m} m</span></span>
                    </Td>
                    <NumberCell product={p} />
                    <Td label="Trinn">
                      <input
                        className="pt-input"
                        style={{ minWidth: '3.25rem' }}
                        name={`p:${p.id}:steps`}
                        inputMode="numeric"
                        maxLength={3}
                        defaultValue={p.steps ?? ''}
                        aria-label={`Antall trinn ${p.name}`}
                      />
                    </Td>
                    <PriceCell product={p} />
                    <CheckCell product={p} field="request" label="Pris på forespørsel" checked={p.price_on_request} />
                    <CheckCell product={p} field="active" label="Aktiv" checked={p.active} />
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="Ingen leidere i katalogen" />
          )}
        </Card>

        {[
          { title: 'Oppbevaringsskap', rows: cabinets, footer: 'Hvert skap må ha et unikt produktnummer.' },
          { title: 'Reservedeler', rows: spareParts, footer: 'Aktive reservedeler kan bestilles på Min side.' },
        ].map((group) => group.rows.length > 0 && (
          <Card key={group.title} title={group.title} footer={group.footer} flush>
            <table className="pt-table">
              <thead>
                <tr><th>Produkt</th><th>Produktnr.</th><th>Pris</th><th>Aktiv</th></tr>
              </thead>
              <tbody>
                {group.rows.map((p) => (
                  <tr key={p.id}>
                    <Td label="Produkt" className="pt-table-strong">
                      <span style={{ overflowWrap: 'normal' }}>{p.name}</span>
                    </Td>
                    <NumberCell product={p} />
                    <PriceCell product={p} />
                    <CheckCell product={p} field="active" label="Aktiv" checked={p.active} />
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}

        <Check name="confirm_large" label="Jeg har kontrollert store endringer (over 50 %)" />
      </KeepForm>

      <Card title="Produkter" description="Nytt produkt, og navn, beskrivelse og sortering på de som finnes." flush>
        <Disclosure summary="Nytt produkt">
          <PortalForm action={createProduct} submitLabel="Opprett produkt">
            <div className="pt-form-row pt-form-row-3">
              <Select scope="new" name="kind" label="Type" required defaultValue="spare_part">
                {Object.entries(PRODUCT_KINDS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Input scope="new" name="product_number" label="Produktnummer" required maxLength={40} />
              <Input scope="new" name="name" label="Navn" required minLength={2} maxLength={160} />
            </div>
            <div className="pt-form-row pt-form-row-3">
              <Input
                scope="new"
                name="price_nok"
                label="Pris, kr eks. mva"
                type="number"
                min={0}
                step={1}
                required
                inputMode="numeric"
                defaultValue={0}
              />
              <Input
                scope="new"
                name="sort_order"
                label="Sortering"
                type="number"
                min={0}
                max={9999}
                inputMode="numeric"
                defaultValue={0}
                hint="Lavest tall vises først."
              />
            </div>
            <Textarea scope="new" name="description" label="Beskrivelse" rows={3} maxLength={2000} />

            <p className="pt-label">Bare for leidere</p>
            <div className="pt-form-row pt-form-row-3">
              <Input scope="new" name="length_m" label="Lengde (m)" inputMode="decimal" maxLength={5} placeholder="6" />
              <Input scope="new" name="steps" label="Antall trinn" type="number" min={1} max={200} inputMode="numeric" />
              <Select scope="new" name="cabinet_product_id" label="Tilhørende skap" defaultValue="">
                <option value="">Ingen</option>
                {cabinets.map((cabinet) => (
                  <option key={cabinet.id} value={cabinet.id}>{cabinet.name}</option>
                ))}
              </Select>
            </div>
            <Check name="price_on_request" label="Pris på forespørsel (leideren vises uten pris)" />
            <p className="pt-hint">
              Reservedeler som opprettes her kan bestilles på Min side så lenge de er aktive.
            </p>
          </PortalForm>
        </Disclosure>

        {products.map((p) => (
          <Disclosure key={p.id} summary={`${p.product_number} · ${p.name}${p.active ? '' : ' (ikke aktiv)'}`}>
            <PortalForm action={updateProduct} submitLabel="Lagre produktet" resetOnSuccess={false}>
              <Hidden fields={{ product_id: p.id }} />
              <div className="pt-form-row">
                <Input scope={p.id} name="name" label="Navn" required minLength={2} maxLength={160} defaultValue={p.name} />
                <Input
                  scope={p.id}
                  name="sort_order"
                  label="Sortering"
                  type="number"
                  min={0}
                  max={9999}
                  inputMode="numeric"
                  defaultValue={p.sort_order}
                  hint="Lavest tall vises først."
                />
              </div>
              <Textarea scope={p.id} name="description" label="Beskrivelse" rows={3} maxLength={2000} defaultValue={p.description ?? ''} />
              <Check name="active" label="Aktiv (vises for kundene)" defaultChecked={p.active} />
            </PortalForm>
          </Disclosure>
        ))}
      </Card>

      <Card title="Siste prisendringer" flush>
        {history?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Tidspunkt</th><th>Produkt</th><th>Endring</th><th>Av</th></tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <Td label="Tidspunkt">{datoTid(h.changed_at)}</Td>
                  <Td label="Produkt" className="pt-table-strong">{h.products?.name ?? '–'}</Td>
                  <Td label="Endring">{describe(h)}</Td>
                  <Td label="Av">{h.changed_by ? (changerById.get(h.changed_by) ?? 'Ansatt') : 'System'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen prisendringer er registrert ennå" />
        )}
      </Card>
    </>
  );
}
