'use client';

import { useMemo, useState } from 'react';
import Script from 'next/script';
import { useLang, useT } from '@/components/lang-provider';
import { EVENTS, track } from '@/lib/analytics';
import { LENGTHS, fmt, rowFor, unitPrice } from '@/lib/pricing';

type CartItem = {
  id: number;
  length: number;
  qty: number;
  cabinet: boolean;
};

function itemTotal(item: CartItem) {
  return unitPrice(rowFor(item.length), item.cabinet) * item.qty;
}

let nextId = 1;

export default function OrderConfigurator() {
  // Currently configured (draft) item
  const [length, setLength] = useState(6);
  const [qty, setQty] = useState(1);
  const [cabinet, setCabinet] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lang = useLang();
  const t = useT();

  const row = useMemo(() => rowFor(length), [length]);

  const draftUnit = unitPrice(row, cabinet);
  const draftTotal = draftUnit * qty;

  const grandTotal = useMemo(() => cart.reduce((s, it) => s + itemTotal(it), 0), [cart]);
  const totalQty = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

  const addToOrder = () => {
    setCart((prev) => [...prev, { id: nextId++, length, qty, cabinet: cabinet && !row.onRequest }]);
    track(EVENTS.orderItemAdded, { lang, length, qty, cabinet });
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (cart.length === 0) return;
    setError(null);
    setLoading(true);

    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;

    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company,
          imo: data.imo,
          notes: data.notes,
          items: cart.map(({ length: l, qty: q, cabinet: c }) => ({ length: l, qty: q, cabinet: c })),
          lang,
        }),
      });
      if (!res.ok) {
        const bodyJson = await res.json().catch(() => ({}));
        throw new Error(bodyJson.error ?? t.errors.generic);
      }
      track(EVENTS.orderSubmitted, { lang, items: cart.length, ladders: totalQty, value: grandTotal });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

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
          alt={t.viewer.modelAlt}
          auto-rotate
          camera-controls
          shadow-intensity="1"
          exposure="1.1"
          environment-image="neutral"
          style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0e2540 100%)', width: '100%', height: '100%' }}
          loading="eager"
          ar
        />
        <div className="config-viewer-badge">
          {row.onRequest ? `${length} m` : `${length} m · ${row.steps} ${t.order.steps}`}
        </div>
        <div className="config-viewer-hint">{t.order.rotateHint}</div>
      </div>

      {/* Options */}
      <div className="config-panel">
        <div className="lbl">{t.order.configureLabel}</div>
        <h2 className="stitle">{row.productName}</h2>
        <p className="config-product-no">
          {row.onRequest
            ? t.order.onRequest
            : `${t.order.productNo} ${row.productNumber} · ${row.steps} ${t.order.steps}`}
        </p>

        <div className="config-block">
          <div className="config-row">
            <label htmlFor="length">{t.order.length}</label>
            <span className="config-value">{length} m</span>
          </div>
          <select
            id="length"
            className="config-select"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
          >
            {LENGTHS.map((v) => (
              <option key={v} value={v}>{v} {t.order.meters}</option>
            ))}
          </select>
        </div>

        {!row.onRequest && (
        <div className="config-block">
          <div className="config-row">
            <label>{t.order.accessories}</label>
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
                {`${t.order.cabinet} ${row.cabinetName}`}
                {cabinet && <span className="config-extra-tag">{t.order.selected}</span>}
              </span>
              <span className="config-extra-price">+{fmt(row.cabinetPrice)} kr</span>
            </button>
          </div>
        </div>
        )}

        <div className="config-block">
          <div className="config-row">
            <label>{t.order.quantity}</label>
            <div className="config-qty">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t.order.fewer}>−</button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty((q) => q + 1)} aria-label={t.order.more}>+</button>
            </div>
          </div>
        </div>

        <button type="button" className="btn-primary config-add" onClick={addToOrder}>
          {row.onRequest ? t.order.addToOrder : `${t.order.addToOrder} · ${fmt(draftTotal)} kr`}
        </button>

        {/* Order list */}
        {cart.length > 0 && (
          <div className="config-cart">
            <div className="config-cart-head">{t.order.yourOrder} ({cart.length})</div>
            {cart.map((it) => {
              const r = rowFor(it.length);
              return (
                <div key={it.id} className="config-cart-item">
                  <div className="config-cart-info">
                    <strong>{r.productName}</strong>
                    <span className="config-cart-meta">
                      {[
                        r.onRequest ? t.order.onRequest : `${t.order.productNo} ${r.productNumber}`,
                        it.cabinet ? `${t.order.cabinet} ${r.cabinetName}` : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <div className="config-cart-qty">
                    <button type="button" onClick={() => updateQty(it.id, -1)} aria-label={t.order.fewer}>−</button>
                    <span>{it.qty}</span>
                    <button type="button" onClick={() => updateQty(it.id, 1)} aria-label={t.order.more}>+</button>
                  </div>
                  <div className="config-cart-price">
                    {r.onRequest ? '–' : `${fmt(itemTotal(it))} kr`}
                  </div>
                  <button type="button" className="config-cart-remove" onClick={() => removeItem(it.id)} aria-label={t.order.remove}>
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="config-total">
          <div>
            <span className="config-total-label">{t.order.total}</span>
            <span className="config-total-sub">
              {cart.length === 0 ? t.order.emptyHint : `${totalQty} ${t.order.ladderCount}`}
            </span>
          </div>
          <span className="config-total-amount">
            {cart.length > 0 && cart.every((it) => rowFor(it.length).onRequest)
              ? t.order.onRequest
              : `${fmt(grandTotal)} kr`}
          </span>
        </div>

        {sent ? (
          <div className="config-confirm">{t.order.confirm}</div>
        ) : (
          <form className="config-lead" onSubmit={handleSubmit}>
            <div className="config-lead-head">
              <h3>{t.order.leadTitle}</h3>
              <p>{t.order.leadSub}</p>
            </div>

            <div className="config-lead-grid">
              <div className="config-field">
                <label htmlFor="order-name">{t.order.fields.name}</label>
                <input id="order-name" name="name" type="text" placeholder={t.order.fields.namePlaceholder} required />
              </div>
              <div className="config-field">
                <label htmlFor="order-email">{t.order.fields.email}</label>
                <input id="order-email" name="email" type="email" placeholder={t.order.fields.emailPlaceholder} required />
              </div>
              <div className="config-field">
                <label htmlFor="order-phone">{t.order.fields.phone}</label>
                <input id="order-phone" name="phone" type="tel" placeholder={t.order.fields.phonePlaceholder} />
              </div>
              <div className="config-field">
                <label htmlFor="order-company">{t.order.fields.company}</label>
                <input id="order-company" name="company" type="text" placeholder={t.order.fields.companyPlaceholder} />
              </div>
              <div className="config-field">
                <label htmlFor="order-imo">{t.order.fields.imo}</label>
                <input id="order-imo" name="imo" type="text" placeholder={t.order.fields.imoPlaceholder} />
              </div>
              <div className="config-field config-field-wide">
                <label htmlFor="order-notes">{t.order.fields.notes}</label>
                <textarea
                  id="order-notes"
                  name="notes"
                  placeholder={t.order.fields.notesPlaceholder}
                />
              </div>
            </div>

            {error && <p className="config-error">{error}</p>}

            <button type="submit" className="btn-primary config-submit" disabled={cart.length === 0 || loading}>
              {loading ? t.order.sending : t.order.submit}
            </button>
          </form>
        )}

        {cart.some((it) => rowFor(it.length).onRequest) && (
          <p className="config-note">{t.order.onRequestNote}</p>
        )}
        <p className="config-note">{t.order.note}</p>
      </div>
    </div>
  );
}
