'use client';

import { useMemo, useState } from 'react';
import Script from 'next/script';

// Priser iht. offisiell tabell. Skap-navn/-nummer og -pris følger lengden.
type Row = {
  length: number;
  steps: number;
  productNumber: string;
  productName: string;
  price: number;
  cabinetNumber: string;
  cabinetName: string;
  cabinetPrice: number;
};

const PRICE_TABLE: Row[] = [
  { length: 3,  steps: 10, productNumber: '400-031', productName: 'Argostep – 3ML',  price: 9499,  cabinetNumber: '400-061', cabinetName: 'ASC-LC3-5',   cabinetPrice: 9000 },
  { length: 4,  steps: 13, productNumber: '400-032', productName: 'Argostep – 4ML',  price: 10999, cabinetNumber: '400-062', cabinetName: 'ASC-LC3-5',   cabinetPrice: 9000 },
  { length: 5,  steps: 16, productNumber: '400-033', productName: 'Argostep – 5ML',  price: 12499, cabinetNumber: '400-063', cabinetName: 'ASC-LC3-5',   cabinetPrice: 9000 },
  { length: 6,  steps: 19, productNumber: '400-034', productName: 'Argostep – 6ML',  price: 13999, cabinetNumber: '400-065', cabinetName: 'ASC-LC5-6',   cabinetPrice: 9500 },
  { length: 7,  steps: 22, productNumber: '400-035', productName: 'Argostep – 7ML',  price: 15499, cabinetNumber: '400-062', cabinetName: 'ASC-LC6-8',   cabinetPrice: 10000 },
  { length: 8,  steps: 25, productNumber: '400-036', productName: 'Argostep – 8ML',  price: 16999, cabinetNumber: '400-063', cabinetName: 'ASC-LC6-8',   cabinetPrice: 10000 },
  { length: 9,  steps: 28, productNumber: '400-037', productName: 'Argostep – 9ML',  price: 18099, cabinetNumber: '400-063', cabinetName: 'ASC-LC9-10',  cabinetPrice: 11000 },
  { length: 10, steps: 31, productNumber: '400-038', productName: 'Argostep – 10ML', price: 20699, cabinetNumber: '400-064', cabinetName: 'ASC-LC9-10',  cabinetPrice: 11000 },
  { length: 11, steps: 34, productNumber: '400-039', productName: 'Argostep – 11ML', price: 23499, cabinetNumber: '400-064', cabinetName: 'ASC-LC11-16', cabinetPrice: 12000 },
  { length: 12, steps: 37, productNumber: '400-040', productName: 'Argostep – 12ML', price: 25999, cabinetNumber: '400-065', cabinetName: 'ASC-LC11-16', cabinetPrice: 12000 },
  { length: 13, steps: 40, productNumber: '400-041', productName: 'Argostep – 13ML', price: 27499, cabinetNumber: '400-066', cabinetName: 'ASC-LC11-16', cabinetPrice: 12000 },
  { length: 14, steps: 43, productNumber: '400-042', productName: 'Argostep – 14ML', price: 28999, cabinetNumber: '400-067', cabinetName: 'ASC-LC11-16', cabinetPrice: 12000 },
  { length: 15, steps: 46, productNumber: '400-043', productName: 'Argostep – 15ML', price: 30599, cabinetNumber: '400-068', cabinetName: 'ASC-LC11-16', cabinetPrice: 12000 },
];

const LENGTHS = PRICE_TABLE.map((r) => r.length); // 3..15

type CartItem = {
  id: number;
  length: number;
  qty: number;
  cabinet: boolean;
};

const fmt = (n: number) => n.toLocaleString('nb-NO');
const rowFor = (length: number) => PRICE_TABLE.find((r) => r.length === length) ?? PRICE_TABLE[0];

function itemTotal(item: CartItem) {
  const row = rowFor(item.length);
  const unit = row.price + (item.cabinet ? row.cabinetPrice : 0);
  return unit * item.qty;
}

let nextId = 1;

