import type { Metadata } from 'next';
import { requireUser } from '@/lib/portal/context';
import { PageHeader } from '@/components/portal/ui';
import OrderForm, { type OrderProduct } from '@/components/minside/order-form';
import { meter } from '@/components/minside/util';
import { CUSTOM_PRODUCT_NUMBER, fitsRange, halfMetresBetween } from '@/lib/pricing';
import { placeOrder } from './actions';

export const metadata: Metadata = { title: 'Bestill leider, skap og deler' };

/** Bestilling fra Min side: leidere (også halvmetere), oppbevaringsskap og reservedeler. */
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

  // Spesiallengden (halvmetere) er ett felles produkt uten lengde. Den vises
  // ikke som en vanlig rad: kunden velger lengden selv under «Annen lengde».
  const isCustom = (product: NonNullable<typeof products>[number]) =>
    product.product_number === CUSTOM_PRODUCT_NUMBER;
  const customOffered = (products ?? []).some(isCustom);

  /** Standardlengdene, og per skap hvilke av dem det hører til. */
  const standard = (products ?? []).filter(
    (product) => product.kind === 'ladder' && product.length_m !== null && !isCustom(product),
  );
  const fitsOf = (cabinetId: string) => {
    const lengths = standard
      .filter((ladder) => ladder.cabinet_product_id === cabinetId)
      .map((ladder) => Number(ladder.length_m));
    return lengths.length > 0 ? `${fitsRange(lengths)} m` : null;
  };

  const toOrderProduct = (product: NonNullable<typeof products>[number]): OrderProduct => {
    const cabinet = product.cabinet_product_id ? byId.get(product.cabinet_product_id) : undefined;
    return {
      id: product.id,
      name: product.name,
      productNumber: product.product_number,
      length: product.length_m === null ? null : Number(product.length_m),
      detail: [meter(product.length_m), product.steps ? `${product.steps} trinn` : null].filter(Boolean).join(' · ') || null,
      price: product.price_nok,
      onRequest: product.price_on_request,
      cabinet: cabinet && !cabinet.price_on_request ? { name: cabinet.name, price: cabinet.price_nok } : null,
      fits: product.kind === 'cabinet' ? fitsOf(product.id) : null,
    };
  };

  const ofKind = (kind: string) =>
    (products ?? []).filter((product) => product.kind === kind && !isCustom(product)).map(toOrderProduct);

  // Skapene i samme rekkefølge som leiderne de hører til: minste først.
  const smallestFit = (cabinetId: string) =>
    Math.min(
      ...standard.filter((ladder) => ladder.cabinet_product_id === cabinetId).map((ladder) => Number(ladder.length_m)),
      Number.POSITIVE_INFINITY,
    );
  const cabinets = ofKind('cabinet').sort(
    (a, b) => smallestFit(a.id) - smallestFit(b.id) || a.name.localeCompare(b.name, 'nb'),
  );

  return (
    <>
      <PageHeader
        title="Bestill leider, skap og deler"
        description="Leidere, oppbevaringsskap alene og reservedeler. Velg antall, sjekk kontaktopplysningene og send. Vi bekrefter bestillingen, og du følger produksjonen under Mine bestillinger."
      />

      <OrderForm
        action={placeOrder}
        ladders={ofKind('ladder')}
        cabinets={cabinets}
        spareParts={ofKind('spare_part')}
        customLengths={customOffered ? halfMetresBetween(standard.map((ladder) => Number(ladder.length_m))) : []}
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
