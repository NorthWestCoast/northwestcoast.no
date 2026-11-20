import type { Metadata } from 'next';
import { requireStaff } from '@/lib/supabase/staff';
import { Alert, Badge, Card, Disclosure, Empty, PageHeader } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { Check, Hidden, Input, Textarea } from '@/components/admin/fields';
import { saveSupplier } from '../actions';

export const metadata: Metadata = { title: 'Leverandører' };

type SupplierValues = {
  name?: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

/** Feltene for en leverandør. Samme felt for ny og eksisterende. */
function SupplierFields({ scope, values = {} }: { scope: string; values?: SupplierValues }) {
  return (
    <>
      <div className="pt-form-row">
        <Input scope={scope} name="name" label="Navn" minLength={2} maxLength={160} defaultValue={values.name ?? ''} required />
        <Input scope={scope} name="contact_name" label="Kontaktperson" maxLength={160} defaultValue={values.contact_name ?? ''} />
      </div>
      <div className="pt-form-row">
        <Input scope={scope} name="email" label="E-post" type="email" maxLength={200} defaultValue={values.email ?? ''} />
        <Input scope={scope} name="phone" label="Telefon" type="tel" maxLength={40} defaultValue={values.phone ?? ''} />
      </div>
      <Textarea
        scope={scope}
        name="notes"
        label="Notat"
        rows={2}
        maxLength={2000}
        defaultValue={values.notes ?? ''}
        hint="Internt: leveringstid, betingelser, kundenummer hos leverandøren."
      />
    </>
  );
}

/**
 * Leverandørene innkjøp gjøres hos. En leverandør slettes ikke; den settes
 * som ikke aktiv, så gamle innkjøp beholder navnet.
 */
export default async function LeverandorerPage() {
  const { supabase } = await requireStaff();

  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('id, name, contact_name, email, phone, notes, active, purchase_orders(status)')
    .order('active', { ascending: false })
    .order('name')
    .limit(1000);

  if (error) console.error('[lager] Kunne ikke hente leverandørene:', error.message);

  return (
    <>
      <PageHeader
        title="Leverandører"
        description="De dere kjøper deler av, og de som produserer deler for dere. Leverandøren velges når et innkjøp opprettes."
        crumbs={[
          { href: '/admin/lager', label: 'Lager' },
          { href: '/admin/lager/innkjop', label: 'Innkjøp' },
          { label: 'Leverandører' },
        ]}
      />

      {error && <Alert tone="danger" title="Leverandørene kunne ikke hentes">Last siden på nytt.</Alert>}

      <Card flush>
        <Disclosure summary="Ny leverandør">
          <PortalForm action={saveSupplier} submitLabel="Legg til leverandør">
            <SupplierFields scope="new" />
          </PortalForm>
        </Disclosure>
      </Card>

      <Card title={`Leverandører (${suppliers?.length ?? 0})`} flush>
        {suppliers?.length ? (
          <ul className="pt-list">
            {suppliers.map((supplier) => {
              const open = supplier.purchase_orders.filter((order) => order.status === 'ordered').length;
              const contact = [supplier.contact_name, supplier.email, supplier.phone].filter(Boolean).join(' · ');
              return (
                <li key={supplier.id}>
                  <div className="pt-list-main">
                    <strong>{supplier.name}</strong>
                    <div className="pt-list-sub">{contact || 'Ingen kontaktopplysninger'}</div>
                    {supplier.notes && <div className="pt-list-sub" style={{ whiteSpace: 'pre-line' }}>{supplier.notes}</div>}
                  </div>
                  <div className="pt-list-side">
                    <span className="pt-muted" style={{ fontSize: '0.86rem' }}>
                      {supplier.purchase_orders.length === 0
                        ? 'Ingen innkjøp'
                        : `${supplier.purchase_orders.length} innkjøp${open > 0 ? `, ${open} ${open === 1 ? 'åpent' : 'åpne'}` : ''}`}
                    </span>
                    {!supplier.active && <Badge>Ikke aktiv</Badge>}
                  </div>
                  <div className="pt-list-wide">
                    <details className="pt-more">
                      <summary>Endre</summary>
                      <PortalForm action={saveSupplier} submitLabel="Lagre" resetOnSuccess={false}>
                        <Hidden fields={{ supplier_id: supplier.id }} />
                        <SupplierFields scope={supplier.id} values={supplier} />
                        <Check
                          name="active"
                          defaultChecked={supplier.active}
                          label={<>Aktiv <span className="pt-muted">– kan velges på nye innkjøp</span></>}
                        />
                      </PortalForm>
                    </details>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title={error ? 'Leverandørene kunne ikke hentes' : 'Ingen leverandører ennå'}>
            {error ? 'Last siden på nytt.' : 'Legg til den første over, eller rett i skjemaet for et nytt innkjøp.'}
          </Empty>
        )}
      </Card>
    </>
  );
}
