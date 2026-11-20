import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/supabase/staff';
import { uuid } from '@/lib/portal/forms';
import { Alert, Badge, Card, Empty, PageHeader, Stat, Stats } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { Hidden } from '@/components/admin/fields';
import { MANUAL_MOVEMENTS, PURCHASE_KIND, STOCK_CATEGORY, STOCK_SUPPLY } from '@/lib/portal/labels';
import { STOCK_STATE, describeQty, fmtQty, stockState, usagePeriod } from '@/lib/stock';
import { dato, idag } from '@/lib/format';
import {
  NO_USAGE,
  loadMovements,
  loadOpenPurchaseLines,
  loadStockItem,
  loadUsage,
} from '@/components/lager/data';
import { StockBadge } from '@/components/lager/overview';
import { CountForm, MovementForm } from '@/components/lager/forms';
import { MovementList, UsageBlock } from '@/components/lager/history';
import { ItemFields, linkableProducts } from '@/components/lager/item-fields';
import { deleteItem, registerCount, registerMovement, setItemActive, updateItem } from '../actions';

export const metadata: Metadata = { title: 'Lagervare' };

const KINDS = MANUAL_MOVEMENTS.map((movement) => movement.kind);
const MOVEMENT_LIMIT = 100;

/**
 * Én lagervare: beholdningen, føring av bevegelser og telling, hva varen har
 * gått til, hvilke produkter den inngår i, hva som er i bestilling, og
 * historikken.
 */
