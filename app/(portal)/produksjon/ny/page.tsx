import { requireAdmin } from '@/lib/portal/context';
import { Alert, Card, PageHeader } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { meter } from '@/components/produksjon/job';
import { ProductFields, type JobProduct } from '@/components/produksjon/product-fields';
import { CUSTOM_PRODUCT_NUMBER } from '@/lib/pricing';
import { createJob } from '../actions';

/**
 * Manuell jobb: en leider eller et oppbevaringsskap som skal produseres uten
 * at det finnes en bestilling i systemet (lager, garanti, avtale gjort på
 * telefon). Jobben får slaget sitt (leider eller skap) fra produktet.
 */
export default async function NyJobbPage() {
  const { supabase } = await requireAdmin('/produksjon/ny');

  const { data: rows, error } = await supabase
    .from('products')
    .select('id, kind, name, product_number, length_m, steps, cabinet_product_id')
    .in('kind', ['ladder', 'cabinet'])
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('length_m', { ascending: true });

  if (error) console.error('[produksjon] Kunne ikke hente produktene:', error.message);

  const cabinets = new Map(
    (rows ?? []).filter((row) => row.kind === 'cabinet').map((row) => [row.id, row.name]),
  );
  const products: JobProduct[] = (rows ?? []).flatMap((row): JobProduct[] => {
    if (row.kind === 'cabinet') {
      // Skapet heter det samme som produktnummeret sitt; ikke gjenta det.
      return [{ id: row.id, kind: 'cabinet', custom: false, length: null, cabinetName: null, label: row.name }];
    }
    if (row.kind !== 'ladder') return [];

    const custom = row.product_number === CUSTOM_PRODUCT_NUMBER;
    return [{
      id: row.id,
      kind: 'ladder',
      custom,
      length: row.length_m === null ? null : Number(row.length_m),
      label: [
        row.name,
        custom ? 'lengden skrives inn under' : row.length_m !== null ? meter(row.length_m) : null,
        row.steps ? `${row.steps} trinn` : null,
        row.product_number,
      ].filter(Boolean).join(' · '),
      cabinetName: row.cabinet_product_id ? cabinets.get(row.cabinet_product_id) ?? null : null,
    }];
  });

  return (
    <>
      <PageHeader
        title="Ny jobb"
        description="Legg en leider eller et oppbevaringsskap i produksjon uten bestilling. Jobber fra bestillinger opprettes når bestillingen bekreftes i admin."
        crumbs={[{ href: '/produksjon', label: 'Tavle' }, { label: 'Ny jobb' }]}
      />

      {products.length === 0 ? (
        <Alert tone="warn" title={error ? 'Produktene kunne ikke hentes' : 'Ingen aktive leidere eller skap i produktlista'}>
          {error ? 'Last siden på nytt.' : 'Legg til eller aktiver et produkt i admin før du oppretter en jobb.'}
        </Alert>
      ) : (
        <Card title="Jobben" description="Lengde, antall trinn og produktnummer kopieres fra produktet. Stegene hentes fra malen; et skap får bare stegene som gjelder skap.">
          <PortalForm action={createJob} submitLabel="Opprett jobb" pendingLabel="Oppretter…" resetOnSuccess={false}>
            <ProductFields products={products} />

            <div className="pt-form-row">
              <div className="pt-field">
                <label htmlFor="job-customer">Kundenavn</label>
                <input id="job-customer" name="customer_label" minLength={2} maxLength={160} required />
                <small>Vises på tavla. Skriv «Lager» hvis det ikke er en kunde ennå.</small>
              </div>
              <div className="pt-field">
                <label htmlFor="job-vessel">Fartøy</label>
                <input id="job-vessel" name="vessel_name" maxLength={160} />
              </div>
            </div>

            <div className="pt-field">
              <label htmlFor="job-notes">Spesielle krav</label>
              <textarea id="job-notes" name="spec_notes" maxLength={2000} />
            </div>

            <div className="pt-form-row">
              <div className="pt-field">
                <label htmlFor="job-due">Frist</label>
                <input id="job-due" name="due_date" type="date" />
              </div>
            </div>
          </PortalForm>
        </Card>
      )}
    </>
  );
}
