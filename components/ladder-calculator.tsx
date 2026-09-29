'use client';

import { useEffect, useMemo, useState } from 'react';
import { isValidImo, normalizeImo } from '@/lib/imo';
import { useLang, useT } from '@/components/lang-provider';
import { EVENTS, track } from '@/lib/analytics';
import {
  APPROVED_VESSEL_LOA_LIMIT_M,
  DEFAULT_WATERLINE_MARGIN_M,
  calculate,
} from '@/lib/ladder-rules';
import { LENGTHS, fmt, rowFor, unitPrice } from '@/lib/pricing';

type VesselType = 'fishing' | 'service' | 'cargo' | 'passenger' | 'other';

/** Tomt felt skal vise tom input, ikke 0 – derfor holdes målene som tekst. */
const toNumber = (value: string) => {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const metres = (n: number) => n.toFixed(2).replace(/\.00$/, '').replace('.', ',');

export default function LadderCalculator() {
  const lang = useLang();
  const t = useT();

  // Målene
  const [freeboard, setFreeboard] = useState('');
  const [mountHeight, setMountHeight] = useState('0');
  const [margin, setMargin] = useState(String(DEFAULT_WATERLINE_MARGIN_M));

  // Fartøyet
  const [vesselName, setVesselName] = useState('');
  const [imo, setImo] = useState('');
  const [vesselType, setVesselType] = useState<VesselType>('fishing');
  const [loa, setLoa] = useState('');
  const [autofillSource, setAutofillSource] = useState<string | null>(null);

  // Valg
  const [override, setOverride] = useState<number | null>(null);
  const [cabinet, setCabinet] = useState(false);
  const [qty, setQty] = useState(1);

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imoDigits = normalizeImo(imo);
  const imoComplete = imoDigits.length === 7;
  const imoOk = imoComplete && isValidImo(imo);
  const imoBad = imoComplete && !imoOk;

  // Hent fartøyopplysninger når IMO-nummeret er gyldig. Bare tomme felt fylles
  // ut, så vi aldri overskriver det brukeren allerede har skrevet.
  useEffect(() => {
    if (!imoOk) {
      setAutofillSource(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/vessel?imo=${imoDigits}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled || res.status !== 'found') return;
        const v = res.vessel;
        if (v.name) setVesselName((cur) => cur || v.name);
        if (v.loa) setLoa((cur) => cur || String(v.loa));
        if (v.type) setVesselType(v.type);
        setAutofillSource(v.source);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imoOk, imoDigits]);

  const input = useMemo(
    () => ({
      freeboard: toNumber(freeboard),
      mountHeight: toNumber(mountHeight),
      margin: toNumber(margin),
    }),
    [freeboard, mountHeight, margin],
  );

  const result = useMemo(() => calculate(input), [input]);

  const hasMeasurements = freeboard.trim() !== '' && input.freeboard > 0;
  const chosen = override !== null ? rowFor(override) : result.recommended;
  const belowRequired = Boolean(chosen && chosen.length < result.required);
  const loaExceedsApproval = toNumber(loa) >= APPROVED_VESSEL_LOA_LIMIT_M;

  const total = chosen ? unitPrice(chosen, cabinet) * qty : 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!chosen) return;
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
          company: vesselName,
          imo,
          notes: data.notes,
          items: [{ length: chosen.length, qty, cabinet: cabinet && !chosen.onRequest }],
          calculation: {
            freeboard: input.freeboard,
            mountHeight: input.mountHeight,
            margin: input.margin,
            required: result.required,
            chosenLength: chosen.length,
            vesselType,
            loa: toNumber(loa),
          },
          lang,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t.errors.generic);
      }
      track(EVENTS.calculatorOrder, {
        lang,
        length: chosen.length,
        required: result.required,
        qty,
        cabinet,
        value: total,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="calc-grid">
      {/* ── Inndata ── */}
      <div className="calc-panel">
        <h2 className="calc-heading">{t.calculator.vesselHeading}</h2>

        <div className="calc-fields">
          <div className="calc-field">
            <label htmlFor="calc-vessel">{t.calculator.vesselName}</label>
            <input
              id="calc-vessel"
              type="text"
              value={vesselName}
              onChange={(e) => setVesselName(e.target.value)}
              placeholder={t.calculator.vesselNamePlaceholder}
            />
          </div>
          <div className="calc-field">
            <label htmlFor="calc-imo">{t.calculator.imo}</label>
            <input
              id="calc-imo"
              type="text"
              value={imo}
              onChange={(e) => setImo(e.target.value)}
              placeholder={t.calculator.imoPlaceholder}
              inputMode="numeric"
              aria-invalid={imoBad}
              aria-describedby="calc-imo-msg"
            />
            <p
              id="calc-imo-msg"
              className={`calc-help${imoBad ? ' calc-help-error' : imoOk ? ' calc-help-ok' : ''}`}
            >
              {imoBad
                ? t.calculator.imoInvalid
                : imoOk
                  ? autofillSource
                    ? `${t.calculator.autofilled} ${autofillSource}`
                    : t.calculator.imoValid
                  : ''}
            </p>
          </div>
          <div className="calc-field">
            <label htmlFor="calc-type">{t.calculator.vesselType}</label>
            <select
              id="calc-type"
              value={vesselType}
              onChange={(e) => setVesselType(e.target.value as VesselType)}
            >
              <option value="fishing">{t.certs.vessels.fishing}</option>
              <option value="service">{t.certs.vessels.service}</option>
              <option value="cargo">{t.certs.vessels.cargo}</option>
              <option value="passenger">{t.certs.vessels.passenger}</option>
              <option value="other">{t.calculator.vesselTypeOther}</option>
            </select>
          </div>
          <div className="calc-field">
            <label htmlFor="calc-loa">
              {t.calculator.loa} <span className="calc-unit">({t.calculator.metres})</span>
            </label>
            <input
              id="calc-loa"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={loa}
              onChange={(e) => setLoa(e.target.value)}
            />
            <p className="calc-help">{t.calculator.loaHelp}</p>
          </div>
        </div>

        <h2 className="calc-heading calc-heading-spaced">{t.calculator.measureHeading}</h2>

        <div className="calc-fields">
          <div className="calc-field calc-field-wide">
            <label htmlFor="calc-freeboard">
              {t.calculator.freeboard} <span className="calc-unit">({t.calculator.metres})</span>
            </label>
            <input
              id="calc-freeboard"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={freeboard}
              onChange={(e) => setFreeboard(e.target.value)}
              autoFocus
            />
            <p className="calc-help">{t.calculator.freeboardHelp}</p>
          </div>

          <div className="calc-field calc-field-wide">
            <label htmlFor="calc-mount">
              {t.calculator.mountHeight} <span className="calc-unit">({t.calculator.metres})</span>
            </label>
            <input
              id="calc-mount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={mountHeight}
              onChange={(e) => setMountHeight(e.target.value)}
            />
            <p className="calc-help">{t.calculator.mountHeightHelp}</p>
          </div>

          <div className="calc-field calc-field-wide">
            <label htmlFor="calc-margin">
              {t.calculator.margin} <span className="calc-unit">({t.calculator.metres})</span>
            </label>
            <input
              id="calc-margin"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
            />
            <p className="calc-help">{t.calculator.marginHelp}</p>
          </div>
        </div>

        <p className="calc-disclaimer">{t.calculator.disclaimer}</p>
      </div>

      {/* ── Resultat + bestilling ── */}
      <div className="calc-panel calc-panel-result">
        <h2 className="calc-heading">{t.calculator.resultHeading}</h2>

        {!hasMeasurements ? (
          <p className="calc-empty">{t.calculator.emptyState}</p>
        ) : (
          <>
            <div className="calc-required">
              <span className="calc-required-label">{t.calculator.requiredLength}</span>
              <span className="calc-required-value">
                {metres(result.required)} {t.calculator.metres}
              </span>
            </div>

            <dl className="calc-breakdown">
              <div>
                <dt>{t.calculator.breakdownFreeboard}</dt>
                <dd>{metres(input.freeboard)} {t.calculator.metres}</dd>
              </div>
              <div>
                <dt>{t.calculator.breakdownMount}</dt>
                <dd>+ {metres(input.mountHeight)} {t.calculator.metres}</dd>
              </div>
              <div>
                <dt>{t.calculator.breakdownMargin}</dt>
                <dd>+ {metres(input.margin)} {t.calculator.metres}</dd>
              </div>
            </dl>

            {result.tooLong ? (
              <div className="calc-notice calc-notice-warn">
                <strong>{t.calculator.tooLongTitle}</strong>
                <p>{t.calculator.tooLongBody}</p>
                <a href="tel:+4790407341" className="btn-primary calc-contact">
                  {t.product.call}
                </a>
              </div>
            ) : (
              chosen && (
                <>
                  <div className="calc-pick">
                    <span className="calc-pick-label">{t.calculator.recommended}</span>
                    <strong className="calc-pick-name">{chosen.productName}</strong>
                    <span className="calc-pick-meta">
                      {chosen.onRequest
                        ? t.order.onRequest
                        : `${t.calculator.productNo} ${chosen.productNumber} · ${chosen.steps} ${t.calculator.steps}`}
                    </span>
                    {!belowRequired && (
                      <span className="calc-pick-slack">
                        {t.calculator.slack(metres(chosen.length - result.required))}
                      </span>
                    )}
                  </div>

                  {result.atMinimum && override === null && (
                    <p className="calc-note">{t.calculator.atMinimumNote}</p>
                  )}
                  {belowRequired && (
                    <p className="calc-note calc-note-warn">{t.calculator.belowRequiredNote}</p>
                  )}
                  {loaExceedsApproval && <p className="calc-note">{t.calculator.loaNote}</p>}

                  <div className="calc-field calc-field-block">
                    <label htmlFor="calc-length">{t.calculator.chooseLength}</label>
                    <select
                      id="calc-length"
                      value={chosen.length}
                      onChange={(e) => setOverride(Number(e.target.value))}
                    >
                      {LENGTHS.map((v) => (
                        <option key={v} value={v}>
                          {v} {t.order.meters}
                        </option>
                      ))}
                    </select>
                    <p className="calc-help">{t.calculator.chooseLengthHelp}</p>
                  </div>

                  {!chosen.onRequest && (
                  <button
                    type="button"
                    className={`config-extra${cabinet ? ' active' : ''}`}
                    onClick={() => setCabinet((v) => !v)}
                    aria-pressed={cabinet}
                  >
                    <span className="config-extra-check" aria-hidden="true">{cabinet ? '✓' : ''}</span>
                    <span className="config-extra-label">
                      {`${t.calculator.cabinet} ${chosen.cabinetName}`}
                    </span>
                    <span className="config-extra-price">+{fmt(chosen.cabinetPrice)} kr</span>
                  </button>
                  )}

                  <div className="calc-qty-row">
                    <div>
                      <label htmlFor="calc-qty">{t.calculator.quantity}</label>
                      <p className="calc-help">{t.calculator.quantityHelp}</p>
                    </div>
                    <div className="config-qty">
                      <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t.order.fewer}>−</button>
                      <span>{qty}</span>
                      <button type="button" onClick={() => setQty((q) => q + 1)} aria-label={t.order.more}>+</button>
                    </div>
                  </div>

                  <div className="config-total">
                    <div>
                      <span className="config-total-label">{t.calculator.total}</span>
                      <span className="config-total-sub">
                        {qty} × {chosen.productName}
                      </span>
                    </div>
                    <span className="config-total-amount">
                      {chosen.onRequest ? t.order.onRequest : `${fmt(total)} kr`}
                    </span>
                  </div>

                  {sent ? (
                    <div className="config-confirm">{t.calculator.confirm}</div>
                  ) : (
                    <form className="calc-order" onSubmit={handleSubmit}>
                      <h3>{t.calculator.orderHeading}</h3>
                      <p className="calc-order-sub">{t.calculator.orderSub}</p>

                      <div className="calc-fields">
                        <div className="calc-field">
                          <label htmlFor="calc-name">{t.order.fields.name}</label>
                          <input id="calc-name" name="name" type="text" placeholder={t.order.fields.namePlaceholder} required />
                        </div>
                        <div className="calc-field">
                          <label htmlFor="calc-email">{t.order.fields.email}</label>
                          <input id="calc-email" name="email" type="email" placeholder={t.order.fields.emailPlaceholder} required />
                        </div>
                        <div className="calc-field">
                          <label htmlFor="calc-phone">{t.order.fields.phone}</label>
                          <input id="calc-phone" name="phone" type="tel" placeholder={t.order.fields.phonePlaceholder} />
                        </div>
                        <div className="calc-field calc-field-wide">
                          <label htmlFor="calc-notes">{t.order.fields.notes}</label>
                          <textarea id="calc-notes" name="notes" placeholder={t.order.fields.notesPlaceholder} />
                        </div>
                      </div>

                      {error && <p className="config-error">{error}</p>}

                      <button type="submit" className="btn-primary config-submit" disabled={loading}>
                        {loading ? t.calculator.sending : t.calculator.submit}
                      </button>
                      <p className="config-note">{t.calculator.priceNote}</p>
                    </form>
                  )}
                </>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
