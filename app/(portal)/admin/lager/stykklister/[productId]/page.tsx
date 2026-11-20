import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/supabase/staff';
import { uuid } from '@/lib/portal/forms';
import { Alert, Badge, Card, Disclosure, Empty, KV, PageHeader, Stat, Stats, Td } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { Hidden, Input, Select } from '@/components/admin/fields';
import { EXAMPLE_LENGTH_M, itemLabel, loadStockRows, type StockRow } from '@/components/lager/data';
import { PRODUCT_KINDS, PRODUCT_SOURCING, STOCK_SUPPLY } from '@/lib/portal/labels';
import { bottleneck, buildable, describeQty, fmtQty, num, parseQty, requiredQty } from '@/lib/stock';
import {
  addComponent,
  copyComponents,
  createFinishedItem,
  linkItem,
  removeComponent,
  setSourcing,
  unlinkItem,
  updateComponent,
} from '../actions';

export const metadata: Metadata = { title: 'Stykkliste' };

/** Tall til et skjemafelt: uten tusenskille, med norsk komma. Null vises som tomt felt. */
const fieldQty = (value: unknown) => (num(value) > 0 ? String(num(value)).replace('.', ',') : '');

/** Lengden «Behov» regnes for når produktet ikke har en fast lengde. */
function exampleLength(raw: string | undefined): number {
  const length = parseQty(raw);
  return length !== null && length >= 1 && length <= 30 ? length : EXAMPLE_LENGTH_M;
}

/** Nedtrekksliste med lagervarer, delt i deler og ferdigvarer. */
function ItemOptions({ items }: { items: StockRow[] }) {
  const parts = items.filter((item) => item.category !== 'finished');
  const finished = items.filter((item) => item.category === 'finished');
  return (
    <>
      {parts.length > 0 && (
        <optgroup label="Deler">
          {parts.map((item) => <option key={item.id} value={item.id}>{itemLabel(item)}</option>)}
        </optgroup>
      )}
      {finished.length > 0 && (
        <optgroup label="Ferdigvarer">
          {finished.map((item) => <option key={item.id} value={item.id}>{itemLabel(item)}</option>)}
        </optgroup>
      )}
    </>
  );
}

/** Mengde per enhet, mengde per meter og notat: samme felt for ny og eksisterende linje. */
function QuantityFields({
  scope,
  unit,
  values,
}: {
  scope: string;
  unit?: string;
  values?: { qty: unknown; qty_per_metre: unknown; note: string | null };
}) {
  const suffix = unit ? ` (${unit})` : '';
  return (
    <>
      <div className="pt-form-row">
        {/* Skrevet ut for hånd: hjelpetekstene er ulike lange, og feltene skal likevel stå på linje. */}
        <div className="pt-field" style={{ alignContent: 'start' }}>
          <label htmlFor={`${scope}-qty`}>Mengde per enhet{suffix}</label>
          <input
            id={`${scope}-qty`}
            name="qty"
            inputMode="decimal"
            maxLength={14}
            autoComplete="off"
            defaultValue={values ? fieldQty(values.qty) : ''}
          />
          <small>Det hver enhet bruker uansett lengde.</small>
        </div>
        <div className="pt-field" style={{ alignContent: 'start' }}>
          <label htmlFor={`${scope}-qty_per_metre`}>Mengde per meter leider{suffix}</label>
          <input
            id={`${scope}-qty_per_metre`}
            name="qty_per_metre"
            inputMode="decimal"
            maxLength={14}
            autoComplete="off"
            defaultValue={values ? fieldQty(values.qty_per_metre) : ''}
          />
          <small>Det som følger lengden, som tau og trinn. Ganges med lengden på jobben.</small>
        </div>
      </div>
      <Input
        scope={scope}
        name="note"
        label="Notat (valgfritt)"
        maxLength={500}
        autoComplete="off"
        defaultValue={values?.note ?? ''}
      />
    </>
  );
}

