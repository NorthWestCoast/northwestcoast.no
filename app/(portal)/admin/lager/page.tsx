import type { Metadata } from 'next';
import { requireStaff } from '@/lib/supabase/staff';
import { Alert, Card, Disclosure, PageHeader } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { loadStock, stockQuery, stockView } from '@/components/lager/data';
import { StockOverview } from '@/components/lager/overview';
import { ItemFields, linkableProducts } from '@/components/lager/item-fields';
import { createItem } from './actions';

export const metadata: Metadata = { title: 'Lager' };

/**
 * Hva som ligger på lager nå: deler og ferdigvarer, med det som er bundet av
 * åpne produksjonsjobber og det som er i bestilling. Åpne en vare for å føre
 * varemottak, svinn og telling, og for å se hva den har gått til.
 */
export default async function LagerPage({
  searchParams,
}: {
  searchParams: Promise<{ vis?: string; q?: string; inaktive?: string; slettet?: string }>;
}) {
  const { supabase } = await requireStaff();
  const params = await searchParams;

  const [stock, { data: suppliers }, { data: products }] = await Promise.all([
    loadStock(supabase),
    supabase.from('suppliers').select('id, name').eq('active', true).order('name').limit(1000),
    supabase.from('products').select('id, product_number, name, kind, active').order('sort_order').limit(1000),
  ]);

  return (
    <>
      <PageHeader
        title="Lager"
        description="Det som ligger på lager nå. «Bundet» er det åpne produksjonsjobber kommer til å bruke etter stykklista, og «tilgjengelig» er det som er igjen etter det."
      />

      {params.slettet && <Alert tone="ok" title="Varen er slettet" />}

      <Card flush>
        <Disclosure summary="Ny vare">
          <PortalForm action={createItem} submitLabel="Opprett vare" pendingLabel="Oppretter…">
            <ItemFields
              scope="new"
              suppliers={suppliers ?? []}
              products={linkableProducts(products ?? [], stock.rows.map((row) => row.product_id))}
            />
            <p className="pt-hint">
              Varen opprettes med null på lager. Etterpå åpnes den, så du kan føre det som står på hylla med en
              varetelling.
            </p>
          </PortalForm>
        </Disclosure>
      </Card>

      <StockOverview
        rows={stock.rows}
        failed={stock.failed}
        basePath="/admin/lager"
        view={stockView(params.vis)}
        q={stockQuery(params.q)}
        inactive={params.inaktive === '1'}
        admin
      />
    </>
  );
}