export default function OrderConfigurator() {
  // Currently configured (draft) item
  const [length, setLength] = useState(6);
  const [qty, setQty] = useState(1);
  const [cabinet, setCabinet] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [sent, setSent] = useState(false);

  const row = useMemo(() => rowFor(length), [length]);

  const draftUnit = row.price + (cabinet ? row.cabinetPrice : 0);
  const draftTotal = draftUnit * qty;

  const grandTotal = useMemo(() => cart.reduce((s, it) => s + itemTotal(it), 0), [cart]);

  const addToOrder = () => {
    setCart((prev) => [...prev, { id: nextId++, length, qty, cabinet }]);
    // reset draft to defaults
    setCabinet(false);
    setQty(1);
    setSent(false);
  };

  const removeItem = (id: number) => setCart((prev) => prev.filter((it) => it.id !== id));
  const updateQty = (id: number, delta: number) =>
    setCart((prev) =>
      prev.map((it) => (it.id === id ? { ...it, qty: Math.max(1, it.qty + delta) } : it)),
    );

  return (
    <div className="config-grid">
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"
        type="module"
        strategy="lazyOnload"
      />
      {/* 3D viewer */}
      <div className="config-viewer">
        {/* @ts-expect-error – model-viewer is a custom web component */}
        <model-viewer
          src="/3d-models/leider-compressed-v2.glb"
          alt="Argostep 3D modell"
          auto-rotate
          camera-controls
          shadow-intensity="1"
          exposure="1.1"
          environment-image="neutral"
          style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0e2540 100%)', width: '100%', height: '100%' }}
          loading="eager"
          ar
        />
        <div className="config-viewer-badge">{length} m · {Math.round(length / 0.32)} trinn</div>
        <div className="config-viewer-hint">Dra for å rotere</div>
      </div>

      {/* Options */}
      <div className="config-panel">
        <div className="lbl">Konfigurer din leider</div>
        <h2 className="stitle">{row.productName}</h2>
        <p className="config-product-no">Produktnr. {row.productNumber} · {row.steps} trinn</p>

        <div className="config-block">
          <div className="config-row">
            <label htmlFor="length">Lengde</label>
            <span className="config-value">{length} m</span>
          </div>
          <select
            id="length"
            className="config-select"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
          >
            {LENGTHS.map((v) => (
              <option key={v} value={v}>{v} meter</option>
            ))}
          </select>
        </div>

        <div className="config-block">
          <div className="config-row">
            <label>Tilbehør</label>
          </div>
          <div className="config-extras">
            <button
              type="button"
              className={`config-extra${cabinet ? ' active' : ''}`}
              onClick={() => setCabinet((v) => !v)}
            >
              <span>{`Oppbevaringsskap ${row.cabinetName}`}</span>
              <span className="config-extra-price">+{fmt(row.cabinetPrice)} kr</span>
            </button>
          </div>
        </div>

        <div className="config-block">
          <div className="config-row">
            <label>Antall</label>
            <div className="config-qty">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Færre">−</button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty((q) => q + 1)} aria-label="Flere">+</button>
            </div>
          </div>
        </div>

        <button type="button" className="btn-primary config-add" onClick={addToOrder}>
          Legg til i bestilling · {fmt(draftTotal)} kr
        </button>

        {/* Order list */}
        {cart.length > 0 && (
          <div className="config-cart">
            <div className="config-cart-head">Din bestilling ({cart.length})</div>
            {cart.map((it) => {
              const r = rowFor(it.length);
              return (
                <div key={it.id} className="config-cart-item">
                  <div className="config-cart-info">
                    <strong>{r.productName}</strong>
                    <span className="config-cart-meta">
                      {[
                        `Produktnr. ${r.productNumber}`,
                        it.cabinet ? `Skap ${r.cabinetName}` : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <div className="config-cart-qty">
                    <button type="button" onClick={() => updateQty(it.id, -1)} aria-label="Færre">−</button>
                    <span>{it.qty}</span>
                    <button type="button" onClick={() => updateQty(it.id, 1)} aria-label="Flere">+</button>
                  </div>
                  <div className="config-cart-price">{fmt(itemTotal(it))} kr</div>
                  <button type="button" className="config-cart-remove" onClick={() => removeItem(it.id)} aria-label="Fjern">
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="config-total">
          <div>
            <span className="config-total-label">Totalsum</span>
            <span className="config-total-sub">
              {cart.length === 0
                ? 'Legg til minst én leider'
                : `${cart.reduce((s, it) => s + it.qty, 0)} leider(e)`}
            </span>
          </div>
          <span className="config-total-amount">{fmt(grandTotal)} kr</span>
        </div>

        {!sent ? (
          <button
            type="button"
            className="btn-primary config-submit"
            onClick={() => cart.length > 0 && setSent(true)}
            disabled={cart.length === 0}
          >
            Send bestilling →
          </button>
        ) : (
          <div className="config-confirm">
            ✓ Takk! Vi har mottatt din bestilling på {cart.reduce((s, it) => s + it.qty, 0)} leider(e) og tar kontakt for bekreftelse.
          </div>
        )}
        <p className="config-note">
          Prisen er veiledende eks. mva. Endelig tilbud bekreftes etter kontakt.
        </p>
      </div>
    </div>
  );
}
