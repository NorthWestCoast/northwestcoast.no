'use client';

import { useMemo, useState } from 'react';
import Script from 'next/script';
import { useLang, useT } from '@/components/lang-provider';
import { track, trackOrder } from '@/lib/analytics';
import {
  CUSTOM_PRODUCT_NUMBER,
  cabinetAvailable,
  cabinetLineTotal,
  fitsRange,
  fmt,
  fmtLength,
  makePricing,
  type CabinetRow,
  type PriceTable,
} from '@/lib/pricing';

/**
 * En linje i bestillingen. En leider har en lengde (standard eller halvmeter)
 * og kan ha skap; et skap bestilt alene har bare produktnummeret sitt.
 */
type LadderItem = { id: number; kind: 'ladder'; length: number; qty: number; cabinet: boolean };
type CabinetItem = { id: number; kind: 'cabinet'; cabinetNumber: string; qty: number };
type CartItem = LadderItem | CabinetItem;

/** Det kunden ser for en linje. Prisen er veiledende; serveren regner selv. */
type LineInfo = { name: string; meta: string; total: number; onRequest: boolean };

let nextId = 1;

export default function OrderConfigurator({
  rows,
  cabinets = [],
  customLengths = true,
}: {
  rows: PriceTable;
  /** Skap som kan bestilles uten leider. Tom når prislista er reserven. */
  cabinets?: CabinetRow[];
  /** Halvmetere («Annen lengde») kan bestilles. Av når produktet er tatt ut av katalogen. */
  customLengths?: boolean;
}) {
  const lang = useLang();
  const t = useT();

  const { lengths, rowFor, unitPrice, isStandard, cabinetRowForCustom, halfLengths: allHalfLengths } = useMemo(
    () => makePricing(rows),
    [rows],
  );
  const halfLengths = customLengths ? allHalfLengths : [];

  // Utkastet: leideren som settes sammen akkurat nå.
  const [length, setLength] = useState(() => {
    const preferred = rows.find((r) => r.length === 6 && !r.onRequest);
    return (preferred ?? rows.find((r) => !r.onRequest) ?? rows[0]).length;
  });
  // «Annen lengde»: en halvmeter mellom standardlengdene, på forespørsel.
  const [customOn, setCustomOn] = useState(false);
  const [customLength, setCustomLength] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [cabinet, setCabinet] = useState(false);

  const [cabinetsOpen, setCabinetsOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Checkout
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sending, setSending] = useState(false);
  /** Kvitteringen etter sending, eller null. */
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const row = useMemo(() => rowFor(length), [rowFor, length]);

  const isCustom = customOn && customLength !== null;
  const draftLength = isCustom ? customLength : length;
  /** Skapet som følger en halvmeter er det for nærmeste standardlengde over. */
  const customCabinetRow = isCustom ? cabinetRowForCustom(customLength) : null;
  const canCabinet = isCustom ? customCabinetRow !== null : cabinetAvailable(row);
  const cabinetName = isCustom ? customCabinetRow?.cabinetName ?? '' : row.cabinetName;
  const draftOnRequest = isCustom || Boolean(row.onRequest);
  const draftCabinet = cabinet && canCabinet;
  const draftTotal = isCustom ? 0 : unitPrice(length, draftCabinet) * qty;

  const cabinetByNumber = useMemo(
    () => new Map(cabinets.map((c) => [c.productNumber, c])),
    [cabinets],
  );

  const lengthText = (value: number) => fmtLength(value, lang);
  const cabinetFits = (c: CabinetRow) =>
    c.fitsLengths.length > 0 ? t.order.fitsLadder(fitsRange(c.fitsLengths, lang)) : '';

  function info(item: CartItem): LineInfo {
    if (item.kind === 'cabinet') {
      const c = cabinetByNumber.get(item.cabinetNumber);
      return {
        name: `${t.order.cabinet} ${c?.model ?? item.cabinetNumber}`,
        meta: [t.order.withoutLadder, c ? cabinetFits(c) : '', c?.onRequest ? t.order.onRequest : '']
          .filter(Boolean)
          .join(' · '),
        total: c ? cabinetLineTotal(c, item.qty) : 0,
        onRequest: !c || Boolean(c.onRequest),
      };
    }

    if (!isStandard(item.length)) {
      const cab = item.cabinet ? cabinetRowForCustom(item.length) : null;
      return {
        name: t.order.customName(lengthText(item.length)),
        meta: [t.order.onRequest, cab ? `${t.order.cabinet} ${cab.cabinetName}` : '']
          .filter(Boolean)
          .join(' · '),
        total: 0,
        onRequest: true,
      };
    }

    const r = rowFor(item.length);
    return {
      name: r.productName,
      meta: [
        r.onRequest ? t.order.onRequest : `${t.order.productNo} ${r.productNumber}`,
        item.cabinet ? `${t.order.cabinet} ${r.cabinetName}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      total: unitPrice(item.length, item.cabinet) * item.qty,
      onRequest: Boolean(r.onRequest),
    };
  }

  const lines = cart.map((item) => ({ item, ...info(item) }));
  const grandTotal = lines.reduce((sum, line) => sum + line.total, 0);
  const ladderUnits = cart.reduce((sum, it) => sum + (it.kind === 'ladder' ? it.qty : 0), 0);
  const cabinetUnits = cart.reduce((sum, it) => sum + (it.kind === 'cabinet' ? it.qty : 0), 0);
  const totalUnits = ladderUnits + cabinetUnits;
  const allOnRequest = lines.length > 0 && lines.every((line) => line.onRequest);
  const someOnRequest = lines.some((line) => line.onRequest);

  const touched = () => {
    setSent(null);
    setError(null);
  };

  const toggleCustom = () => {
    if (!customOn && customLength === null) {
      // Start på halvmeteren rett under valgt standardlengde, ellers rett over.
      setCustomLength(
        halfLengths.find((v) => v === length - 0.5)
          ?? halfLengths.find((v) => v === length + 0.5)
          ?? halfLengths[0]
          ?? null,
      );
    }
    setCustomOn((v) => !v);
  };

  const addToOrder = () => {
    setCart((prev) => [...prev, { id: nextId++, kind: 'ladder', length: draftLength, qty, cabinet: draftCabinet }]);
    trackOrder('Order: Add to cart', draftTotal, {
      length: draftLength,
      cabinet: draftCabinet,
      qty,
      product: isCustom ? CUSTOM_PRODUCT_NUMBER : row.productNumber,
    });
    // reset draft to defaults
    setCabinet(false);
    setQty(1);
    touched();
  };

  /** Skap uten leider. Samme skap to ganger blir én linje med høyere antall. */
  const addCabinet = (c: CabinetRow) => {
    setCart((prev) =>
      prev.some((it) => it.kind === 'cabinet' && it.cabinetNumber === c.productNumber)
        ? prev.map((it) =>
            it.kind === 'cabinet' && it.cabinetNumber === c.productNumber
              ? { ...it, qty: Math.min(99, it.qty + 1) }
              : it,
          )
        : [...prev, { id: nextId++, kind: 'cabinet', cabinetNumber: c.productNumber, qty: 1 }],
    );
    trackOrder('Order: Add to cart', cabinetLineTotal(c, 1), {
      qty: 1,
      product: c.productNumber,
      cabinet_only: true,
    });
    touched();
  };

  const removeItem = (id: number) => setCart((prev) => prev.filter((it) => it.id !== id));
  const updateQty = (id: number, delta: number) =>
    setCart((prev) =>
      prev.map((it) => (it.id === id ? { ...it, qty: Math.min(99, Math.max(1, it.qty + delta)) } : it)),
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
          items: cart.map((it) =>
            it.kind === 'cabinet'
              ? { cabinetNumber: it.cabinetNumber, qty: it.qty }
              : { length: it.length, qty: it.qty, cabinet: it.cabinet },
          ),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t.order.errorSend);
      }

      trackOrder('Order: Submitted', grandTotal, { lines: cart.length, units: totalUnits });
      // Tøm bestillingen, så den ikke sendes en gang til sammen med neste.
      setSent(t.order.confirmRequest(t.order.unitCount(ladderUnits, cabinetUnits)));
      setCart([]);
      setCheckoutOpen(false);
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
          {isCustom
            ? `${lengthText(draftLength)} m · ${t.order.customLabel.toLowerCase()}`
            : row.onRequest ? `${length} m` : `${length} m · ${row.steps} ${t.order.steps}`}
        </div>
        <div className="config-viewer-hint">{t.order.rotateHint}</div>
      </div>

      {/* Options */}
      <div className="config-panel">
        <div className="lbl">{t.order.configureLabel}</div>
        <h2 className="stitle">{isCustom ? t.order.customName(lengthText(draftLength)) : row.productName}</h2>
        <p className="config-product-no">
          {draftOnRequest
            ? t.order.onRequest
            : `${t.order.productNo} ${row.productNumber} · ${row.steps} ${t.order.steps}`}
        </p>

        <div className="config-block">
          <div className="config-row">
            <label htmlFor="length">{t.order.length}</label>
            <span className="config-value">{lengthText(draftLength)} m</span>
          </div>
          <select
            id="length"
            className="config-select"
            value={length}
            disabled={isCustom}
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

          {/* Halvmetere ligger bak ett valg, så lista over standardlengder holdes kort. */}
          {halfLengths.length > 0 && (
            <div className="config-other">
              <button
                type="button"
                className={`config-extra${isCustom ? ' active' : ''}`}
                onClick={toggleCustom}
                aria-pressed={isCustom}
                aria-expanded={isCustom}
                aria-controls="custom-length"
              >
                <span className="config-extra-check" aria-hidden="true">
                  {isCustom ? '✓' : ''}
                </span>
                <span className="config-extra-label">{t.order.otherLength}</span>
                <span className="config-extra-price">{t.order.onRequestShort}</span>
              </button>
              {isCustom && (
                <div id="custom-length" className="config-other-panel">
                  <select
                    className="config-select"
                    aria-label={t.order.otherLengthPick}
                    value={customLength}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setCustomLength(next);
                      track('Order: Configure', { props: { length: next } });
                    }}
                  >
                    {halfLengths.map((v) => (
                      <option key={v} value={v}>{lengthText(v)} {t.order.meters}</option>
                    ))}
                  </select>
                  <p className="config-other-hint">{t.order.otherLengthHint}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {canCabinet && (
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
                {`${t.order.cabinet} ${cabinetName}`}
                {cabinet && <span className="config-extra-tag">{t.order.selected}</span>}
              </span>
              <span className="config-extra-price">
                {isCustom ? t.order.onRequestShort : `+${fmt(row.cabinetPrice)} kr`}
              </span>
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
              <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label={t.order.more}>+</button>
            </div>
          </div>
        </div>

        <button type="button" className="btn-primary config-add" onClick={addToOrder}>
          {draftOnRequest ? t.order.addToOrder : `${t.order.addToOrder} · ${fmt(draftTotal)} kr`}
        </button>

        {/* Skap uten leider. Skjult når skaplista mangler (reserveprislista). */}
        {cabinets.length > 0 && (
          <div className="config-solo">
            <div className="config-solo-head">
              <div>
                <strong>{t.order.cabinetOnlyTitle}</strong>
                <span>{t.order.cabinetOnlySub}</span>
              </div>
              <button
                type="button"
                className="config-solo-toggle"
                onClick={() => setCabinetsOpen((v) => !v)}
                aria-expanded={cabinetsOpen}
                aria-controls="solo-cabinets"
              >
                {cabinetsOpen ? t.order.cabinetOnlyHide : t.order.cabinetOnlyShow}
              </button>
            </div>
            {cabinetsOpen && (
              <ul id="solo-cabinets" className="config-solo-list">
                {cabinets.map((c) => (
                  <li key={c.productNumber}>
                    <div className="config-solo-info">
                      <strong>{t.order.cabinet} {c.model}</strong>
                      {cabinetFits(c) && <span>{cabinetFits(c)}</span>}
                    </div>
                    <span className="config-solo-price">
                      {c.onRequest ? t.order.onRequestShort : `${fmt(c.price)} kr`}
                    </span>
                    <button
                      type="button"
                      className="config-solo-add"
                      onClick={() => addCabinet(c)}
                      aria-label={`${t.order.add}: ${t.order.cabinet} ${c.model}`}
                    >
                      {t.order.add}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Order list */}
        {lines.length > 0 && (
          <div className="config-cart">
            <div className="config-cart-head">{t.order.yourOrder} ({lines.length})</div>
            {lines.map(({ item, name, meta, total, onRequest }) => (
              <div key={item.id} className="config-cart-item">
                <div className="config-cart-info">
                  <strong>{name}</strong>
                  <span className="config-cart-meta">{meta}</span>
                </div>
                <div className="config-cart-qty">
                  <button type="button" onClick={() => updateQty(item.id, -1)} aria-label={t.order.fewer}>−</button>
                  <span>{item.qty}</span>
                  <button type="button" onClick={() => updateQty(item.id, 1)} aria-label={t.order.more}>+</button>
                </div>
                <div className="config-cart-price">{onRequest ? '–' : `${fmt(total)} kr`}</div>
                <button type="button" className="config-cart-remove" onClick={() => removeItem(item.id)} aria-label={t.order.remove}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="config-total">
          <div>
            <span className="config-total-label">{t.order.total}</span>
            <span className="config-total-sub">
              {lines.length === 0 ? t.order.emptyHint : t.order.unitCount(ladderUnits, cabinetUnits)}
            </span>
          </div>
          <span className="config-total-amount">
            {allOnRequest ? t.order.onRequest : `${fmt(grandTotal)} kr`}
          </span>
        </div>

        {sent && <div className="config-confirm" role="status">{sent}</div>}

        {sent ? null : !checkoutOpen ? (
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

            <button type="submit" className="btn-primary config-submit" disabled={sending || cart.length === 0}>
              {sending
                ? t.order.sending
                : allOnRequest || cart.length === 0
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

        {someOnRequest && (
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
