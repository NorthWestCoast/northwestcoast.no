import { Input, Select, Textarea } from '@/components/admin/fields';
import { PRODUCT_KINDS, STOCK_CATEGORY, STOCK_SUPPLY, STOCK_UNITS } from '@/lib/portal/labels';
import { fmtQty } from '@/lib/stock';
import type { StockRow } from './data';

export type SupplierOption = { id: string; name: string };
export type ProductOption = { id: string; product_number: string; name: string; kind: string };

/**
 * Feltene for en lagervare, til «Ny vare» og «Rediger vare». Beholdningen er
 * ikke et felt: den endres bare av bevegelser og varetelling.
 */
export function ItemFields({
  scope,
  item,
  suppliers,
  products,
}: {
  /** Skiller id-ene når skjemaet står flere steder. */
  scope: string;
  /** Varen som redigeres. Uten den er skjemaet tomt, med vanlige forvalg. */
  item?: StockRow;
  suppliers: SupplierOption[];
  /** Produkter som ikke har en lagervare fra før, pluss det varen alt er knyttet til. */
  products: ProductOption[];
}) {
  return (
    <>
      {/* Hjelpetekstene står under radene, ikke i feltene: et felt med
          hjelpetekst i en rad strekker nabofeltene til samme høyde. */}
      <div className="pt-form-row pt-form-row-3">
        <Input
          scope={scope}
          name="item_number"
          label="Varenummer"
          required
          maxLength={40}
          autoComplete="off"
          defaultValue={item?.item_number ?? ''}
        />
        <Input scope={scope} name="name" label="Navn" required maxLength={160} defaultValue={item?.name ?? ''} />
        <Select scope={scope} name="unit" label="Enhet" defaultValue={item?.unit ?? 'stk'}>
          {STOCK_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </Select>
      </div>

      <div className="pt-form-row pt-form-row-3">
        <Select scope={scope} name="category" label="Kategori" defaultValue={item?.category ?? 'part'}>
          {Object.entries(STOCK_CATEGORY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Select scope={scope} name="supply" label="Hvordan den skaffes" defaultValue={item?.supply ?? 'purchased'}>
          {Object.entries(STOCK_SUPPLY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Input
          scope={scope}
          name="reorder_point"
          label="Minimum"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          maxLength={14}
          defaultValue={item ? fmtQty(item.reorder_point) : '0'}
        />
      </div>
      <p className="pt-hint">
        Varen merkes «Under minimum» når det som er tilgjengelig, er lavere enn minimum. 0 betyr ingen grense.
      </p>

      <div className="pt-form-row">
        <Input
          scope={scope}
          name="location"
          label="Lagerplass (valgfritt)"
          maxLength={120}
          defaultValue={item?.location ?? ''}
        />
        <Select scope={scope} name="supplier_id" label="Leverandør (valgfritt)" defaultValue={item?.supplier_id ?? ''}>
          <option value="">Ingen valgt</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </Select>
      </div>

      <Select
        scope={scope}
        name="product_id"
        label="Selges som produkt (valgfritt)"
        defaultValue={item?.product_id ?? ''}
        hint="Produktet varen selges som: en ferdig leider, et skap eller en reservedel. For en reservedel er det denne varen som trekkes fra lageret når reservedelen selges."
      >
        <option value="">Selges ikke som eget produkt</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.product_number} · {product.name} ({PRODUCT_KINDS[product.kind] ?? product.kind})
          </option>
        ))}
      </Select>

      <Textarea
        scope={scope}
        name="notes"
        label="Notat (valgfritt)"
        rows={2}
        maxLength={2000}
        defaultValue={item?.notes ?? ''}
      />
    </>
  );
}

/**
 * Produktene en vare kan knyttes til: aktive produkter som ikke alt har en
 * lagervare, pluss det varen selv er knyttet til (også om det er inaktivt).
 */
export function linkableProducts(
  products: (ProductOption & { active: boolean })[],
  takenProductIds: (string | null)[],
  currentProductId?: string | null,
): ProductOption[] {
  const taken = new Set(takenProductIds.filter((id) => id !== null));
  return products.filter(
    (product) => product.id === currentProductId || (product.active && !taken.has(product.id)),
  );
}
