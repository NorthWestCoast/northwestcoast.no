'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import type { ActionResult } from '@/lib/portal/forms';
import { nok } from '@/lib/format';

export type OrderProduct = {
  id: string;
  name: string;
  productNumber: string;
  /** Lengden i meter for en leider med fast lengde. */
  length: number | null;
  /** F.eks. «7,5 m · 25 trinn». */
  detail: string | null;
  price: number;
  onRequest: boolean;
  /** Oppbevaringsskapet som hører til leideren, hvis det finnes. */
  cabinet: { name: string; price: number } | null;
  /** For et skap: leiderlengdene det passer til, f.eks. «3–5 m». */
  fits?: string | null;
};

type Props = {
  action: (formData: FormData) => Promise<ActionResult>;
  ladders: OrderProduct[];
  cabinets: OrderProduct[];
  spareParts: OrderProduct[];
  /**
   * Halvmeterne som kan bestilles under «Annen lengde». Tom liste skjuler
   * valget (spesiallengder er slått av i katalogen).
   */
  customLengths: number[];
  companies: { id: string; name: string }[];
  defaults: { name: string; email: string; phone: string };
};

/** Én rad «Annen lengde». Feltene heter custom_length_<key> osv. */
type CustomRow = { key: number; length: number; qty: number; cabinet: boolean };

const meter = (value: number) => `${value.toLocaleString('nb-NO')} m`;

/** Skapmodellen uten «Oppbevaringsskap »-prefikset. */
const cabinetModel = (name: string) => name.replace(/^Oppbevaringsskap\s+/i, '').trim();

/**
 * Bestillingsskjemaet. Summen her er en løpende hjelp for kunden; den
 * gjeldende prisen regnes ut i databasen når bestillingen sendes.
 */
