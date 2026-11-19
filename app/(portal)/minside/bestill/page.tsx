import type { Metadata } from 'next';
import { requireUser } from '@/lib/portal/context';
import { PageHeader } from '@/components/portal/ui';
import OrderForm, { type OrderProduct } from '@/components/minside/order-form';
import { meter } from '@/components/minside/util';
import { placeOrder } from './actions';

export const metadata: Metadata = { title: 'Bestill leider og deler' };

/** Bestilling fra Min side: leidere, oppbevaringsskap og reservedeler. */
export default async function BestillPage() {
  const { supabase, ctx } = await requireUser('/minside/bestill');

  const [{ data: products }, { data: profile }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, product_number, kind, length_m, steps, price_nok, price_on_request, cabinet_product_id')
      .eq('active', true)
      .order('kind')
      .order('length_m', { nullsFirst: false })
      .order('sort_order')
      .order('name'),
    supabase.from('profiles').select('full_name, phone').eq('user_id', ctx.userId).maybeSingle(),
  ]);

  const byId = new Map((products ?? []).map((product) => [product.id, product]));

  const toOrderProduct = (product: NonNullable<typeof products>[number]): OrderProduct => {
    const cabinet = product.cabinet_product_id ? byId.get(product.cabinet_product_id) : undefined;
    return {
      id: product.id,
      name: product.name,
      productNumber: product.product_number,
      detail: [meter(product.length_m), product.steps ? `${product.steps} trinn` : null].filter(Boolean).join(' · ') || null,
      price: product.price_nok,
      onRequest: product.price_on_request,
      cabinet: cabinet && !cabinet.price_on_request ? { name: cabinet.name, price: cabinet.price_nok } : null,
    };
  };

  const ofKind = (kind: string) => (products ?? []).filter((product) => product.kind === kind).map(toOrderProduct);

  return (
    <>
      <PageHeader
        title="Bestill leider og deler"
        description="Velg antall, sjekk kontaktopplysningene og send. Vi bekrefter bestillingen, og du følger produksjonen under Mine bestillinger."
      />

      <OrderForm
        action={placeOrder}
        ladders={ofKind('ladder')}
        cabinets={ofKind('cabinet')}
        spareParts={ofKind('spare_part')}
        companies={ctx.companies.map((company) => ({ id: company.id, name: company.name }))}
        defaults={{
          name: profile?.full_name ?? ctx.fullName ?? '',
          email: ctx.email,
          phone: profile?.phone ?? '',
        }}
      />
    </>
  );
}
