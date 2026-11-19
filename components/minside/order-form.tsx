'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { ActionResult } from '@/lib/portal/forms';
import { nok } from '@/lib/format';

export type OrderProduct = {
  id: string;
  name: string;
  productNumber: string;
  /** F.eks. «7,5 m · 25 trinn». */
  detail: string | null;
  price: number;
  onRequest: boolean;
  /** Oppbevaringsskapet som hører til leideren, hvis det finnes. */
  cabinet: { name: string; price: number } | null;
};

type Props = {
  action: (formData: FormData) => Promise<ActionResult>;
  ladders: OrderProduct[];
  cabinets: OrderProduct[];
  spareParts: OrderProduct[];
  companies: { id: string; name: string }[];
  defaults: { name: string; email: string; phone: string };
};

/**
 * Bestillingsskjemaet. Summen her er en løpende hjelp for kunden; den
 * gjeldende prisen regnes ut i databasen når bestillingen sendes.
 */
export default function OrderForm({ action, ladders, cabinets, spareParts, companies, defaults }: Props) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [cab, setCab] = useState<Record<string, boolean>>({});

  const [state, formAction, pending] = useActionState(
    async (_previous: ActionResult | null, formData: FormData) => {
      const result = await action(formData);
      if (result.ok) {
        setQty({});
        setCab({});
      }
      return result;
    },
    null,
  );

  const all = [...ladders, ...cabinets, ...spareParts];
  let total = 0;
  let units = 0;
  let onRequest = false;
  for (const product of all) {
    const count = qty[product.id] ?? 0;
    if (count <= 0) continue;
    units += count;
    if (product.onRequest) {
      onRequest = true;
      continue;
    }
    const cabinetPrice = cab[product.id] && product.cabinet ? product.cabinet.price : 0;
    total += count * (product.price + cabinetPrice);
  }

  function changeQty(id: string, raw: string) {
    const parsed = Number.parseInt(raw, 10);
    const value = Number.isNaN(parsed) ? 0 : Math.min(99, Math.max(0, parsed));
    setQty((current) => ({ ...current, [id]: value }));
  }

  const qtyInput = (product: OrderProduct) => (
    <input
      className="pt-input"
      style={{ maxWidth: '6.5rem' }}
      type="number"
      inputMode="numeric"
      min={0}
      max={99}
      name={`qty_${product.id}`}
      value={qty[product.id] ? String(qty[product.id]) : ''}
      onChange={(event) => changeQty(product.id, event.target.value)}
      placeholder="0"
      aria-label={`Antall ${product.name}`}
    />
  );

  const priceText = (product: OrderProduct) => (product.onRequest ? 'Pris på forespørsel' : nok(product.price));

  const simpleTable = (products: OrderProduct[], heading: string) => (
    <table className="pt-table">
      <thead>
        <tr>
          <th>{heading}</th>
          <th>Produktnr.</th>
          <th>Pris eks. mva.</th>
          <th>Antall</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id}>
            <td data-label={heading} className="pt-table-strong">{product.name}</td>
            <td data-label="Produktnr.">{product.productNumber}</td>
            <td data-label="Pris eks. mva.">{priceText(product)}</td>
            <td data-label="Antall">{qtyInput(product)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <form action={formAction}>
      {state?.ok && (
        <div className="pt-alert" data-tone="ok" role="status">
          <div>
            <strong>Takk for bestillingen</strong>
            <p>
              {state.message} <Link href="/minside/bestillinger">Se bestillingene dine</Link>
            </p>
          </div>
        </div>
      )}

      <section className="pt-card">
        <div className="pt-card-head">
          <h2>Leidere</h2>
          <p>Argostep leveres i faste lengder. Oppbevaringsskap tilpasset lengden kan bestilles sammen med leideren.</p>
        </div>
        <div className="pt-card-body pt-flush">
          {ladders.length > 0 ? (
            <table className="pt-table">
              <thead>
                <tr>
                  <th>Leider</th>
                  <th>Lengde</th>
                  <th>Pris eks. mva.</th>
                  <th>Antall</th>
                  <th>Oppbevaringsskap</th>
                </tr>
              </thead>
              <tbody>
                {ladders.map((product) => (
                  <tr key={product.id}>
                    <td data-label="Leider" className="pt-table-strong">
                      <div>
                        {product.name}
                        <div className="pt-list-sub">{product.productNumber}</div>
                      </div>
                    </td>
                    <td data-label="Lengde">{product.detail ?? '–'}</td>
                    <td data-label="Pris eks. mva.">{priceText(product)}</td>
                    <td data-label="Antall">{qtyInput(product)}</td>
                    <td data-label="Skap">
                      {product.cabinet && !product.onRequest ? (
                        <label className="pt-check">
                          <input
                            type="checkbox"
                            name={`cab_${product.id}`}
                            checked={cab[product.id] ?? false}
                            onChange={(event) => setCab((current) => ({ ...current, [product.id]: event.target.checked }))}
                          />
                          <span>Med skap (+ {nok(product.cabinet.price)})</span>
                        </label>
                      ) : (
                        <span className="pt-muted">{product.cabinet ? 'Avtales i tilbudet' : '–'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="pt-empty">
              <strong>Ingen leidere i katalogen akkurat nå</strong>
              Ta kontakt med oss, så hjelper vi deg.
            </div>
          )}
        </div>
      </section>

      {cabinets.length > 0 && (
        <section className="pt-card">
          <div className="pt-card-head">
            <h2>Oppbevaringsskap</h2>
            <p>Skap uten leider, for eksempel til en leider du har fra før.</p>
          </div>
          <div className="pt-card-body pt-flush">{simpleTable(cabinets, 'Skap')}</div>
        </section>
      )}

      <section className="pt-card">
        <div className="pt-card-head">
          <h2>Reservedeler</h2>
        </div>
        <div className="pt-card-body pt-flush">
          {spareParts.length > 0 ? (
            simpleTable(spareParts, 'Del')
          ) : (
            <div className="pt-empty">
              <strong>Reservedeler er ikke lagt ut ennå</strong>
              Trenger du trinn, sidetau eller andre deler, sender du en sak til support, så ordner vi det.
              <div>
                <Link href="/minside/support/ny" className="pt-btn pt-btn-sm">Spør om reservedeler</Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="pt-card">
        <div className="pt-card-head">
          <h2>Kontakt og levering</h2>
        </div>
        <div className="pt-card-body">
          <div className="pt-form">
            <div className="pt-form-row">
              <div className="pt-field">
                <label htmlFor="order-name">Kontaktperson</label>
                <input id="order-name" name="name" required maxLength={120} defaultValue={defaults.name} autoComplete="name" />
              </div>
              <div className="pt-field">
                <label htmlFor="order-email">E-post</label>
                <input id="order-email" name="email" type="email" required maxLength={160} defaultValue={defaults.email} autoComplete="email" />
              </div>
            </div>
            <div className="pt-form-row">
              <div className="pt-field">
                <label htmlFor="order-phone">Telefon</label>
                <input id="order-phone" name="phone" type="tel" maxLength={40} defaultValue={defaults.phone} autoComplete="tel" />
              </div>
              {companies.length > 0 && (
                <div className="pt-field">
                  <label htmlFor="order-company">Selskap</label>
                  <select id="order-company" name="company_id" defaultValue={companies[0].id}>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                    <option value="">Ikke knyttet til et selskap</option>
                  </select>
                </div>
              )}
            </div>
            <div className="pt-form-row">
              <div className="pt-field">
                <label htmlFor="order-vessel">Fartøy (valgfritt)</label>
                <input id="order-vessel" name="vessel" maxLength={160} placeholder="Hvilket fartøy leideren skal brukes på" />
              </div>
              <div className="pt-field">
                <label htmlFor="order-address">Leveringsadresse</label>
                <input id="order-address" name="delivery_address" maxLength={400} autoComplete="street-address" />
              </div>
            </div>
            <div className="pt-field">
              <label htmlFor="order-notes">Kommentar (valgfritt)</label>
              <textarea id="order-notes" name="notes" maxLength={4000} placeholder="Ønsket leveringstid, merking eller annet vi bør vite" />
            </div>
          </div>
        </div>
        <div className="pt-card-foot">
          <div className="pt-form-foot">
            <button type="submit" className="pt-btn pt-btn-green" disabled={pending || units === 0}>
              {pending ? 'Sender…' : 'Send bestilling'}
            </button>
            <span aria-live="polite">
              {units === 0
                ? 'Fyll inn antall på det du vil bestille.'
                : `${units} ${units === 1 ? 'enhet' : 'enheter'} · foreløpig sum ${nok(total)} eks. mva.${onRequest ? ' + varer med pris på forespørsel' : ''}`}
            </span>
            {state && !state.ok && <span className="pt-msg" data-ok="false" role="alert">{state.error}</span>}
          </div>
          <p style={{ marginTop: '0.5rem' }}>
            Bestillingen er ikke bindende før vi har bekreftet den. Prisen fastsettes ut fra gjeldende prisliste når bestillingen mottas.
          </p>
        </div>
      </section>
    </form>
  );
}
