import type { Metadata } from 'next';
import { requireProduction } from '@/lib/portal/context';
import { PageHeader } from '@/components/portal/ui';
import { loadStock, stockQuery, stockView } from '@/components/lager/data';
import { StockOverview } from '@/components/lager/overview';

export const metadata: Metadata = { title: 'Lager' };

/**
 * Lageret sett fra produksjonen: hva som ligger der, hva som er bundet av
 * jobbene i kø, og hva som er på vei inn. Åpne en vare for å føre
 * varemottak, svinn og telling. Varene selv styres av administratorer.
 */
export default async function ProduksjonLagerPage({
  searchParams,
}: {
  searchParams: Promise<{ vis?: string; q?: string }>;
}) {
  const { supabase } = await requireProduction('/produksjon/lager');
  const params = await searchParams;

  const stock = await loadStock(supabase);

  return (
    <>
      <PageHeader
        title="Lager"
        description="Deler og ferdigvarer på lager. Åpne en vare for å føre varemottak, svinn eller telling."
        crumbs={[{ href: '/produksjon', label: 'Tavle' }, { label: 'Lager' }]}
      />

      <StockOverview
        rows={stock.rows}
        failed={stock.failed}
        basePath="/produksjon/lager"
        view={stockView(params.vis)}
        q={stockQuery(params.q)}
      />
    </>
  );
}