/**
 * Stykklista til ett produkt: hvordan det skaffes, lagervaren det selges som,
 * delene det består av, og hva som trengs og mangler for å bygge én enhet.
 *
 * `?endre=<linje>` åpner en linje for endring, og `?lengde=<meter>` setter
 * lengden behovet regnes for når produktet er en spesiallengde.
 */
export default async function StykklistePage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ endre?: string; lengde?: string }>;
}) {
  const [{ productId: rawId }, query] = await Promise.all([params, searchParams]);
  const productId = uuid(rawId);
  if (!productId) notFound();

  const { supabase } = await requireStaff();

  const [{ data: product }, { data: componentRows }, { data: catalog }, { data: allComponents }, openJobs, stock] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, kind, name, product_number, length_m, steps, sourcing, active')
        .eq('id', productId)
        .maybeSingle(),
      supabase
        .from('product_components')
        .select('id, item_id, qty, qty_per_metre, note, created_at')
        .eq('product_id', productId)
        .order('created_at', { ascending: true }),
      supabase.from('products').select('id, name, product_number, length_m').order('sort_order').order('product_number').limit(2000),
      supabase.from('product_components').select('product_id').limit(10000),
      supabase
        .from('production_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId)
        .in('status', ['queued', 'in_progress']),
      loadStockRows(supabase),
    ]);
  if (!product) notFound();

  const stockById = new Map(stock.map((item) => [item.id, item]));
  const finished = stock.find((item) => item.product_id === product.id) ?? null;
  const assembled = product.sourcing === 'assembled';

  const components = (componentRows ?? [])
    .map((component) => ({ ...component, item: stockById.get(component.item_id) ?? null }))
    .map((component) => ({
      ...component,
      number: component.item?.item_number ?? 'Ukjent vare',
      name: component.item?.name ?? '',
      unit: component.item?.unit ?? 'stk',
      available: component.item?.available ?? 0,
    }))
    .sort((a, b) => a.number.localeCompare(b.number, 'nb'));

  // Spesiallengden har ingen fast lengde: behovet regnes for lengden i adressen.
  const variableLength = product.kind === 'ladder' && product.length_m === null;
  const length = product.length_m ?? (variableLength ? exampleLength(query.lengde) : 0);
  const canBuild = assembled ? buildable(components, length) : null;
  const limit = assembled ? bottleneck(components, length) : null;

  const needs = components.map((component) => {
    const need = requiredQty(component, length);
    return { ...component, need, missing: Math.max(Math.round((need - component.available) * 1000) / 1000, 0) };
  });
  const short = needs.filter((component) => component.missing > 0);

  const inList = new Set(components.map((component) => component.item_id));
  const editing = components.find((component) => component.id === uuid(query.endre ?? null)) ?? null;
  // Produktets egen lagervare kan ikke være en del av seg selv.
  const addable = stock.filter((item) => item.active && !inList.has(item.id) && item.product_id !== product.id);
  const linkable = stock.filter((item) => item.product_id === null && !inList.has(item.id));

  const counts = new Map<string, number>();
  for (const row of allComponents ?? []) counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1);
  const sources = (catalog ?? []).filter((row) => row.id !== product.id && (counts.get(row.id) ?? 0) > 0);

  const base = `/admin/lager/stykklister/${product.id}`;
  const self = (extra: Record<string, string | undefined> = {}) => {
    const search = new URLSearchParams();
    if (variableLength && query.lengde) search.set('lengde', String(length));
    for (const [key, value] of Object.entries(extra)) if (value) search.set(key, value);
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };
  const fields = { product_id: product.id };
  const lengthText = `${fmtQty(length)} m`;

  return (
    <>
      <PageHeader
        title={product.name}
        description={[
          product.product_number,
          PRODUCT_KINDS[product.kind] ?? product.kind,
          product.length_m !== null ? `${fmtQty(product.length_m)} m` : variableLength ? 'lengden settes per jobb' : null,
        ].filter(Boolean).join(' · ')}
        crumbs={[
          { href: '/admin/lager', label: 'Lager' },
          { href: '/admin/lager/stykklister', label: 'Stykklister' },
          { label: product.name },
        ]}
        badge={
          <>
            <Badge tone={assembled ? 'info' : 'neutral'}>{PRODUCT_SOURCING[product.sourcing] ?? product.sourcing}</Badge>
            {!product.active && <Badge>Ikke aktiv</Badge>}
          </>
        }
      />

      <Stats>
        <Stat
          value={!assembled || components.length === 0 || canBuild === null ? '–' : canBuild}
          label={
            !assembled
              ? 'Kan bygges nå (kjøpes ferdig)'
              : components.length === 0
                ? 'Kan bygges nå (ingen stykkliste)'
                : variableLength ? `Kan bygges nå ved ${lengthText}` : 'Kan bygges nå'
          }
          tone={assembled && components.length > 0 ? (canBuild ? 'ok' : 'warn') : undefined}
        />
        <Stat value={components.length} label="Deler i stykklista" />
        <Stat
          value={finished ? fmtQty(finished.on_hand) : '–'}
          label={finished ? `Ferdige på lager (${finished.unit})` : 'Ferdige på lager (ingen lagervare)'}
        />
        <Stat value={openJobs.count ?? 0} label="Åpne produksjonsjobber" />
      </Stats>

      <Card title="Slik skaffes produktet">
        <PortalForm action={setSourcing} submitLabel="Lagre" resetOnSuccess={false}>
          <Hidden fields={fields} />
          <label className="pt-check">
            <input type="radio" name="sourcing" value="assembled" defaultChecked={assembled} />
            <span>
              <strong>{PRODUCT_SOURCING.assembled}</strong>
              <span className="pt-muted">
                {' '}– Settes sammen hos oss. Delene i stykklista under trekkes fra lager når en produksjonsjobb er ferdig montert.
              </span>
            </span>
          </label>
          <label className="pt-check">
            <input type="radio" name="sourcing" value="resale" defaultChecked={!assembled} />
            <span>
              <strong>{PRODUCT_SOURCING.resale}</strong>
              <span className="pt-muted">
                {' '}– Kjøpes ferdig og selges videre. Ingenting trekkes i produksjonen; enheten går ut av lager når den leveres.
              </span>
            </span>
          </label>
        </PortalForm>
      </Card>

      <Card
        title="Lagervare for det ferdige produktet"
        description="Lagervaren teller ferdige enheter. Uten den telles ikke ferdige enheter av dette produktet."
      >
        {finished ? (
          <div className="pt-form">
            <KV
              items={[
                {
                  label: 'Varenummer',
                  value: <Link href={`/admin/lager/${finished.id}`} className="pt-link pt-mono">{finished.item_number}</Link>,
                },
                { label: 'Navn', value: finished.name },
                { label: 'På lager', value: fmtQty(finished.on_hand, finished.unit) },
                { label: 'Forsyning', value: STOCK_SUPPLY[finished.supply] ?? finished.supply },
              ]}
            />
            <div>
              <ActionButton
                action={unlinkItem}
                fields={fields}
                label="Fjern koblingen"
                pendingLabel="Fjerner…"
                tone="danger"
                confirm={`Fjerne koblingen til ${finished.item_number}? Varen og beholdningen blir stående, men ferdige enheter av ${product.name} telles ikke lenger.`}
              />
            </div>
          </div>
        ) : (
          <div className="pt-form">
            <div>
              <ActionButton
                action={createFinishedItem}
                fields={fields}
                label="Opprett lagervare"
                pendingLabel="Oppretter…"
                tone="primary"
                size="md"
              />
              <p className="pt-hint" style={{ marginTop: '0.4rem' }}>
                Oppretter «{product.name}» med varenummer <span className="pt-mono">{product.product_number}</span>,
                {' '}som {product.kind === 'spare_part' ? 'del' : 'ferdigvare'} ({(STOCK_SUPPLY[assembled ? 'assembled' : 'purchased'] ?? '').toLowerCase()}), med beholdning 0.
              </p>
            </div>
            {linkable.length > 0 && (
              <details className="pt-more">
                <summary>Eller koble til en vare som finnes fra før</summary>
                <PortalForm action={linkItem} submitLabel="Koble til" resetOnSuccess={false}>
                  <Hidden fields={fields} />
                  <Select
                    scope="link"
                    name="item"
                    label="Lagervare"
                    required
                    defaultValue=""
                    hint="Bare varer som ikke hører til et annet produkt, og som ikke står i stykklista under."
                  >
                    <option value="" disabled>Velg vare</option>
                    <ItemOptions items={linkable} />
                  </Select>
                </PortalForm>
              </details>
            )}
          </div>
        )}
      </Card>

      {!assembled && components.length > 0 && (
        <Alert tone="info" title="Stykklista brukes ikke nå">
          Produktet står som videresalg, så delene under trekkes ikke når en jobb blir ferdig. Stykklista beholdes i
          tilfelle produktet bygges selv igjen.
        </Alert>
      )}

      <Card
        id="stykkliste"
        title={`Stykkliste (${components.length})`}
        description="Mengden én enhet bruker av hver del. «Per meter» ganges med lengden på leideren i jobben."
        flush
      >
        {components.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr><th>Varenr.</th><th>Del</th><th>Mengde</th><th className="pt-num">Tilgjengelig</th><th>Notat</th><th /></tr>
            </thead>
            <tbody>
              {components.map((component) => (
                <tr key={component.id}>
                  <Td label="Varenr." className="pt-nowrap">
                    <Link href={`/admin/lager/${component.item_id}`} className="pt-mono">{component.number}</Link>
                  </Td>
                  <Td label="Del" className="pt-table-strong">{component.name}</Td>
                  <Td label="Mengde">{describeQty(component, component.unit)}</Td>
                  <Td label="Tilgjengelig" className="pt-num">
                    <span>
                      {fmtQty(component.available, component.unit)}
                      {component.available < 0 && <> <Badge tone="danger">Må telles</Badge></>}
                    </span>
                  </Td>
                  <Td label="Notat">{component.note ?? ''}</Td>
                  <Td>
                    <div className="pt-actions" style={{ alignItems: 'center' }}>
                      <Link href={`${self({ endre: component.id })}#endre`} className="pt-btn pt-btn-ghost pt-btn-sm">Endre</Link>
                      <ActionButton
                        action={removeComponent}
                        fields={{ ...fields, component_id: component.id }}
                        label="Fjern"
                        pendingLabel="Fjerner…"
                        tone="danger"
                        confirm={`Fjerne ${component.number} fra stykklista til ${product.name}?`}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen deler i stykklista">
            {assembled
              ? 'Legg til delene under, eller kopier stykklista fra et produkt som ligner. Uten stykkliste trekkes ingen deler når en jobb blir ferdig.'
              : 'Produktet kjøpes ferdig og trenger ingen stykkliste.'}
          </Empty>
        )}

        {editing && (
          <details className="pt-disclosure" id="endre" open>
            <summary>Endre {editing.number}</summary>
            <div className="pt-disclosure-body">
              <PortalForm key={editing.id} action={updateComponent} submitLabel="Lagre linja" resetOnSuccess={false}>
                <Hidden fields={{ ...fields, component_id: editing.id }} />
                <QuantityFields scope="edit" unit={editing.unit} values={editing} />
              </PortalForm>
              <p className="pt-hint" style={{ marginTop: '0.6rem' }}>
                <Link href={`${self()}#stykkliste`} className="pt-link">Lukk uten å endre mer</Link>
              </p>
            </div>
          </details>
        )}

        <Disclosure summary="Legg til del" open={components.length === 0 && assembled}>
          {addable.length > 0 ? (
            <PortalForm action={addComponent} submitLabel="Legg til i stykklista">
              <Hidden fields={fields} />
              <Select scope="add" name="item" label="Del" required defaultValue="">
                <option value="" disabled>Velg vare</option>
                <ItemOptions items={addable} />
              </Select>
              <QuantityFields scope="add" />
            </PortalForm>
          ) : (
            <p className="pt-hint">
              {stock.length === 0
                ? <>Det finnes ingen lagervarer ennå. Legg dem inn under <Link href="/admin/lager" className="pt-link">Lager</Link> først.</>
                : 'Alle aktive lagervarer står allerede i stykklista.'}
            </p>
          )}
        </Disclosure>

        {sources.length > 0 && (
          <Disclosure summary="Kopier stykkliste fra et annet produkt">
            <PortalForm action={copyComponents} submitLabel="Kopier delene som mangler" pendingLabel="Kopierer…">
              <Hidden fields={fields} />
              <Select
                scope="copy"
                name="source"
                label="Kopier fra"
                required
                defaultValue=""
                hint="Legger til delene som mangler her, med samme mengder og notat. Deler som allerede står i stykklista, endres ikke, og ingenting fjernes. Rett mengdene som er annerledes etterpå."
              >
                <option value="" disabled>Velg produkt</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.product_number} · {source.name} ({counts.get(source.id)} deler)
                  </option>
                ))}
              </Select>
            </PortalForm>
          </Disclosure>
        )}
      </Card>

      {components.length > 0 && (
        <Card
          id="behov"
          title={variableLength ? `Behov for én enhet på ${lengthText}` : 'Behov for én enhet'}
          description={
            short.length === 0
              ? 'Alt som trengs til én enhet, er tilgjengelig.'
              : `${short.length} ${short.length === 1 ? 'del' : 'deler'} mangler for å bygge én enhet til.`
          }
          actions={
            variableLength && (
              <form action={base} method="get" className="pt-copy">
                <input
                  className="pt-input"
                  type="number"
                  name="lengde"
                  min={1}
                  max={30}
                  step={0.5}
                  defaultValue={length}
                  aria-label="Lengde i meter"
                  style={{ width: '6rem' }}
                />
                <button type="submit" className="pt-btn pt-btn-ghost">Vis for lengden</button>
              </form>
            )
          }
          footer={[
            'Tilgjengelig er beholdning minus det åpne produksjonsjobber kommer til å bruke.',
            limit && canBuild !== null ? ` Det er nok til ${canBuild} stk; ${limit.number} tar slutt først.` : '',
          ].join('')}
          flush
        >
          <table className="pt-table">
            <thead>
              <tr>
                <th>Varenr.</th><th>Del</th><th className="pt-num">Trengs</th>
                <th className="pt-num">Tilgjengelig</th><th className="pt-num">Mangler</th>
              </tr>
            </thead>
            <tbody>
              {needs.map((component) => (
                <tr key={component.id}>
                  <Td label="Varenr." className="pt-nowrap">
                    <Link href={`/admin/lager/${component.item_id}`} className="pt-mono">{component.number}</Link>
                  </Td>
                  <Td label="Del">{component.name}</Td>
                  <Td label="Trengs" className="pt-num">{fmtQty(component.need, component.unit)}</Td>
                  <Td label="Tilgjengelig" className="pt-num">{fmtQty(component.available, component.unit)}</Td>
                  <Td label="Mangler" className="pt-num">
                    {component.missing > 0 ? (
                      <div>
                        <Badge tone="warn">{fmtQty(component.missing, component.unit)}</Badge>
                        {component.item && component.item.on_order > 0 && (
                          <div className="pt-muted">{fmtQty(component.item.on_order, component.unit)} er bestilt</div>
                        )}
                      </div>
                    ) : (
                      <span className="pt-muted">Ingenting</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
