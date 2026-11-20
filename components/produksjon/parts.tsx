import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/lib/supabase/database.types';
import { Alert, Badge, Card, Td } from '@/components/portal/ui';
import { loadStockByIds, loadStockByProducts, type StockRow } from '@/components/lager/data';
import { fmtQty, num, requiredQty } from '@/lib/stock';
import { datoTid } from '@/lib/format';

type Job = Pick<
  Tables<'production_jobs'>,
  | 'id' | 'kind' | 'status' | 'product_id' | 'product_name' | 'length_m'
  | 'with_cabinet' | 'cabinet_name' | 'cabinet_product_id' | 'stock_posted_at' | 'stock_sold_at'
>;

/** Beholdningen av en vare, med merke når det er ført mer ut enn inn. */
function OnHand({ item }: { item: StockRow | undefined }) {
  if (!item) return <>–</>;
  return (
    <span>
      {fmtQty(item.on_hand, item.unit)}
      {item.on_hand < 0 && <> <Badge tone="danger">Må telles</Badge></>}
    </span>
  );
}

/**
 * «Deler» på en produksjonsjobb: hva jobben bruker av hver del, hva som
 * ligger på lager, og om delene er trukket.
 *
 * Databasen trekker delene selv første gang jobben blir ferdig
 * (stock_posted_at). Før det vises behovet etter stykklista og lengden på
 * jobben; etterpå vises det som faktisk ble trukket, for stykklista kan være
 * endret siden. Mangler en del, er det et varsel og ikke en sperre:
 * produksjonen stoppes aldri av en feil telling.
 *
 * Produksjon får ingen lenker inn i admin. Bare administratorer får lenken
 * til stykklista.
 */
