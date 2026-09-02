'use client';

import { useEffect, useMemo, useState } from 'react';
import Script from 'next/script';

import {
  LENGTHS,
  MAX_LENGTH,
  MIN_LENGTH,
  fmt,
  rowFor,
  type LadderRow,
} from '@/lib/products';

// The price table now lives in lib/products.ts so the calculator page and the
// Product JSON-LD render the exact same numbers this basket does.

type CartItem = {
  id: number;
  length: number;
  qty: number;
  cabinet: boolean;
};

function itemTotal(item: CartItem) {
  const row: LadderRow = rowFor(item.length);
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

  /*
   * Accept a length from the URL (/bestill?lengde=9), which is how the
   * Leiderkalkulator hands its recommendation over. Read from location rather
   * than useSearchParams so the page stays statically prerendered — the hook
   * would force this route out of static rendering into a Suspense boundary for
   * no benefit here.
   */
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('lengde');
    if (!raw) return;
    const n = Number(raw);
    if (Number.isFinite(n) && LENGTHS.includes(n)) {
      setLength(n);
    } else if (Number.isFinite(n)) {
      // Out-of-range values are clamped rather than ignored, so a stale or
      // hand-edited link still lands on a sensible configuration.
      setLength(Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.ceil(n))));
    }
  }, []);

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
        <div className="config-viewer-badge">{length} m · {row.steps} trinn</div>
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
              aria-pressed={cabinet}
            >
              <span className="config-extra-check" aria-hidden="true">
                {cabinet ? '✓' : ''}
              </span>
              <span className="config-extra-label">
                {`Oppbevaringsskap ${row.cabinetName}`}
                {cabinet && <span className="config-extra-tag">Valgt</span>}
              </span>
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