export default function OrderForm({
  action, ladders, cabinets, spareParts, customLengths, companies, defaults,
}: Props) {
  /**
   * Løpenummer til radene under «Annen lengde», så feltnavnene er unike. Den
   * første raden har alltid nummer 0 (likt på server og klient); nye rader får
   * nummer når brukeren legger dem til.
   */
  const rowKey = useRef(1);
  const blankCustom = (key: number, length: number | undefined = customLengths[0]): CustomRow => ({
    key,
    length: length ?? 0,
    qty: 0,
    cabinet: false,
  });
  const newCustom = (length?: number) => blankCustom(rowKey.current++, length);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [cab, setCab] = useState<Record<string, boolean>>({});
  const [customRows, setCustomRows] = useState<CustomRow[]>(() => [blankCustom(0)]);

  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Sendes med onSubmit, ikke `action={…}`: React tømmer et skjema med action
   * også når svaret er en feilmelding, og da ville kommentar og adresse
   * forsvunnet ved første feil. Her tømmes skjemaet bare når bestillingen gikk.
   */
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await action(formData);
      if (!result) return;
      setState(result);
      if (result.ok) {
        setQty({});
        setCab({});
        setCustomRows([newCustom()]);
        form.reset();
      }
    });
  }

  const customOffered = customLengths.length > 0;

  /**
   * Skapet som følger en spesiallengde: det som hører til nærmeste
   * standardlengde over (databasen velger etter samme regel).
   */
  const cabinetForCustom = (length: number) =>
    ladders
      .filter((ladder) => ladder.length !== null && ladder.length >= length && ladder.cabinet)
      .sort((a, b) => (a.length as number) - (b.length as number))[0]?.cabinet ?? null;

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
  if (customOffered) {
    for (const row of customRows) {
      if (row.qty <= 0) continue;
      units += row.qty;
      onRequest = true;
    }
  }

  const clampQty = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? 0 : Math.min(99, Math.max(0, parsed));
  };

  function changeQty(id: string, raw: string) {
    setQty((current) => ({ ...current, [id]: clampQty(raw) }));
  }

  function changeCustom(key: number, patch: Partial<CustomRow>) {
    setCustomRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addCustom() {
    // Foreslå neste ledige lengde, så to rader ikke starter på samme.
    const used = new Set(customRows.map((row) => row.length));
    const row = newCustom(customLengths.find((value) => !used.has(value)));
    setCustomRows((rows) => [...rows, row]);
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

  const simpleTable = (products: OrderProduct[], heading: string, withFits = false) => (
    <table className="pt-table">
      <thead>
        <tr>
          <th>{heading}</th>
          {withFits ? <th>Passer leider</th> : <th>Produktnr.</th>}
          <th>Pris eks. mva.</th>
          <th>Antall</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id}>
            <td data-label={heading} className="pt-table-strong">{product.name}</td>
            {withFits
              ? <td data-label="Passer leider">{product.fits ?? '–'}</td>
              : <td data-label="Produktnr.">{product.productNumber}</td>}
            <td data-label="Pris eks. mva.">{priceText(product)}</td>
            <td data-label="Antall">{qtyInput(product)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <form onSubmit={submit}>
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
          <p>
            Argostep leveres i faste lengder. Oppbevaringsskap tilpasset lengden kan bestilles sammen med leideren.
            {customOffered && ' Trenger du en lengde imellom, velger du «Annen lengde» nederst i lista.'}
          </p>
        </div>
        <div className="pt-card-body pt-flush">
          {ladders.length > 0 || customOffered ? (
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

                {/* Halvmetere: ikke egne produkter, men en lengde kunden velger selv. */}
                {customOffered && customRows.map((row, index) => {
                  const cabinet = cabinetForCustom(row.length);
                  return (
                    <tr key={row.key}>
                      <td data-label="Leider" className="pt-table-strong">
                        <div>
                          Annen lengde
                          <div className="pt-list-sub">Halvmeter, lages på bestilling</div>
                        </div>
                      </td>
                      <td data-label="Lengde">
                        <select
                          className="pt-input"
                          style={{ maxWidth: '8rem' }}
                          name={`custom_length_${row.key}`}
                          value={row.length}
                          onChange={(event) => changeCustom(row.key, { length: Number(event.target.value) })}
                          aria-label={`Lengde, annen lengde ${index + 1}`}
                        >
                          {customLengths.map((value) => (
                            <option key={value} value={value}>{meter(value)}</option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Pris eks. mva.">Pris på forespørsel</td>
                      <td data-label="Antall">
                        <input
                          className="pt-input"
                          style={{ maxWidth: '6.5rem' }}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={99}
                          name={`custom_qty_${row.key}`}
                          value={row.qty ? String(row.qty) : ''}
                          onChange={(event) => changeCustom(row.key, { qty: clampQty(event.target.value) })}
                          placeholder="0"
                          aria-label={`Antall leidere på ${meter(row.length)}`}
                        />
                      </td>
                      <td data-label="Skap">
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 0.9rem' }}>
                          {cabinet ? (
                            <label className="pt-check">
                              <input
                                type="checkbox"
                                name={`custom_cab_${row.key}`}
                                checked={row.cabinet}
                                onChange={(event) => changeCustom(row.key, { cabinet: event.target.checked })}
                              />
                              <span>Med skap {cabinetModel(cabinet.name)} (pris i tilbudet)</span>
                            </label>
                          ) : (
                            <span className="pt-muted">–</span>
                          )}
                          {customRows.length > 1 && (
                            <button
                              type="button"
                              className="pt-link"
                              onClick={() => setCustomRows((rows) => rows.filter((item) => item.key !== row.key))}
                              aria-label={`Fjern annen lengde ${index + 1}`}
                            >
                              Fjern
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="pt-empty">
              <strong>Ingen leidere i katalogen akkurat nå</strong>
              Ta kontakt med oss, så hjelper vi deg.
            </div>
          )}
        </div>
        {customOffered && (
          <div className="pt-card-foot">
            {customRows.length < 10 && (
              <>
                <button type="button" className="pt-link" onClick={addCustom}>
                  Legg til en annen lengde til
                </button>
                {' · '}
              </>
            )}
            Halvmetere har ikke fast pris. Du får tilbud fra oss før noe produseres.
          </div>
        )}
      </section>

      {cabinets.length > 0 && (
        <section className="pt-card" id="skap">
          <div className="pt-card-head">
            <h2>Oppbevaringsskap uten leider</h2>
            <p>Skap alene, for eksempel til en leider du har fra før. Skal skapet følge en ny leider, krysser du av i lista over.</p>
          </div>
          <div className="pt-card-body pt-flush">{simpleTable(cabinets, 'Skap', true)}</div>
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
                  {/* Med flere selskap velges ingen på forhånd: bestillingen
                      skal ikke havne i et selskap kunden ikke har valgt selv. */}
                  <select
                    id="order-company"
                    name="company_id"
                    required={companies.length > 1}
                    defaultValue={companies.length === 1 ? companies[0].id : ''}
                  >
                    {companies.length > 1 && <option value="" disabled>Velg selskap</option>}
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                    <option value="ingen">Ikke knyttet til et selskap</option>
                  </select>
                </div>
              )}
            </div>
            <div className="pt-form-row">
              <div className="pt-field">
                <label htmlFor="order-vessel">Fartøy (valgfritt)</label>
                <input id="order-vessel" name="vessel" maxLength={160} placeholder="Hvilket fartøy utstyret skal brukes på" />
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
            {/* Kvitteringen står øverst i skjemaet; knappen er nederst. */}
            {state?.ok && units === 0 && <span className="pt-msg" data-ok="true">Bestillingen er sendt.</span>}
          </div>
          <p style={{ marginTop: '0.5rem' }}>
            Bestillingen er ikke bindende før vi har bekreftet den. Prisen fastsettes ut fra gjeldende prisliste når bestillingen mottas.
          </p>
        </div>
      </section>
    </form>
  );
}
