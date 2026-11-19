'use client';

import { useState } from 'react';

export type JobProduct = {
  id: string;
  label: string;
  /** Navnet på skapet som hører til, eller null når produktet ikke har skap. */
  cabinetName: string | null;
};

/**
 * Produktvalg for en manuell jobb. Avkrysningen for oppbevaringsskap følger
 * det valgte produktet: uten tilhørende skap kan den ikke velges.
 */
export function ProductFields({ products }: { products: JobProduct[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const cabinetName = products.find((p) => p.id === productId)?.cabinetName ?? null;

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
          {products.map((product) => (
            <option key={product.id} value={product.id}>{product.label}</option>
          ))}
        </select>
      </div>

      <label className="pt-check">
        <input type="checkbox" name="with_cabinet" disabled={!cabinetName} />
        <span>
          Med oppbevaringsskap
          <span className="pt-muted">
            {cabinetName ? ` – ${cabinetName}` : ' – dette produktet har ikke et tilhørende skap'}
          </span>
        </span>
      </label>
    </>
  );
}
