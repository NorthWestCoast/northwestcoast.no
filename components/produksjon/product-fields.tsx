'use client';

import { useState } from 'react';

export type JobProduct = {
  id: string;
  label: string;
  /** Leider, eller et oppbevaringsskap som produseres alene. */
  kind: 'ladder' | 'cabinet';
  /** Spesiallengde: lengden skrives inn i skjemaet, den står ikke på produktet. */
  custom: boolean;
  /** Lengden i meter for en leider med fast lengde. */
  length: number | null;
  /** Navnet på skapet som hører til, eller null når produktet ikke har skap. */
  cabinetName: string | null;
};

/**
 * Produktvalg for en manuell jobb. Resten av feltene følger det valgte
 * produktet: en spesiallengde trenger en lengde, og avkrysningen for
 * oppbevaringsskap finnes bare for leidere som har et tilhørende skap.
 */
export function ProductFields({ products }: { products: JobProduct[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [customLength, setCustomLength] = useState('');

  const product = products.find((p) => p.id === productId);
  const ladders = products.filter((p) => p.kind === 'ladder');
  const cabinets = products.filter((p) => p.kind === 'cabinet');

  // En spesiallengde får skapet som hører til nærmeste standardlengde over.
  const wanted = Number(customLength.replace(',', '.'));
  const cabinetName = product?.custom
    ? ladders
        .filter((p) => p.length !== null && p.cabinetName && wanted > 0 && p.length >= wanted)
        .sort((a, b) => (a.length as number) - (b.length as number))[0]?.cabinetName ?? null
    : product?.cabinetName ?? null;

  return (
    <>
      <div className="pt-field">
        <label htmlFor="job-product">Produkt</label>
        <select
          id="job-product"
          name="product"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          required
        >
          {ladders.length > 0 && (
            <optgroup label="Leidere">
              {ladders.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </optgroup>
          )}
          {cabinets.length > 0 && (
            <optgroup label="Oppbevaringsskap uten leider">
              {cabinets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </optgroup>
          )}
        </select>
        {product?.kind === 'cabinet' && (
          <small>Skapet blir en egen jobb, uten lengde og trinn. Produksjonsnummer er valgfritt.</small>
        )}
      </div>

      {product?.custom && (
        <div className="pt-field">
          <label htmlFor="job-custom-length">Lengde (meter)</label>
          <input
            id="job-custom-length"
            name="custom_length"
            type="number"
            inputMode="decimal"
            min={1.5}
            max={30}
            step={0.5}
            value={customLength}
            onChange={(event) => setCustomLength(event.target.value)}
            placeholder="F.eks. 4,5"
            style={{ maxWidth: '10rem' }}
            required
          />
          <small>Hele eller halve meter mellom 1,5 og 30. Antall trinn settes på jobben når det er avklart.</small>
        </div>
      )}

      {product?.kind !== 'cabinet' && (
        <label className="pt-check">
          <input type="checkbox" name="with_cabinet" disabled={!cabinetName} />
          <span>
            Med oppbevaringsskap
            <span className="pt-muted">
              {cabinetName
                ? ` – ${cabinetName}`
                : product?.custom
                  ? ' – skriv inn lengden først'
                  : ' – dette produktet har ikke et tilhørende skap'}
            </span>
          </span>
        </label>
      )}
    </>
  );
}
