import Link from 'next/link';
import { Alert, Badge, Card, Empty, Stat, Stats, Tabs, Td } from '@/components/portal/ui';
import { SearchForm } from '@/components/admin/fields';
import { STOCK_CATEGORY, STOCK_SUPPLY } from '@/lib/portal/labels';
import { STOCK_STATE, fmtQty, stockState } from '@/lib/stock';
import {
  STOCK_VIEWS,
  type StockRow,
  type StockView,
  filterStock,
  qtyOrDash,
  summarize,
} from './data';

/**
 * Lageroversikten, slik den vises både i admin og i produksjon: nøkkeltall,
 * utvalg, søk og tabellen. Den er skrivebeskyttet; alt som endrer noe ligger
 * på siden for den enkelte varen under `basePath`.
 */

type Filter = { view: StockView; q: string; inactive: boolean };

function hrefFor(basePath: string, { view, q, inactive }: Filter): string {
  const params = new URLSearchParams();
  if (view !== 'alle') params.set('vis', view);
  if (q) params.set('q', q);
  if (inactive) params.set('inaktive', '1');
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Merket som sier hvordan det står til med en vare. */
export function StockBadge({ item }: { item: Pick<StockRow, 'on_hand' | 'available' | 'reorder_point'> }) {
  const state = STOCK_STATE[stockState(item)];
  return <Badge tone={state.tone}>{state.label}</Badge>;
}

/**
 * Tabellen over varer. Navnet lenker til `${basePath}/<id>`.
 *
 * Varenummer, navn og type står i samme celle. Det som er bundet står under
 * «på lager», og minimum under «tilgjengelig», som er det den måles mot. Med
 * én kolonne per opplysning (ni i alt) ble tabellen bredere enn siden på
 * nettbrett og små skjermer, og statusen havnet utenfor.
 */
export function StockTable({ rows, basePath }: { rows: StockRow[]; basePath: string }) {
  return (
    <table className="pt-table">
      <thead>
        <tr>
          <th>Vare</th>
          <th className="pt-num">På lager</th>
          <th className="pt-num">Tilgjengelig</th>
          <th className="pt-num">I bestilling</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td label="Vare">
              <div>
                <Link href={`${basePath}/${row.id}`} className="pt-table-strong">{row.name}</Link>
                <div className="pt-hint">
                  <span className="pt-mono">{row.item_number}</span>
                  {' · '}{STOCK_CATEGORY[row.category] ?? row.category}
                  {' · '}{STOCK_SUPPLY[row.supply] ?? row.supply}
                </div>
                {row.location && <div className="pt-hint">Lagerplass: {row.location}</div>}
              </div>
            </Td>
            <Td label="På lager" className="pt-num">
              <div>
                <span className="pt-table-strong">{fmtQty(row.on_hand, row.unit)}</span>
                {row.reserved !== 0 && <div className="pt-hint">{fmtQty(row.reserved)} bundet</div>}
              </div>
            </Td>
            <Td label="Tilgjengelig" className="pt-num">
              <div>
                {fmtQty(row.available)}
                {row.reorder_point > 0 && <div className="pt-hint">minimum {fmtQty(row.reorder_point)}</div>}
              </div>
            </Td>
            <Td label="I bestilling" className="pt-num">{qtyOrDash(row.on_order)}</Td>
            <Td label="Status">
              <div>
                <StockBadge item={row} />
                {!row.active && <> <Badge>Inaktiv</Badge></>}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StockOverview({
  rows,
  failed,
  basePath,
  view,
  q,
  inactive = false,
  admin = false,
}: {
  /** Alle varene, også inaktive. Utvalget gjøres her. */
  rows: StockRow[];
  failed: boolean;
  basePath: string;
  view: StockView;
  q: string;
  /** Vis også inaktive varer. */
  inactive?: boolean;
  /** Admin får lenke til innkjøpene og kan slå på inaktive varer. Produksjon får ingen av delene. */
  admin?: boolean;
}) {
  const totals = summarize(rows);
  const shown = filterStock(rows, { view, q, inactive });
  const filter: Filter = { view, q, inactive };

  // «Må telles» er bare en fane når det finnes noe å telle, eller man står der.
  const views = (Object.keys(STOCK_VIEWS) as StockView[]).filter(
    (key) => key !== 'ma-telles' || totals.toCount > 0 || view === 'ma-telles',
  );

  return (
    <>
      {failed && (
        <Alert tone="danger" title="Lageret kunne ikke leses">
          Last siden på nytt. Gi beskjed til en administrator hvis det fortsetter.
        </Alert>
      )}

      <Stats>
        <Stat value={totals.items} label="Varer" />
        <Stat
          value={totals.belowMinimum}
          label="Under minimum"
          tone={totals.belowMinimum > 0 ? 'warn' : undefined}
          href={hrefFor(basePath, { view: 'under-minimum', q: '', inactive: false })}
        />
        <Stat
          value={totals.onOrder}
          label="Varer i bestilling"
          tone={totals.onOrder > 0 ? 'info' : undefined}
          href={admin ? '/admin/lager/innkjop' : undefined}
        />
        <Stat
          value={totals.toCount}
          label="Må telles"
          tone={totals.toCount > 0 ? 'danger' : undefined}
          href={totals.toCount > 0 ? hrefFor(basePath, { view: 'ma-telles', q: '', inactive: false }) : undefined}
        />
      </Stats>

      <Tabs
        current={hrefFor(basePath, filter)}
        items={views.map((key) => ({ href: hrefFor(basePath, { ...filter, view: key }), label: STOCK_VIEWS[key] }))}
      />

      <Card
        title={q ? `Treff på «${q}» (${shown.length})` : `${STOCK_VIEWS[view]} (${shown.length})`}
        actions={
          <SearchForm
            action={basePath}
            q={q}
            placeholder="Søk på varenummer eller navn"
            keep={{ vis: view === 'alle' ? undefined : view, inaktive: inactive ? '1' : undefined }}
          />
        }
        footer={
          admin && (inactive || totals.inactive > 0) ? (
            inactive
              ? <Link href={hrefFor(basePath, { ...filter, inactive: false })} className="pt-link">Skjul inaktive varer</Link>
              : (
                <>
                  {totals.inactive === 1 ? '1 inaktiv vare er skjult. ' : `${totals.inactive} inaktive varer er skjult. `}
                  <Link href={hrefFor(basePath, { ...filter, inactive: true })} className="pt-link">
                    {totals.inactive === 1 ? 'Vis den' : 'Vis dem'}
                  </Link>
                </>
              )
          ) : undefined
        }
        flush
      >
        {shown.length > 0 ? (
          <StockTable rows={shown} basePath={basePath} />
        ) : (
          <Empty title={q || view !== 'alle' ? 'Ingen varer passer med utvalget' : 'Ingen varer på lager ennå'}>
            {q || view !== 'alle'
              ? <Link href={basePath} className="pt-link">Vis alle</Link>
              : admin ? 'Legg inn den første varen med «Ny vare» over.' : 'En administrator legger inn varene.'}
          </Empty>
        )}
      </Card>
    </>
  );
}
