'use client';

import { useMemo, useState } from 'react';
import Script from 'next/script';

// Priser iht. offisiell tabell. Skap- og PVC-pris (og størrelse/antall) følger lengden.
type Row = { length: number; price: number; cabinetSize: number; cabinetPrice: number; pvcPrice: number };

const PRICE_TABLE: Row[] = [
  { length: 3,  price: 9499,  cabinetSize: 1, cabinetPrice: 4999, pvcPrice: 3999 },
  { length: 4,  price: 10999, cabinetSize: 1, cabinetPrice: 4999, pvcPrice: 3999 },
  { length: 5,  price: 12499, cabinetSize: 1, cabinetPrice: 4999, pvcPrice: 3999 },
  { length: 6,  price: 13999, cabinetSize: 1, cabinetPrice: 4999, pvcPrice: 3999 },
  { length: 7,  price: 15499, cabinetSize: 2, cabinetPrice: 5999, pvcPrice: 4999 },
  { length: 8,  price: 16999, cabinetSize: 2, cabinetPrice: 5999, pvcPrice: 4999 },
  { length: 9,  price: 18099, cabinetSize: 2, cabinetPrice: 5999, pvcPrice: 4999 },
  { length: 10, price: 20699, cabinetSize: 2, cabinetPrice: 5999, pvcPrice: 4999 },
  { length: 11, price: 22199, cabinetSize: 3, cabinetPrice: 6999, pvcPrice: 5999 },
  { length: 12, price: 24199, cabinetSize: 3, cabinetPrice: 6999, pvcPrice: 5999 },
  { length: 13, price: 25499, cabinetSize: 3, cabinetPrice: 6999, pvcPrice: 5999 },
  { length: 14, price: 26799, cabinetSize: 3, cabinetPrice: 6999, pvcPrice: 5999 },
  { length: 15, price: 28999, cabinetSize: 3, cabinetPrice: 6999, pvcPrice: 5999 },
];

const LENGTHS = PRICE_TABLE.map((r) => r.length); // 3..15

type CartItem = {
  id: number;
  length: number;
  qty: number;
  cabinet: boolean;
  pvc: boolean;
};

const fmt = (n: number) => n.toLocaleString('nb-NO');
const rowFor = (length: number) => PRICE_TABLE.find((r) => r.length === length) ?? PRICE_TABLE[0];

function itemTotal(item: CartItem) {
  const row = rowFor(item.length);
  const unit = row.price + (item.cabinet ? row.cabinetPrice : 0) + (item.pvc ? row.pvcPrice : 0);
  return unit * item.qty;
}

let nextId = 1;

export default function OrderConfigurator() {
  // Currently configured (draft) item
  const [length, setLength] = useState(6);
  const [qty, setQty] = useState(1);
  const [cabinet, setCabinet] = useState(false);
  const [pvc, setPvc] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [sent, setSent] = useState(false);

  const row = useMemo(() => rowFor(length), [length]);

  const draftUnit = row.price + (cabinet ? row.cabinetPrice : 0) + (pvc ? row.pvcPrice : 0);
  const draftTotal = draftUnit * qty;

  const grandTotal = useMemo(() => cart.reduce((s, it) => s + itemTotal(it), 0), [cart]);

  const addToOrder = () => {
    setCart((prev) => [...prev, { id: nextId++, length, qty, cabinet, pvc }]);
    // reset draft to defaults
    setCabinet(false);
    setPvc(false);
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
        <h2 className="stitle">Argostep Livbåtleider</h2>

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
              <span>{`Oppbevaringsskap (str. ${row.cabinetSize})`}</span>
              <span className="config-extra-price">+{fmt(row.cabinetPrice)} kr</span>
            </button>
            <button
              type="button"
              className={`config-extra${pvc ? ' active' : ''}`}
              onClick={() => setPvc((v) => !v)}
            >
              <span>PVC-duk</span>
              <span className="config-extra-price">+{fmt(row.pvcPrice)} kr</span>
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
                    <strong>{it.length} m Livbåtleider</strong>
                    <span className="config-cart-meta">
                      {[
                        it.cabinet ? `Skap str. ${r.cabinetSize}` : null,
                        it.pvc ? 'PVC-duk' : null,
                      ].filter(Boolean).join(' · ') || 'Uten tilbehør'}
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
