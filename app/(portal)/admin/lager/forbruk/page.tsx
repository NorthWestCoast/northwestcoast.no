import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Alert, Card, Empty, PageHeader, Tabs, Td } from '@/components/portal/ui';
import { STOCK_CATEGORY } from '@/lib/portal/labels';
import { fmtQty, usagePeriod } from '@/lib/stock';
import { dato, idag } from '@/lib/format';
import { loadStock, loadUsage, qtyOrDash, signedQty } from '@/components/lager/data';

export const metadata: Metadata = { title: 'Forbruk' };

/** Periodene siden tilbyr. Nøklene er de usagePeriod() kjenner. */
const PERIODS = ['i-ar', 'i-fjor', '12-mnd', 'alt'] as const;

const TYPES = { alle: 'Alle', deler: 'Deler', ferdigvarer: 'Ferdigvarer' } as const;
type TypeKey = keyof typeof TYPES;
const CATEGORY: Record<TypeKey, string | null> = { alle: null, deler: 'part', ferdigvarer: 'finished' };

/** Lange kolonneoverskrifter får gå over to linjer, så tallene under får plassen. */
const WRAP = { whiteSpace: 'normal' } as const;

function href(period: string, type: TypeKey) {
  const params = new URLSearchParams();
  if (period !== 'i-ar') params.set('periode', period);
  if (type !== 'alle') params.set('type', type);
  const query = params.toString();
  return query ? `/admin/lager/forbruk?${query}` : '/admin/lager/forbruk';
}

/**
 * Hva som har gått hvor i en periode, én rad per vare som har hatt
 * bevegelser. Skillet mellom «brukt i produksjon» og «solgt direkte» er
 * hovedsaken. Varene har ulike enheter, så det er ingen sumrad.
 *
 * Åtte tall per vare får ikke plass som åtte kolonner uten at siden må
 * rulles sidelengs. Derfor står «ferdig montert» sammen med «mottatt» (det
 * som kom inn), og retur og justering, som sjelden er annet enn null, står
 * under varenavnet når de finnes.
 */
export default async function ForbrukPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; type?: string }>;
}) {
  const { supabase } = await requireStaff();
  const params = await searchParams;

  const periodKey = PERIODS.find((key) => key === params.periode) ?? 'i-ar';
  const type = (Object.keys(TYPES) as TypeKey[]).find((key) => key === params.type) ?? 'alle';
  const today = idag();
  const period = usagePeriod(periodKey, today);

  const [stock, { usage, failed }] = await Promise.all([loadStock(supabase), loadUsage(supabase, period)]);

  const rows = stock.rows
    .filter((item) => CATEGORY[type] === null || item.category === CATEGORY[type])
    .flatMap((item) => {
      const used = usage.get(item.id);
      return used ? [{ item, used }] : [];
    })
    // Mest brukt først: det som gikk til produksjon pluss det som ble solgt.
    .sort((a, b) =>
      (b.used.used_in_production + b.used.sold) - (a.used.used_in_production + a.used.sold)
      || a.item.item_number.localeCompare(b.item.item_number, 'nb'));

  return (
    <>
      <PageHeader
        title="Forbruk"
        description="Hvor mye av hver vare som har gått til produksjon, og hvor mye som er solgt direkte. Bare varer med bevegelser i perioden vises."
        crumbs={[{ href: '/admin/lager', label: 'Lager' }, { label: 'Forbruk' }]}
      />

      {(failed || stock.failed) && (
        <Alert tone="danger" title="Forbruket kunne ikke leses">
          Last siden på nytt. Gi beskjed hvis det fortsetter.
        </Alert>
      )}

      <Tabs
        current={href(periodKey, type)}
        items={PERIODS.map((key) => ({ href: href(key, type), label: usagePeriod(key, today).label }))}
      />

      <Card
        title={`${period.label} (${rows.length})`}
        description={
          period.from && period.to
            ? `Fra ${dato(period.from)} til ${dato(period.to)}. Mest brukt står øverst.`
            : 'Alt som er ført. Mest brukt står øverst.'
        }
        actions={
          <>
            {(Object.keys(TYPES) as TypeKey[]).map((key) => (
              <Link
                key={key}
                href={href(periodKey, key)}
                className={key === type ? 'pt-btn pt-btn-sm' : 'pt-btn pt-btn-ghost pt-btn-sm'}
                aria-current={key === type ? 'true' : undefined}
              >
                {TYPES[key]}
              </Link>
            ))}
          </>
        }
        flush
      >
        {rows.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Vare</th>
                <th className="pt-num">Mottatt</th>
                <th className="pt-num" style={WRAP}>Brukt i produksjon</th>
                <th className="pt-num" style={WRAP}>Solgt direkte</th>
                <th className="pt-num">Svinn</th>
                <th className="pt-num" style={WRAP}>Beholdning nå</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, used }) => {
                const extra = [
                  used.returned !== 0 ? `Retur ${fmtQty(used.returned, item.unit)}` : null,
                  used.adjusted !== 0 ? `Justert ved telling ${signedQty(used.adjusted, item.unit)}` : null,
                ].filter(Boolean).join(' · ');

                return (
                  <tr key={item.id}>
                    <Td label="Vare">
                      <div>
                        <Link href={`/admin/lager/${item.id}`} className="pt-table-strong">{item.name}</Link>
                        <div className="pt-hint">
                          <span className="pt-mono">{item.item_number}</span> · {STOCK_CATEGORY[item.category] ?? item.category}
                          {!item.active && ' · inaktiv'}
                        </div>
                        {extra && <div className="pt-hint">{extra}</div>}
                      </div>
                    </Td>
                    <Td label="Mottatt" className="pt-num">
                      <div>
                        {used.received !== 0 || used.produced === 0 ? qtyOrDash(used.received, item.unit) : null}
                        {used.produced !== 0 && (
                          <div>
                            {fmtQty(used.produced, item.unit)}
                            <div className="pt-hint">ferdig montert</div>
                          </div>
                        )}
                      </div>
                    </Td>
                    <Td label="Brukt i produksjon" className="pt-num pt-table-strong">{qtyOrDash(used.used_in_production, item.unit)}</Td>
                    <Td label="Solgt direkte" className="pt-num pt-table-strong">{qtyOrDash(used.sold, item.unit)}</Td>
                    <Td label="Svinn" className="pt-num">{qtyOrDash(used.scrapped, item.unit)}</Td>
                    <Td label="Beholdning nå" className="pt-num">{fmtQty(item.on_hand, item.unit)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen bevegelser i perioden">
            {type !== 'alle' || periodKey !== 'alt'
              ? <Link href={href('alt', 'alle')} className="pt-link">Vis hele perioden for alle varer</Link>
              : 'Forbruket vises her når det er ført varemottak, produksjon eller salg.'}
          </Empty>
        )}
      </Card>
    </>
  );
}
