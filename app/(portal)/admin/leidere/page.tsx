import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Badge, Card, Disclosure, Empty, PageHeader, Tabs, Td } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { Input, SearchForm, Select, Textarea } from '@/components/admin/fields';
import { ladderStatus, serviceState } from '@/lib/portal/labels';
import { dato } from '@/lib/format';
import type { Enums } from '@/lib/supabase/database.types';
import { assignLadder, registerLadders } from '../actions';
import { searchTerm } from '../_lib/search';

const STATUSES: Enums<'ladder_lifecycle_status'>[] = ['in_production', 'delivered', 'installed', 'retired'];

function href(status: string | undefined, q: string) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const query = params.toString();
  return query ? `/admin/leidere?${query}` : '/admin/leidere';
}

/**
 * Alle leidere. Hver leider åpnes på leidersiden på Min side, der
 * administratorer også finner verktøyene for service, flytting og status.
 */
export default async function LeiderePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = searchTerm(params.q);
  const status = STATUSES.find((value) => value === params.status);
  const { supabase } = await requireStaff();

  let query = supabase
    .from('ladder_status')
    .select('ladder_id, serial_number, product_name, status, company_name, vessel_name, next_service_due, service_state')
    .order('serial_number')
    .limit(500);
  if (status) query = query.eq('status', status);
  if (q) query = query.ilike('serial_number', `%${q}%`);

  const [{ data: ladders }, { data: products }, { data: companies }, { data: vessels }, { data: allLadders }] =
    await Promise.all([
      query,
      supabase
        .from('products')
        .select('id, product_number, name')
        .eq('kind', 'ladder')
        .eq('active', true)
        .order('length_m'),
      supabase.from('companies').select('id, name').order('name'),
      supabase.from('vessels').select('id, name, companies(name)').order('name'),
      supabase
        .from('ladder_status')
        .select('ladder_id, serial_number, product_name, company_name, vessel_name')
        .order('serial_number')
        .limit(1000),
    ]);

  return (
    <>
      <PageHeader
        title="Leidere"
        description="Alle leidere med produksjonsnummer. Leidere fra produksjonen opprettes av seg selv når nummeret registreres på jobben."
      />

      <Card flush>
        <Disclosure summary="Registrer leidere">
          <PortalForm action={registerLadders} submitLabel="Registrer leidere">
            <div className="pt-form-row pt-form-row-3">
              <Select scope="register" name="product_id" label="Produkt" required defaultValue="">
                <option value="" disabled>Velg produkt</option>
                {products?.map((product) => (
                  <option key={product.id} value={product.id}>{product.product_number} · {product.name}</option>
                ))}
              </Select>
              <Input scope="register" name="produced_at" label="Produsert dato" type="date" />
              <Select scope="register" name="company_id" label="Kunde (valgfritt)" defaultValue="">
                <option value="">Ingen ennå</option>
                {companies?.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </Select>
            </div>
            <Textarea
              scope="register"
              name="serial_numbers"
              label="Produksjonsnumre"
              required
              rows={5}
              placeholder={'NWC-2026-0101\nNWC-2026-0102\nNWC-2026-0103'}
              hint="Ett nummer per linje. Finnes ett av dem fra før, lagres ingen."
            />
          </PortalForm>
        </Disclosure>

        <Disclosure summary="Knytt til kunde">
          <PortalForm action={assignLadder} submitLabel="Knytt til kunde">
            <Select scope="assign" name="ladder_id" label="Leider" required defaultValue="">
              <option value="" disabled>Velg leider</option>
              {allLadders?.map((ladder) => (
                <option key={ladder.ladder_id} value={ladder.ladder_id ?? ''}>
                  {ladder.serial_number} · {ladder.product_name}
                  {ladder.company_name ? ` · ${ladder.company_name}` : ' · ingen kunde'}
                  {ladder.vessel_name ? ` · ${ladder.vessel_name}` : ''}
                </option>
              ))}
            </Select>
            <div className="pt-form-row pt-form-row-3">
              <Select scope="assign" name="company_id" label="Selskap" defaultValue="">
                <option value="">Ikke valgt</option>
                {companies?.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </Select>
              <Select scope="assign" name="vessel_id" label="Fartøy" defaultValue="">
                <option value="">Ikke valgt</option>
                {vessels?.map((vessel) => (
                  <option key={vessel.id} value={vessel.id}>
                    {vessel.name}{vessel.companies ? ` (${vessel.companies.name})` : ''}
                  </option>
                ))}
              </Select>
              <Input scope="assign" name="installed_at" label="Montert dato" type="date" />
            </div>
            <p className="pt-hint">
              Velg selskap, fartøy eller begge. Med fartøy og montert dato regnes leideren som i bruk, og
              servicefristen begynner å løpe. Med fartøy uten dato er den levert, men ikke montert.
            </p>
          </PortalForm>
        </Disclosure>
      </Card>

      <Tabs
        current={href(status, q)}
        items={[
          { href: href(undefined, q), label: 'Alle' },
          ...STATUSES.map((value) => ({ href: href(value, q), label: ladderStatus(value).label })),
        ]}
      />

      <Card
        title={q ? `Treff på «${q}» (${ladders?.length ?? 0})` : `Leidere (${ladders?.length ?? 0})`}
        actions={
          <SearchForm action="/admin/leidere" q={q} placeholder="Søk på produksjonsnummer" keep={{ status }} />
        }
        flush
      >
        {ladders?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Produksjonsnr.</th><th>Produkt</th><th>Kunde</th><th>Fartøy</th><th>Status</th><th>Neste service</th></tr>
            </thead>
            <tbody>
              {ladders.map((ladder) => {
                const state = ladderStatus(ladder.status);
                const service = serviceState(ladder.service_state);
                return (
                  <tr key={ladder.ladder_id}>
                    <Td label="Produksjonsnr." className="pt-table-strong">
                      <Link href={`/minside/leider/${ladder.ladder_id}`}>{ladder.serial_number}</Link>
                    </Td>
                    <Td label="Produkt">{ladder.product_name}</Td>
                    <Td label="Kunde">{ladder.company_name ?? '–'}</Td>
                    <Td label="Fartøy">{ladder.vessel_name ?? '–'}</Td>
                    <Td label="Status"><Badge tone={state.tone}>{state.label}</Badge></Td>
                    <Td label="Neste service">
                      {ladder.next_service_due
                        ? <span>{dato(ladder.next_service_due)} <Badge tone={service.tone}>{service.label}</Badge></span>
                        : '–'}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title={q || status ? 'Ingen leidere passer med utvalget' : 'Ingen leidere registrert ennå'}>
            {(q || status) && <Link href="/admin/leidere" className="pt-link">Vis alle</Link>}
          </Empty>
        )}
      </Card>
    </>
  );
}
