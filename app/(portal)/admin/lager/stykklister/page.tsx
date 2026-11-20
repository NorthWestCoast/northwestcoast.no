import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Alert, Badge, Card, Empty, PageHeader, Td } from '@/components/portal/ui';
import { EXAMPLE_LENGTH_M, loadStockRows } from '@/components/lager/data';
import { PRODUCT_KINDS, PRODUCT_SOURCING } from '@/lib/portal/labels';
import { bottleneck, buildable, fmtQty } from '@/lib/stock';

export const metadata: Metadata = { title: 'Stykklister' };

const KIND_ORDER = ['ladder', 'cabinet', 'spare_part'];

/**
 * Stykklistene: hvert produkt med hvordan det skaffes, lagervaren det selges
 * som, og hvor mange som kan bygges av delene som ligger på lager nå.
 *
 * Leidere og skap står alltid her. Reservedeler står bare hvis de har en
 * stykkliste, noe som er uvanlig.
 */
export default async function StykklisterPage() {
  const { supabase } = await requireStaff();

  const [{ data: productRows, error }, { data: componentRows }, stock] = await Promise.all([
    supabase
      .from('products')
      .select('id, kind, name, product_number, length_m, sourcing, active, sort_order')
      .order('sort_order')
      .order('product_number')
      .limit(2000),
    supabase.from('product_components').select('product_id, item_id, qty, qty_per_metre').limit(10000),
    loadStockRows(supabase),
  ]);

  if (error) console.error('[lager] Kunne ikke hente produktene:', error.message);

  const stockById = new Map(stock.map((item) => [item.id, item]));
  const finishedByProduct = new Map(stock.filter((item) => item.product_id).map((item) => [item.product_id as string, item]));

  const products = (productRows ?? [])
    .map((product) => {
      const parts = (componentRows ?? [])
        .filter((component) => component.product_id === product.id)
        .map((component) => {
          const item = stockById.get(component.item_id);
          return { ...component, number: item?.item_number ?? 'ukjent vare', available: item?.available ?? 0 };
        });

      // Spesiallengden har ingen fast lengde: tallet vises for en eksempellengde.
      const example = product.kind === 'ladder' && product.length_m === null;
      const length = product.length_m ?? (example ? EXAMPLE_LENGTH_M : 0);
      const assembled = product.sourcing === 'assembled';

      return {
        ...product,
        parts: parts.length,
        example,
        assembled,
        finished: finishedByProduct.get(product.id) ?? null,
        canBuild: assembled ? buildable(parts, length) : null,
        limit: assembled ? bottleneck(parts, length) : null,
      };
    })
    .filter((product) => product.kind !== 'spare_part' || product.parts > 0)
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
        (a.length_m ?? Infinity) - (b.length_m ?? Infinity) ||
        a.product_number.localeCompare(b.product_number, 'nb'),
    );

  const withoutList = products.filter((product) => product.assembled && product.parts === 0).length;

  return (
    <>
      <PageHeader
        title="Stykklister"
        description="Hvilke deler hvert produkt består av, og hvor mye. Når en produksjonsjobb er ferdig montert, trekkes delene i stykklista fra lager av seg selv."
        crumbs={[{ href: '/admin/lager', label: 'Lager' }, { label: 'Stykklister' }]}
      />

      {error && <Alert tone="danger" title="Produktene kunne ikke hentes">Last siden på nytt.</Alert>}

      <Card
        title={`Produkter (${products.length})`}
        footer={[
          '«Kan bygges nå» regnes av det som er tilgjengelig: beholdning minus det åpne produksjonsjobber kommer til å bruke.',
          withoutList > 0
            ? ` ${withoutList} ${withoutList === 1 ? 'produkt' : 'produkter'} som bygges selv mangler stykkliste. For ${withoutList === 1 ? 'det' : 'dem'} trekkes ingen deler når en jobb blir ferdig.`
            : '',
        ].join('')}
        flush
      >
        {products.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Produktnr.</th><th>Produkt</th><th>Skaffes</th><th>Lagervare</th>
                <th className="pt-num">Deler</th><th>Kan bygges nå</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <Td label="Produktnr." className="pt-nowrap">
                    <span className="pt-mono">{product.product_number}</span>
                  </Td>
                  <Td label="Produkt" className="pt-table-strong">
                    <div>
                      <Link href={`/admin/lager/stykklister/${product.id}`}>{product.name}</Link>
                      {product.kind !== 'ladder' && <div className="pt-muted" style={{ fontWeight: 400 }}>{PRODUCT_KINDS[product.kind] ?? product.kind}</div>}
                      {!product.active && <div><Badge>Ikke aktiv</Badge></div>}
                    </div>
                  </Td>
                  <Td label="Skaffes">{PRODUCT_SOURCING[product.sourcing] ?? product.sourcing}</Td>
                  <Td label="Lagervare">
                    {product.finished ? (
                      <div>
                        <Link href={`/admin/lager/${product.finished.id}`} className="pt-mono">{product.finished.item_number}</Link>
                        <div className="pt-muted">{fmtQty(product.finished.on_hand, product.finished.unit)} på lager</div>
                      </div>
                    ) : (
                      <span className="pt-muted">Ingen</span>
                    )}
                  </Td>
                  <Td label="Deler" className="pt-num">{product.parts}</Td>
                  <Td label="Kan bygges nå">
                    {!product.assembled ? (
                      <span className="pt-muted">Kjøpes ferdig</span>
                    ) : product.parts === 0 ? (
                      <span className="pt-muted">Ingen stykkliste</span>
                    ) : (
                      <div>
                        <strong>{product.canBuild === null ? '–' : `${product.canBuild} stk`}</strong>
                        {product.example && <span className="pt-muted"> ved {EXAMPLE_LENGTH_M} m</span>}
                        {product.limit && (
                          <div className="pt-muted">
                            Begrenses av <span className="pt-mono">{product.limit.number}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title={error ? 'Produktene kunne ikke hentes' : 'Ingen produkter ennå'}>
            {error ? 'Last siden på nytt.' : (
              <>Leidere og skap legges inn under <Link href="/admin/priser" className="pt-link">Produkter og priser</Link>.</>
            )}
          </Empty>
        )}
      </Card>
    </>
  );
}
