'use client';

import { useMemo, useState } from 'react';
import Script from 'next/script';
import { useLang, useT } from '@/components/lang-provider';
import { track, trackOrder } from '@/lib/analytics';
import {
  cabinetAvailable,
  fmt,
  makePricing,
  type OrderLine,
  type PriceTable,
} from '@/lib/pricing';

type CartItem = OrderLine & { id: number };

let nextId = 1;

export default function OrderConfigurator({ rows }: { rows: PriceTable }) {
  const lang = useLang();
  const t = useT();
  // Currently configured (draft) item
  const [length, setLength] = useState(() => {
    const preferred = rows.find((r) => r.length === 6 && !r.onRequest);
    return (preferred ?? rows.find((r) => !r.onRequest) ?? rows[0]).length;
  });
  const [qty, setQty] = useState(1);
  const [cabinet, setCabinet] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);

  // Checkout
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { lengths, rowFor, unitPrice, lineTotal, orderTotal } = useMemo(() => makePricing(rows), [rows]);

  const row = useMemo(() => rowFor(length), [rowFor, length]);

  const draftUnit = unitPrice(length, cabinet);
  const draftTotal = draftUnit * qty;

  const grandTotal = useMemo(() => orderTotal(cart), [orderTotal, cart]);
  const totalUnits = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

  const addToOrder = () => {
    setCart((prev) => [...prev, { id: nextId++, length, qty, cabinet: cabinet && cabinetAvailable(row) }]);
    trackOrder('Order: Add to cart', draftTotal, {
      length,
      cabinet,
      qty,
      product: row.productNumber,
    });
    // reset draft to defaults
    setCabinet(false);
    setQty(1);
    setSent(false);
    setError(null);
  };

  const removeItem = (id: number) => setCart((prev) => prev.filter((it) => it.id !== id));
  const updateQty = (id: number, delta: number) =>
    setCart((prev) =>
      prev.map((it) => (it.id === id ? { ...it, qty: Math.max(1, it.qty + delta) } : it)),
    );

  const openCheckout = () => {
    if (cart.length === 0) return;
    setCheckoutOpen(true);
    trackOrder('Order: Begin checkout', grandTotal, { lines: cart.length, units: totalUnits });
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSending(true);

    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;

    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          vessel: data.vessel,
          notes: data.notes,
          company_website: data.company_website, // honeypot
          lang,
          // Kun konfigurasjon sendes – serveren regner ut prisen selv.
          items: cart.map(({ length: l, qty: q, cabinet: c }) => ({ length: l, qty: q, cabinet: c })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t.order.errorSend);
      }

      trackOrder('Order: Submitted', grandTotal, { lines: cart.length, units: totalUnits });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.order.errorRetry,
      );
    } finally {
      setSending(false);
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
            onChange={(e) => {
              const next = Number(e.target.value);
              setLength(next);
              track('Order: Configure', { props: { length: next } });
            }}
          >
            {lengths.map((v) => (
              <option key={v} value={v}>{v} {t.order.meters}</option>
            ))}
          </select>
        </div>

        {cabinetAvailable(row) && (
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
                  <div className="config-cart-price">{r.onRequest ? '–' : `${fmt(lineTotal(it))} kr`}</div>
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
              {cart.length === 0 ? t.order.emptyHint : `${totalUnits} ${t.order.ladderCount}`}
            </span>
          </div>
          <span className="config-total-amount">
            {cart.length > 0 && cart.every((it) => rowFor(it.length).onRequest)
              ? t.order.onRequest
              : `${fmt(grandTotal)} kr`}
          </span>
        </div>

        {sent ? (
          <div className="config-confirm">{t.order.confirmRequest(totalUnits)}</div>
        ) : !checkoutOpen ? (
          <button
            type="button"
            className="btn-primary config-submit"
            onClick={openCheckout}
            disabled={cart.length === 0}
          >
            {t.order.submit}
          </button>
        ) : (
          <form className="config-checkout" onSubmit={handleSubmit}>
            <div className="config-checkout-head">
              {t.order.leadTitle}
              <span>{t.order.checkoutSub}</span>
            </div>

            <div className="form-row">
              <div className="fg">
                <label htmlFor="order-name">{t.order.fields.name}</label>
                <input id="order-name" name="name" type="text" placeholder={t.order.fields.namePlaceholder} required autoComplete="name" />
              </div>
              <div className="fg">
                <label htmlFor="order-email">{t.order.fields.email}</label>
                <input id="order-email" name="email" type="email" placeholder={t.order.fields.emailPlaceholder} required autoComplete="email" />
              </div>
            </div>

            <div className="form-row">
              <div className="fg">
                <label htmlFor="order-phone">{t.order.fields.phone}</label>
                <input id="order-phone" name="phone" type="tel" placeholder={t.order.fields.phonePlaceholder} autoComplete="tel" />
              </div>
              <div className="fg">
                <label htmlFor="order-vessel">{t.order.vesselCompany}</label>
                <input id="order-vessel" name="vessel" type="text" placeholder={t.order.fields.companyPlaceholder} autoComplete="organization" />
              </div>
            </div>

            <div className="fg">
              <label htmlFor="order-notes">{t.order.fields.notes}</label>
              <textarea
                id="order-notes"
                name="notes"
                placeholder={t.order.notesPlaceholderBase}
              />
            </div>

            {/* Honeypot – skjult for mennesker, fylles ut av bots */}
            <input
              type="text"
              name="company_website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hp-field"
            />

            {error && <p className="config-error">{error}</p>}

            <button type="submit" className="btn-primary config-submit" disabled={sending}>
              {sending
                ? t.order.sending
                : cart.every((it) => rowFor(it.length).onRequest)
                  ? t.order.sendRequest
                  : t.order.sendRequestValue(fmt(grandTotal))}
            </button>

            <p className="config-note">
              {t.order.preferPhone}{' '}
              <a
                href="tel:+4790407341"
                onClick={() => track('Lead: Phone click', { props: { source: 'configurator' } })}
              >
                {t.order.callUs}
              </a>
            </p>
          </form>
        )}

        {cart.some((it) => rowFor(it.length).onRequest) && (
          <p className="config-note">
            {t.order.onRequestNote}
          </p>
        )}
        <p className="config-note">
          {t.order.note}
        </p>
      </div>
    </div>
  );
}