export async function JobParts({
  supabase,
  job,
  isAdmin,
}: {
  supabase: SupabaseClient<Database>;
  job: Job;
  isAdmin: boolean;
}) {
  const [{ data: product }, { data: componentRows }, { data: movementRows }, sold] = await Promise.all([
    // Produksjon ser bare aktive produkter. Er produktet tatt ut av salg,
    // kommer det ingen rad, og kortet nøyer seg med stykklista.
    supabase.from('products').select('sourcing, length_m').eq('id', job.product_id).maybeSingle(),
    supabase.from('product_components').select('item_id, qty, qty_per_metre').eq('product_id', job.product_id),
    job.stock_posted_at
      ? supabase.from('stock_movements').select('item_id, quantity').eq('job_id', job.id).eq('kind', 'production_out')
      : Promise.resolve({ data: [] }),
    // Den ferdige enheten, og skapet som følger med, går ut av lager ved levering.
    loadStockByProducts(
      supabase,
      [job.product_id, job.with_cabinet ? job.cabinet_product_id : null].filter((id): id is string => Boolean(id)),
    ),
  ]);

  const components = componentRows ?? [];
  const used = new Map<string, number>();
  for (const movement of movementRows ?? []) {
    used.set(movement.item_id, (used.get(movement.item_id) ?? 0) - num(movement.quantity));
  }

  const items = await loadStockByIds(supabase, [...new Set([...components.map((c) => c.item_id), ...used.keys()])]);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const finished = sold.find((item) => item.product_id === job.product_id);
  const cabinet = job.with_cabinet ? sold.find((item) => item.product_id === job.cabinet_product_id) : undefined;

  const posted = job.stock_posted_at !== null;
  const open = job.status === 'queued' || job.status === 'in_progress';
  const resale = product ? product.sourcing === 'resale' : false;
  const thing = job.kind === 'cabinet' ? 'Skapet' : 'Leideren';
  const stockLink = <Link href="/produksjon/lager" className="pt-btn pt-btn-ghost pt-btn-sm">Åpne lageret</Link>;

  /** Enheten er verken levert eller kansellert: den skal fortsatt ut av lageret. */
  const pending = job.stock_sold_at === null && job.status !== 'cancelled';

  const cabinetLine = cabinet && pending && (
    <p className="pt-hint">
      Oppbevaringsskapet{job.cabinet_name ? ` ${job.cabinet_name}` : ''} tas fra lager når jobben leveres. På lager
      nå: {fmtQty(cabinet.on_hand, cabinet.unit)}.
    </p>
  );

  // Delene er trukket: vis det som faktisk gikk ut. Det gjelder også om
  // produktet siden er satt til videresalg.
  if (used.size > 0) {
    const rows = [...used.entries()]
      .map(([itemId, quantity]) => ({ item: itemById.get(itemId), quantity, itemId }))
      .sort((a, b) => (a.item?.item_number ?? '').localeCompare(b.item?.item_number ?? '', 'nb'));

    return (
      <Card
        title="Deler"
        description={`Delene ble trukket fra lager ${datoTid(job.stock_posted_at)}.`}
        actions={stockLink}
        flush
      >
        <table className="pt-table">
          <thead>
            <tr><th>Varenr.</th><th>Del</th><th className="pt-num">Trukket</th><th className="pt-num">På lager nå</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.itemId}>
                <Td label="Varenr." className="pt-nowrap"><span className="pt-mono">{row.item?.item_number ?? '–'}</span></Td>
                <Td label="Del">{row.item?.name ?? 'Ukjent vare'}</Td>
                <Td label="Trukket" className="pt-num">{fmtQty(row.quantity, row.item?.unit)}</Td>
                <Td label="På lager nå" className="pt-num"><OnHand item={row.item} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
        {cabinetLine && <div style={{ padding: '0.8rem 1.1rem' }}>{cabinetLine}</div>}
      </Card>
    );
  }

  // Videresalg: ingenting monteres, enheten tas fra hylla.
  if (resale) {
    return (
      <Card title="Deler" actions={stockLink}>
        <div className="pt-form">
          <p>
            {thing} kjøpes ferdig og selges videre. Ingenting settes sammen og ingen deler trekkes:{' '}
            {job.status === 'cancelled'
              ? 'jobben er kansellert, så ingenting er tatt fra lager.'
              : job.stock_sold_at
                ? 'enheten ble tatt fra lager da jobben ble levert.'
                : 'enheten tas fra lager når jobben leveres.'}
          </p>
          {finished ? (
            pending && (
              <p className="pt-hint">
                På lager nå: {fmtQty(finished.on_hand, finished.unit)} (<span className="pt-mono">{finished.item_number}</span>).
                {finished.on_hand < 1 && ' Det er ikke registrert noen på lager. Jobben kan leveres likevel, og beholdningen må da telles.'}
              </p>
            )
          ) : (
            <p className="pt-hint">Produktet har ingen lagervare, så beholdningen av det telles ikke.</p>
          )}
          {cabinetLine}
        </div>
      </Card>
    );
  }

  // Ferdig, men uten noe å trekke.
  if (posted) {
    return (
      <Card title="Deler" actions={stockLink}>
        <div className="pt-form">
          <p className="pt-hint">
            Ingen deler ble trukket fra lager: produktet hadde ingen stykkliste da jobben ble ferdig.
          </p>
          {cabinetLine}
        </div>
      </Card>
    );
  }

  // Jobben er avsluttet uten at noe ble trukket (kansellert før den var
  // ferdig, eller ferdig før lageret ble tatt i bruk).
  if (!open) {
    return (
      <Card title="Deler" actions={stockLink}>
        <p className="pt-hint">
          {job.status === 'cancelled'
            ? 'Jobben ble kansellert før den var ferdig, så ingen deler er trukket fra lager.'
            : 'Det er ikke trukket deler fra lager for denne jobben. Den ble ferdig før lageret ble tatt i bruk.'}
        </p>
      </Card>
    );
  }

  if (components.length === 0) {
    return (
      <Card title="Deler" actions={stockLink}>
        <p className="pt-hint">
          Produktet har ingen stykkliste, så ingen deler trekkes fra lager når jobben blir ferdig.
          {isAdmin && (
            <> <Link href={`/admin/lager/stykklister/${job.product_id}`} className="pt-link">Legg inn stykklista</Link></>
          )}
        </p>
      </Card>
    );
  }

  // Samme regning som databasen gjør når jobben blir ferdig.
  const length = job.length_m ?? product?.length_m ?? 0;
  const rows = components
    .map((component) => {
      const item = itemById.get(component.item_id);
      const need = requiredQty(component, length);
      const onHand = item?.on_hand ?? 0;
      return { item, itemId: component.item_id, need, missing: Math.max(Math.round((need - onHand) * 1000) / 1000, 0) };
    })
    .filter((row) => row.need > 0)
    .sort((a, b) => (a.item?.item_number ?? '').localeCompare(b.item?.item_number ?? '', 'nb'));
  const short = rows.filter((row) => row.missing > 0);

  return (
    <Card
      title="Deler"
      description="Delene trekkes fra lager av seg selv når alle steg er kvittert ut."
      actions={
        <>
          {isAdmin && (
            <Link href={`/admin/lager/stykklister/${job.product_id}`} className="pt-btn pt-btn-ghost pt-btn-sm">Stykklista</Link>
          )}
          {stockLink}
        </>
      }
      flush
    >
      {short.length > 0 && (
        <div style={{ padding: '1.1rem 1.1rem 0' }}>
          <Alert
            tone="warn"
            title={short.length === 1 ? 'Det er for lite på lager av 1 del' : `Det er for lite på lager av ${short.length} deler`}
          >
            Jobben kan fullføres likevel. Beholdningen blir da negativ og må telles. Gi beskjed hvis delene faktisk mangler.
          </Alert>
        </div>
      )}
      <table className="pt-table">
        <thead>
          <tr><th>Varenr.</th><th>Del</th><th className="pt-num">Trengs</th><th className="pt-num">På lager nå</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.itemId}>
              <Td label="Varenr." className="pt-nowrap"><span className="pt-mono">{row.item?.item_number ?? '–'}</span></Td>
              <Td label="Del">{row.item?.name ?? 'Ukjent vare'}</Td>
              <Td label="Trengs" className="pt-num">{fmtQty(row.need, row.item?.unit)}</Td>
              <Td label="På lager nå" className="pt-num"><OnHand item={row.item} /></Td>
              <Td label="Status">
                <div>
                  {row.missing > 0
                    ? <Badge tone="warn">Mangler {fmtQty(row.missing, row.item?.unit)}</Badge>
                    : <Badge tone="ok">Nok på lager</Badge>}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
      {cabinetLine && <div style={{ padding: '0.8rem 1.1rem' }}>{cabinetLine}</div>}
    </Card>
  );
}
