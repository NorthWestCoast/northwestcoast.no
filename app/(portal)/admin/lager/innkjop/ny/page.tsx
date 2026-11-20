import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Alert, Card, PageHeader } from '@/components/portal/ui';
import { PurchaseForm } from '@/components/lager/innkjop/purchase-form';
import { loadStockRows } from '@/components/lager/data';
import { uuid } from '@/lib/portal/forms';
import { PURCHASE_KIND } from '@/lib/portal/labels';
import { idag } from '@/lib/format';
import { createPurchase } from '../actions';

export const metadata: Metadata = { title: 'Nytt innkjøp' };

/**
 * Nytt innkjøp: leverandør, datoer og linjer. `?vare=<id>` setter en vare på
 * første linje, så en vare kan bestilles rett fra sin egen side.
 */
export default async function NyttInnkjopPage({
  searchParams,
}: {
  searchParams: Promise<{ vare?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireStaff();

  const [{ data: suppliers, error }, stock] = await Promise.all([
    supabase.from('suppliers').select('id, name').eq('active', true).order('name').limit(1000),
    loadStockRows(supabase),
  ]);
  if (error) console.error('[lager] Kunne ikke hente leverandørene:', error.message);

  // Varer som er tatt ut av bruk, skal ikke bestilles på nytt.
  const items = stock.filter((item) => item.active);

  return (
    <>
      <PageHeader
        title="Nytt innkjøp"
        description="Registrer det som er bestilt hos en leverandør. Varene telles ikke inn på lager før de er registrert som mottatt på innkjøpet."
        crumbs={[
          { href: '/admin/lager', label: 'Lager' },
          { href: '/admin/lager/innkjop', label: 'Innkjøp' },
          { label: 'Nytt innkjøp' },
        ]}
      />

      {items.length === 0 ? (
        <Alert tone="warn" title="Ingen varer å bestille">
          Legg inn varene under <Link href="/admin/lager" className="pt-link">Lager</Link> først.
        </Alert>
      ) : (
        <Card
          title="Innkjøpet"
          description="Én linje per vare. Mengden skrives i varens egen enhet."
        >
          <PurchaseForm
            action={createPurchase}
            suppliers={suppliers ?? []}
            items={items}
            kinds={PURCHASE_KIND}
            today={idag()}
            initialItemId={uuid(params.vare ?? null) ?? undefined}
          />
        </Card>
      )}
    </>
  );
}
