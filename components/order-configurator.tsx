'use client';

import { useMemo, useState } from 'react';
import Script from 'next/script';
import { track, trackOrder } from '@/lib/analytics';
import {
  LENGTHS,
  fmt,
  lineTotal,
  orderTotal,
  rowFor,
  unitPrice,
  type OrderLine,
} from '@/lib/pricing';

type CartItem = OrderLine & { id: number };

let nextId = 1;

export default function OrderConfigurator() {
  // Currently configured (draft) item
  const [length, setLength] = useState(6);
  const [qty, setQty] = useState(1);
  const [cabinet, setCabinet] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);

  // Checkout
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const row = useMemo(() => rowFor(length), [length]);

  const draftUnit = unitPrice(length, cabinet);
  const draftTotal = draftUnit * qty;

  const grandTotal = useMemo(() => orderTotal(cart), [cart]);
  const totalUnits = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

  const addToOrder = () => {
    setCart((prev) => [...prev, { id: nextId++, length, qty, cabinet }]);
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
          // Kun konfigurasjon sendes – serveren regner ut prisen selv.
          items: cart.map(({ length: l, qty: q, cabinet: c }) => ({ length: l, qty: q, cabinet: c })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Vi klarte ikke å sende bestillingen. Ring +47 904 07 341.');
      }

      trackOrder('Order: Submitted', grandTotal, { lines: cart.length, units: totalUnits });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Vi klarte ikke å sende bestillingen. Prøv igjen.',
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
            onChange={(e) => {
              const next = Number(e.target.value);
              setLength(next);
              track('Order: Configure', { props: { length: next } });
            }}
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
                  <div className="config-cart-price">{fmt(lineTotal(it))} kr</div>
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
              {cart.length === 0 ? 'Legg til minst én leider' : `${totalUnits} leider(e)`}
            </span>
          </div>
          <span className="config-total-amount">{fmt(grandTotal)} kr</span>
        </div>

        {sent ? (
          <div className="config-confirm">
            ✓ Takk! Vi har mottatt forespørselen på {totalUnits} leider(e) og sendt deg en
            bekreftelse på e-post. Vi tar kontakt for endelig tilbud og leveringstid.
          </div>
        ) : !checkoutOpen ? (
          <button
            type="button"
            className="btn-primary config-submit"
            onClick={openCheckout}
            disabled={cart.length === 0}
          >
            Send bestilling →
          </button>
        ) : (
          <form className="config-checkout" onSubmit={handleSubmit}>
            <div className="config-checkout-head">
              Hvor skal vi sende tilbudet?
              <span>Vi bekrefter pris og leveringstid – ingen forpliktelse.</span>
            </div>

            <div className="form-row">
              <div className="fg">
                <label htmlFor="order-name">Navn *</label>
                <input id="order-name" name="name" type="text" placeholder="Ditt navn" required autoComplete="name" />
              </div>
              <div className="fg">
                <label htmlFor="order-email">E-post *</label>
                <input id="order-email" name="email" type="email" placeholder="epost@firma.no" required autoComplete="email" />
              </div>
            </div>

            <div className="form-row">
              <div className="fg">
                <label htmlFor="order-phone">Telefon</label>
                <input id="order-phone" name="phone" type="tel" placeholder="+47 000 00 000" autoComplete="tel" />
              </div>
              <div className="fg">
                <label htmlFor="order-vessel">Fartøy/Rederi</label>
                <input id="order-vessel" name="vessel" type="text" placeholder="F.eks. MS Havbris" autoComplete="organization" />
              </div>
            </div>

            <div className="fg">
              <label htmlFor="order-notes">Kommentar</label>
              <textarea
                id="order-notes"
                name="notes"
                placeholder="Ønsket leveringstid, montering, spesialtilpasning…"
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
              {sending ? 'Sender…' : `Send forespørsel · ${fmt(grandTotal)} kr →`}
            </button>

            <p className="config-note">
              Foretrekker du å snakke med noen?{' '}
              <a
                href="tel:+4790407341"
                onClick={() => track('Lead: Phone click', { props: { source: 'configurator' } })}
              >
                Ring +47 904 07 341
              </a>
            </p>
          </form>
        )}

        <p className="config-note">
          Prisen er veiledende eks. mva. Endelig tilbud bekreftes etter kontakt.
        </p>
      </div>
    </div>
  );
}
