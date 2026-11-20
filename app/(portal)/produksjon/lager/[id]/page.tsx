import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProduction } from '@/lib/portal/context';
import { uuid } from '@/lib/portal/forms';
import { Alert, Badge, Card, PageHeader, Stat, Stats } from '@/components/portal/ui';
import { STOCK_CATEGORY } from '@/lib/portal/labels';
import { STOCK_STATE, fmtQty, stockState } from '@/lib/stock';
import { idag } from '@/lib/format';
import { loadMovements, loadOpenPurchaseLines, loadStockItem } from '@/components/lager/data';
import { StockBadge } from '@/components/lager/overview';
import { CountForm, MovementForm } from '@/components/lager/forms';
import { MovementList } from '@/components/lager/history';
import type { ManualKind } from '@/components/lager/register';
import { registerCount, registerMovement } from '../actions';

export const metadata: Metadata = { title: 'Lagervare' };

/** Det produksjon fører selv. Samme utvalg som handlingene slipper gjennom. */
const KINDS: readonly ManualKind[] = ['receipt', 'scrap'];
const MOVEMENT_LIMIT = 30;

/**
 * Én vare sett fra produksjonen: hva som ligger der, og skjemaene for
 * varemottak, svinn og telling. Varen selv rettes av en administrator.
 */
export default async function ProduksjonLagervarePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = uuid(rawId);
  // Ugyldig id sendes til oversikten som mål for innloggingen, ikke videre.
  const { supabase, ctx } = await requireProduction(id ? `/produksjon/lager/${id}` : '/produksjon/lager');
  if (!id) notFound();

  const item = await loadStockItem(supabase, id);
  if (!item) notFound();

  const [movements, openLines] = await Promise.all([
    loadMovements(supabase, id, MOVEMENT_LIMIT),
    loadOpenPurchaseLines(supabase, id),
  ]);

  const state = STOCK_STATE[stockState(item)];

  return (
    <>
      <PageHeader
        title={item.name}
        description={[
          item.item_number,
          STOCK_CATEGORY[item.category] ?? item.category,
          item.location ? `Lagerplass: ${item.location}` : null,
        ].filter(Boolean).join(' · ')}
        crumbs={[{ href: '/produksjon', label: 'Tavle' }, { href: '/produksjon/lager', label: 'Lager' }, { label: item.item_number }]}
        badge={<><StockBadge item={item} />{!item.active && <Badge>Inaktiv</Badge>}</>}
        actions={
          // Bare administratorer har noe i admin-området å gjøre.
          ctx.staffRole === 'admin' && (
            <Link href={`/admin/lager/${item.id}`} className="pt-btn pt-btn-ghost">Åpne i admin</Link>
          )
        }
      />

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
          <Card title="Varemottak og svinn" description="Før det som kommer inn, og det som er skadet eller kassert.">
            <MovementForm
              action={registerMovement}
              itemId={item.id}
              unit={item.unit}
              kinds={KINDS}
              today={idag()}
              purchaseLines={openLines}
            />
          </Card>

          <Card title="Varetelling" description="Skriv det du faktisk talte. Beholdningen rettes til det.">
            <CountForm action={registerCount} itemId={item.id} unit={item.unit} onHand={item.on_hand} />
          </Card>
        </div>

        <Card
          title="Siste bevegelser"
          description={movements.length >= MOVEMENT_LIMIT ? `De ${MOVEMENT_LIMIT} siste, nyeste først.` : 'Nyeste først.'}
          flush
        >
          <MovementList movements={movements} unit={item.unit} />
        </Card>
      </div>
    </>
  );
}