export default async function LagervarePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ny?: string }>;
}) {
  const { supabase } = await requireStaff();

  const { id: rawId } = await params;
  const id = uuid(rawId);
  if (!id) notFound();
  const { ny } = await searchParams;

  const item = await loadStockItem(supabase, id);
  if (!item) notFound();

  const today = idag();
  const thisYear = usagePeriod('i-ar', today);
  const lastYear = usagePeriod('12-mnd', today);

  const [
    movements,
    openLines,
    usageThisYear,
    usageLastYear,
    { data: usedIn },
    { data: suppliers },
    { data: products },
    { data: linked },
  ] = await Promise.all([
    loadMovements(supabase, id, MOVEMENT_LIMIT),
    loadOpenPurchaseLines(supabase, id),
    loadUsage(supabase, thisYear, id),
    loadUsage(supabase, lastYear, id),
    supabase
      .from('product_components')
      .select('id, qty, qty_per_metre, note, products(id, product_number, name, active)')
      .eq('item_id', id),
    supabase.from('suppliers').select('id, name, active').order('name').limit(1000),
    supabase.from('products').select('id, product_number, name, kind, active').order('sort_order').limit(1000),
    supabase.from('stock_items').select('product_id').not('product_id', 'is', null).limit(5000),
  ]);

  const state = STOCK_STATE[stockState(item)];
  const supplier = suppliers?.find((candidate) => candidate.id === item.supplier_id);
  const components = (usedIn ?? [])
    .flatMap((component) => (component.products ? [{ ...component, product: component.products }] : []))
    .sort((a, b) => a.product.product_number.localeCompare(b.product.product_number, 'nb'));
  const fields = { item_id: item.id };

  // Databasen nekter å slette en vare som er i bruk. Ser vi det allerede her,
  // tilbys ikke knappen; da er «Sett inaktiv» veien å gå.
  const inUse = movements.length > 0 || components.length > 0 || openLines.length > 0;

  return (
    <>
      <PageHeader
        title={item.name}
        description={[
          item.item_number,
          STOCK_CATEGORY[item.category] ?? item.category,
          STOCK_SUPPLY[item.supply] ?? item.supply,
          supplier?.name,
          item.location ? `Lagerplass: ${item.location}` : null,
        ].filter(Boolean).join(' · ')}
        crumbs={[{ href: '/admin/lager', label: 'Lager' }, { label: item.item_number }]}
        badge={<><StockBadge item={item} />{!item.active && <Badge>Inaktiv</Badge>}</>}
      />

      {ny && (
        <Alert tone="ok" title="Varen er opprettet">
          Den står med null på lager. Før det som ligger på hylla under «Varetelling».
        </Alert>
      )}
      {item.on_hand < 0 && (
        <Alert tone="danger" title="Beholdningen er negativ">
          Det er ført mer ut enn inn. Tell varen og før tellingen under, så blir beholdningen riktig igjen.
        </Alert>
      )}

      <Stats>
        <Stat value={fmtQty(item.on_hand, item.unit)} label="På lager" tone={state.tone === 'neutral' ? undefined : state.tone} />
        <Stat value={fmtQty(item.reserved, item.unit)} label="Bundet av åpne jobber" />
        <Stat
          value={fmtQty(item.available, item.unit)}
          label={item.reorder_point > 0 ? `Tilgjengelig (minimum ${fmtQty(item.reorder_point)})` : 'Tilgjengelig'}
          tone={item.below_minimum ? 'warn' : undefined}
        />
        <Stat value={fmtQty(item.on_order, item.unit)} label="I bestilling" tone={item.on_order > 0 ? 'info' : undefined} />
      </Stats>

      <div className="pt-stack">
        <div className="pt-grid pt-grid-2">
          <Card title="Registrer bevegelse" description="Varemottak, svinn, salg utenom bestilling og retur fra kunde.">
            <MovementForm
              action={registerMovement}
              itemId={item.id}
              unit={item.unit}
              kinds={KINDS}
              today={today}
              purchaseLines={openLines}
            />
          </Card>

          <Card title="Varetelling" description="Skriv det du faktisk talte. Beholdningen rettes til det.">
            <CountForm action={registerCount} itemId={item.id} unit={item.unit} onHand={item.on_hand} />
          </Card>
        </div>

        <Card
          title="Forbruk"
          description="Hvor mye av varen som har gått til produksjon, og hvor mye som er solgt direkte."
          footer={<Link href="/admin/lager/forbruk" className="pt-link">Forbruk for alle varer</Link>}
          flush
        >
          <UsageBlock
            unit={item.unit}
            periods={[
              { label: thisYear.label, usage: usageThisYear.usage.get(item.id) ?? NO_USAGE },
              { label: lastYear.label, usage: usageLastYear.usage.get(item.id) ?? NO_USAGE },
            ]}
          />
        </Card>

        <div className="pt-grid pt-grid-2">
          <Card title="Inngår i" description="Produktene som har varen i stykklista, med mengden per enhet." flush>
            {components.length > 0 ? (
              <ul className="pt-list">
                {components.map((component) => (
                  <li key={component.id}>
                    <div className="pt-list-main">
                      <Link href={`/admin/lager/stykklister/${component.product.id}`}>
                        {component.product.product_number} · {component.product.name}
                      </Link>
                      {!component.product.active && <> <Badge>Inaktivt</Badge></>}
                      {component.note && <div className="pt-list-sub">{component.note}</div>}
                    </div>
                    <div className="pt-list-side">{describeQty(component, item.unit)}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="Står ikke i noen stykkliste">
                <Link href="/admin/lager/stykklister" className="pt-link">Åpne stykklistene</Link>
              </Empty>
            )}
          </Card>

          <Card
            title="I bestilling"
            description="Åpne innkjøp der ikke alt av varen er kommet."
            actions={
              item.active && (
                <Link href={`/admin/lager/innkjop/ny?vare=${item.id}`} className="pt-btn pt-btn-ghost pt-btn-sm">
                  Bestill mer
                </Link>
              )
            }
            flush
          >
            {openLines.length > 0 ? (
              <ul className="pt-list">
                {openLines.map((line) => (
                  <li key={line.id}>
                    <div className="pt-list-main">
                      <Link href={`/admin/lager/innkjop/${line.purchase_order_id}`}>{line.po_number}</Link>
                      <div className="pt-list-sub">
                        {[
                          line.supplier ?? 'Uten leverandør',
                          line.kind === 'purchase' ? null : PURCHASE_KIND[line.kind],
                          line.expected_on ? `ventet ${dato(line.expected_on)}` : 'ingen dato satt',
                        ].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="pt-list-side">
                      {fmtQty(line.ordered, item.unit)} bestilt, {fmtQty(line.received, item.unit)} mottatt
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="Ingenting i bestilling">
                <Link href="/admin/lager/innkjop" className="pt-link">Åpne innkjøpene</Link>
              </Empty>
            )}
          </Card>
        </div>

        <Card
          title="Bevegelser"
          description={
            movements.length >= MOVEMENT_LIMIT
              ? `De ${MOVEMENT_LIMIT} siste, nyeste først. Bevegelser endres og slettes aldri; en feil rettes med en ny.`
              : 'Nyeste først. Bevegelser endres og slettes aldri; en feil rettes med en ny.'
          }
          flush
        >
          <MovementList movements={movements} unit={item.unit} adminLinks />
        </Card>

        <Card title="Rediger vare" description="Beholdningen endres ikke her, bare med bevegelser og varetelling.">
          <PortalForm action={updateItem} submitLabel="Lagre vare" resetOnSuccess={false}>
            <Hidden fields={fields} />
            <ItemFields
              scope="edit"
              item={item}
              suppliers={(suppliers ?? []).filter((candidate) => candidate.active || candidate.id === item.supplier_id)}
              products={linkableProducts(products ?? [], (linked ?? []).map((row) => row.product_id), item.product_id)}
            />
          </PortalForm>
        </Card>

        <Card
          title={item.active ? 'Ta varen ut av bruk' : 'Varen er inaktiv'}
          description={
            item.active
              ? 'En inaktiv vare vises ikke i oversikten og teller ikke som under minimum. Historikken og stykklistene står som de er.'
              : 'Varen vises ikke i oversikten. Historikken og stykklistene står som de er.'
          }
        >
          <div className="pt-actions">
            <ActionButton
              action={setItemActive}
              fields={{ ...fields, active: item.active ? 'false' : 'true' }}
              label={item.active ? 'Sett inaktiv' : 'Sett aktiv igjen'}
              size="md"
            />
            {!inUse && (
              <ActionButton
                action={deleteItem}
                fields={fields}
                label="Slett varen"
                tone="danger"
                size="md"
                confirm={`Slette ${item.item_number} ${item.name}? Dette kan ikke angres.`}
              />
            )}
          </div>
          {inUse && (
            <p className="pt-hint" style={{ marginTop: '0.75rem' }}>
              Varen har bevegelser, står i en stykkliste eller er i bestilling, og kan derfor ikke slettes.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
