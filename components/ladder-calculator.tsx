'use client';

import { useMemo, useState } from 'react';
import HeelDiagram from '@/components/heel-diagram';
import { useLang, useT } from '@/components/lang-provider';
import VesselSearch from '@/components/vessel-search';
import { trackOrder } from '@/lib/analytics';
import { isValidImo, normalizeImo } from '@/lib/imo';
import {
  APPROVED_VESSEL_LOA_LIMIT_M,
  DEFAULT_WATERLINE_MARGIN_M,
  HEEL_ANGLE_DEG,
  calculate,
  heelMargin,
  isOnRequestLength,
  lengthOptions,
} from '@/lib/ladder-rules';
import { cabinetAvailable, fmt, makePricing, type PriceTable } from '@/lib/pricing';
import type { VesselHit } from '@/lib/vessel-lookup';

type VesselType = 'fishing' | 'service' | 'cargo' | 'passenger' | 'other';

/** Tomt felt skal vise tom input, ikke 0 – derfor holdes målene som tekst. */
const toNumber = (value: string) => {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** Tall med inntil to desimaler og uten nuller til slutt: 4,68 – 1,2 – 5. */
const FORMAT = {
  no: (n: number) => String(Math.round(n * 100) / 100).replace('.', ','),
  en: (n: number) => String(Math.round(n * 100) / 100),
};

export default function LadderCalculator({ rows }: { rows: PriceTable }) {
  const lang = useLang();
  const t = useT();
  const c = t.calculator;
  const num = FORMAT[lang];

  const { rowFor, unitPrice } = useMemo(() => makePricing(rows), [rows]);
  const options = useMemo(() => lengthOptions(rows), [rows]);

  // Målene
  const [freeboard, setFreeboard] = useState('');
  const [mountHeight, setMountHeight] = useState('0');
  const [beam, setBeam] = useState('');
  const [marginManual, setMarginManual] = useState(false);
  const [manualMargin, setManualMargin] = useState(String(DEFAULT_WATERLINE_MARGIN_M));

  // Fartøyet
  const [vesselName, setVesselName] = useState('');
  const [imo, setImo] = useState('');
  const [vesselType, setVesselType] = useState<VesselType>('fishing');
  const [loa, setLoa] = useState('');
  /** Satt når feltene er fylt ut fra registeret. `width` sier om bredden fulgte med. */
  const [fetched, setFetched] = useState<{ width: boolean } | null>(null);

  // Valg
  const [override, setOverride] = useState<number | null>(null);
  const [cabinet, setCabinet] = useState(false);
  const [qty, setQty] = useState(1);

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<'order' | 'request' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const imoDigits = normalizeImo(imo);
  const imoComplete = imoDigits.length === 7;
  const imoOk = imoComplete && isValidImo(imo);
  const imoBad = imoComplete && !imoOk;

  /**
   * Et treff i fartøysøket fyller ut det registeret vet. Feltene registeret
   * mangler tømmes, så tall fra et tidligere valgt fartøy ikke blir stående.
   * Alt kan rettes for hånd etterpå.
   */
  function applyVessel(hit: VesselHit) {
    setVesselName(hit.name);
    setImo(hit.imo ?? '');
    setLoa(hit.length ? String(hit.length) : '');
    setBeam(hit.width ? String(hit.width) : '');
    // Registeret inneholder bare merkeregistrerte fiskefartøy.
    setVesselType('fishing');
    setFetched({ width: Boolean(hit.width) });
  }

  const beamValue = toNumber(beam);
  const hasBeam = beamValue > 0;

  const input = useMemo(
    () => ({
      freeboard: toNumber(freeboard),
      mountHeight: toNumber(mountHeight),
      beam: beamValue,
      margin: toNumber(manualMargin),
      marginManual,
    }),
    [freeboard, mountHeight, beamValue, manualMargin, marginManual],
  );

  const result = useMemo(() => calculate(input, rows), [input, rows]);
  const computedMargin = heelMargin(beamValue);

  const hasMeasurements = input.freeboard > 0;
  const recommended = result.recommended;
  const chosenLength = override ?? recommended?.length ?? null;
  // En halvmeter står ikke i prislista: ingen pris, ikke noe produktnummer.
  const chosenHalf = chosenLength !== null && isOnRequestLength(chosenLength, rows);
  const chosenRow = chosenLength !== null && !chosenHalf ? rowFor(chosenLength) : null;
  const onRequest = chosenHalf || Boolean(chosenRow?.onRequest);
  const isRecommended = recommended !== null && chosenLength === recommended.length;
  const belowRequired = chosenLength !== null && chosenLength < result.required;
  const loaExceedsApproval = toNumber(loa) >= APPROVED_VESSEL_LOA_LIMIT_M;

  const withCabinet = cabinet && (chosenHalf || (chosenRow !== null && cabinetAvailable(chosenRow)));
  const total = chosenRow && !onRequest ? unitPrice(chosenRow.length, withCabinet) * qty : 0;

  const chosenName =
    chosenLength === null ? '' : chosenHalf ? c.halfName(num(chosenLength)) : (chosenRow?.productName ?? '');
  const chosenMeta = chosenHalf
    ? c.halfMeta
    : chosenRow?.onRequest
      ? t.order.onRequest
      : chosenRow
        ? `${c.productNo} ${chosenRow.productNumber} · ${chosenRow.steps} ${c.steps}`
        : '';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (chosenLength === null) return;
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
          vessel: vesselName,
          imo,
          company_website: data.company_website, // honeypot
          notes: data.notes,
          lang,
          // Kun konfigurasjon sendes – serveren regner ut prisen selv. En
          // halvmeter (f.eks. 4,5) har ingen pris og går som forespørsel.
          items: [{ length: chosenLength, qty, cabinet: withCabinet }],
          // Tomme felt utelates (undefined faller ut av JSON), så ordren viser
          // «–» og ikke «0 m» for en bredde eller lengde som ikke er oppgitt.
          calculation: {
            freeboard: input.freeboard,
            mountHeight: input.mountHeight,
            beam: hasBeam ? beamValue : undefined,
            heelDeg: result.heelDeg,
            margin: result.margin,
            marginManual: result.marginManual,
            required: result.required,
            chosenLength,
            vesselType,
            loa: toNumber(loa) || undefined,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t.errors.generic);
      }
      trackOrder('Calculator: Order submitted', total, {
        length: chosenLength,
        required: result.required,
        qty,
        cabinet: withCabinet,
        onRequest,
      });
      setSent(onRequest ? 'request' : 'order');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="calc-grid">
      <div className="calc-col">
        {/* ── Fartøyet ── */}
        <div className="calc-panel calc-panel-vessel">
          <h2 className="calc-heading">{c.vesselHeading}</h2>

          <div className="calc-fields">
            <VesselSearch
              id="calc-search"
              className="calc-field-wide"
              label={c.searchLabel}
              placeholder={c.searchPlaceholder}
              hint={c.searchHint}
              variant="site"
              texts={c.search}
              locale={lang === 'no' ? 'nb-NO' : 'en-GB'}
              onSelect={applyVessel}
            />

            <p className="calc-fetched calc-field-wide" role="status">
              {fetched &&
                `${c.autofilled} ${c.registerName}. ${fetched.width ? '' : `${c.fetchedNoWidth} `}${c.fetchedCheck}`}
            </p>

            <div className="calc-field">
              <label htmlFor="calc-vessel">{c.vesselName}</label>
              <input
                id="calc-vessel"
                type="text"
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                placeholder={c.vesselNamePlaceholder}
              />
            </div>
            <div className="calc-field">
              <label htmlFor="calc-imo">{c.imo}</label>
              <input
                id="calc-imo"
                type="text"
                value={imo}
                onChange={(e) => setImo(e.target.value)}
                placeholder={c.imoPlaceholder}
                inputMode="numeric"
                aria-invalid={imoBad}
                aria-describedby="calc-imo-msg"
              />
              <p id="calc-imo-msg" className={`calc-help${imoBad ? ' calc-help-error' : imoOk ? ' calc-help-ok' : ''}`}>
                {imoBad ? c.imoInvalid : imoOk ? c.imoValid : ''}
              </p>
            </div>
            <div className="calc-field">
              <label htmlFor="calc-type">{c.vesselType}</label>
              <select id="calc-type" value={vesselType} onChange={(e) => setVesselType(e.target.value as VesselType)}>
                <option value="fishing">{t.certs.vessels.fishing}</option>
                <option value="service">{t.certs.vessels.service}</option>
                <option value="cargo">{t.certs.vessels.cargo}</option>
                <option value="passenger">{t.certs.vessels.passenger}</option>
                <option value="other">{c.vesselTypeOther}</option>
              </select>
            </div>
            <div className="calc-field">
              <label htmlFor="calc-loa">
                {c.loa} <span className="calc-unit">({c.metres})</span>
              </label>
              <input
                id="calc-loa"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={loa}
                onChange={(e) => setLoa(e.target.value)}
                aria-describedby="calc-loa-help"
              />
              <p id="calc-loa-help" className="calc-help">{c.loaHelp}</p>
            </div>
          </div>
        </div>

        {/* ── Målene ── */}
        <div className="calc-panel calc-panel-measure">
          <h2 className="calc-heading">{c.measureHeading}</h2>

          <div className="calc-fields">
            <div className="calc-field calc-field-wide">
              <label htmlFor="calc-freeboard">
                {c.freeboard} <span className="calc-unit">(F, {c.metres})</span>
              </label>
              <input
                id="calc-freeboard"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={freeboard}
                onChange={(e) => setFreeboard(e.target.value)}
                aria-describedby="calc-freeboard-help"
              />
              <p id="calc-freeboard-help" className="calc-help">{c.freeboardHelp}</p>
            </div>

            <div className="calc-field calc-field-wide">
              <label htmlFor="calc-mount">
                {c.mountHeight} <span className="calc-unit">(h, {c.metres})</span>
              </label>
              <input
                id="calc-mount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={mountHeight}
                onChange={(e) => setMountHeight(e.target.value)}
                aria-describedby="calc-mount-help"
              />
              <p id="calc-mount-help" className="calc-help">{c.mountHeightHelp}</p>
            </div>

            <div className="calc-field calc-field-wide">
              <label htmlFor="calc-beam">
                {c.beam} <span className="calc-unit">(B, {c.metres})</span>
              </label>
              <input
                id="calc-beam"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={beam}
                onChange={(e) => setBeam(e.target.value)}
                aria-describedby="calc-beam-help"
              />
              <p id="calc-beam-help" className="calc-help">{c.beamHelp}</p>
            </div>
          </div>

          {/* Tillegget under vannlinjen: utregnet fra bredden, eller satt for hånd */}
          <div className="calc-margin">
            <div className="calc-margin-head">
              <span className="calc-margin-label">{c.margin}</span>
              <span className="calc-margin-value">
                {num(result.margin)} {c.metres}
              </span>
            </div>

            {hasBeam && !marginManual && (
              <p className="calc-margin-formula">{c.marginFormula(num(beamValue), HEEL_ANGLE_DEG, num(computedMargin))}</p>
            )}
            {!hasBeam && <p className="calc-help">{c.marginNoBeam(HEEL_ANGLE_DEG)}</p>}

            {hasBeam && (
              <label className="calc-check">
                <input type="checkbox" checked={marginManual} onChange={(e) => setMarginManual(e.target.checked)} />
                <span>{c.marginOverride}</span>
              </label>
            )}

            {result.marginManual && (
              <div className="calc-field">
                <label htmlFor="calc-margin">
                  {c.marginManual} <span className="calc-unit">({c.metres})</span>
                </label>
                <input
                  id="calc-margin"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={manualMargin}
                  onChange={(e) => setManualMargin(e.target.value)}
                  aria-describedby={hasBeam ? 'calc-margin-help' : undefined}
                />
                {hasBeam && (
                  <p id="calc-margin-help" className="calc-help">
                    {`${c.marginManualHelp} ${c.marginComputed(num(computedMargin))}`}
                  </p>
                )}
              </div>
            )}

            <p className="calc-help">{c.marginHelp(HEEL_ANGLE_DEG)}</p>
          </div>

          <p className="calc-disclaimer">{c.disclaimer}</p>
        </div>
      </div>

      <div className="calc-col">
        {/* ── Tegningen ── */}
        <div className="calc-panel calc-panel-figure">
          <h2 className="calc-heading">{c.diagram.heading}</h2>
          <p className="calc-figure-intro">{c.diagram.intro(HEEL_ANGLE_DEG)}</p>
          <HeelDiagram
            freeboard={input.freeboard}
            mountHeight={input.mountHeight}
            beam={beamValue}
            manualMargin={result.marginManual ? result.margin : null}
            texts={c.diagram}
            format={num}
          />
        </div>

        {/* ── Resultat + bestilling ── */}
        <div className="calc-panel calc-panel-result">
          <h2 className="calc-heading">{c.resultHeading}</h2>

          {!hasMeasurements ? (
            <p className="calc-empty">{c.emptyState}</p>
          ) : (
            <>
              <div className="calc-required">
                <span className="calc-required-label">{c.requiredLength}</span>
                <span className="calc-required-value">
                  {num(result.required)} {c.metres}
                </span>
              </div>

              <dl className="calc-breakdown">
                <div>
                  <dt>{c.breakdownFreeboard}</dt>
                  <dd>
                    {num(input.freeboard)} {c.metres}
                  </dd>
                </div>
                <div>
                  <dt>{c.breakdownMount}</dt>
                  <dd>
                    + {num(input.mountHeight)} {c.metres}
                  </dd>
                </div>
                <div>
                  <dt>
                    {c.breakdownMargin}
                    <span className="calc-breakdown-sub">
                      {!hasBeam
                        ? c.breakdownNoBeam
                        : result.marginManual
                          ? c.breakdownManual
                          : c.marginFormula(num(beamValue), result.heelDeg, num(result.margin))}
                    </span>
                  </dt>
                  <dd>
                    + {num(result.margin)} {c.metres}
                  </dd>
                </div>
              </dl>

              {result.tooLong ? (
                <div className="calc-notice calc-notice-warn">
                  <strong>{c.tooLongTitle}</strong>
                  <p>{c.tooLongBody}</p>
                  <a href="tel:+4790407341" className="btn-primary calc-contact">
                    {t.product.call}
                  </a>
                </div>
              ) : (
                chosenLength !== null && (
                  <>
                    <div className="calc-pick">
                      <span className="calc-pick-label">{isRecommended ? c.recommended : c.chosen}</span>
                      <strong className="calc-pick-name">{chosenName}</strong>
                      <span className="calc-pick-meta">{chosenMeta}</span>
                      {!belowRequired && (
                        <span className="calc-pick-slack">{c.slack(num(chosenLength - result.required))}</span>
                      )}
                    </div>

                    {result.atMinimum && override === null && <p className="calc-note">{c.atMinimumNote}</p>}
                    {belowRequired && <p className="calc-note calc-note-warn">{c.belowRequiredNote}</p>}
                    {loaExceedsApproval && <p className="calc-note">{c.loaNote}</p>}

                    {/* Halvmeteren som også dekker behovet, på forespørsel */}
                    {result.halfStep !== null && recommended && chosenLength !== result.halfStep && (
                      <div className="calc-alt">
                        <div>
                          <strong>{c.halfOfferTitle(num(result.halfStep))}</strong>
                          <p>{c.halfOffer(num(result.halfStep), num(recommended.length))}</p>
                        </div>
                        <button type="button" className="calc-alt-btn" onClick={() => setOverride(result.halfStep)}>
                          {c.halfChoose(num(result.halfStep))}
                        </button>
                      </div>
                    )}
                    {!isRecommended && recommended && (
                      <button type="button" className="calc-link" onClick={() => setOverride(null)}>
                        {c.useRecommended(num(recommended.length))}
                      </button>
                    )}

                    <div className="calc-field calc-field-block">
                      <label htmlFor="calc-length">{c.chooseLength}</label>
                      <select
                        id="calc-length"
                        value={chosenLength}
                        onChange={(e) => setOverride(Number(e.target.value))}
                        aria-describedby="calc-length-help"
                      >
                        {options.map((option) => (
                          <option key={option.length} value={option.length}>
                            {num(option.length)} {t.order.meters}
                            {option.half || rowFor(option.length).onRequest ? ` (${c.onRequestTag})` : ''}
                          </option>
                        ))}
                      </select>
                      <p id="calc-length-help" className="calc-help">{c.chooseLengthHelp}</p>
                    </div>

                    {chosenRow && cabinetAvailable(chosenRow) && (
                      <button
                        type="button"
                        className={`config-extra${cabinet ? ' active' : ''}`}
                        onClick={() => setCabinet((v) => !v)}
                        aria-pressed={cabinet}
                      >
                        <span className="config-extra-check" aria-hidden="true">{cabinet ? '✓' : ''}</span>
                        <span className="config-extra-label">{`${c.cabinet} ${chosenRow.cabinetName}`}</span>
                        <span className="config-extra-price">+{fmt(chosenRow.cabinetPrice)} kr</span>
                      </button>
                    )}
                    {chosenHalf && (
                      <button
                        type="button"
                        className={`config-extra${cabinet ? ' active' : ''}`}
                        onClick={() => setCabinet((v) => !v)}
                        aria-pressed={cabinet}
                      >
                        <span className="config-extra-check" aria-hidden="true">{cabinet ? '✓' : ''}</span>
                        <span className="config-extra-label">{c.cabinetWish}</span>
                        <span className="config-extra-price">{c.cabinetOnRequest}</span>
                      </button>
                    )}

                    <div className="calc-qty-row">
                      <div>
                        <span className="calc-qty-label" id="calc-qty-label">{c.quantity}</span>
                        <p className="calc-help">{c.quantityHelp}</p>
                      </div>
                      <div className="config-qty" role="group" aria-labelledby="calc-qty-label">
                        <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t.order.fewer}>−</button>
                        <span aria-live="polite">{qty}</span>
                        <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label={t.order.more}>+</button>
                      </div>
                    </div>

                    <div className="config-total">
                      <div>
                        <span className="config-total-label">{c.total}</span>
                        <span className="config-total-sub">
                          {qty} × {chosenName}
                        </span>
                      </div>
                      <span className={`config-total-amount${onRequest ? ' calc-total-request' : ''}`}>
                        {onRequest ? t.order.onRequest : `${fmt(total)} kr`}
                      </span>
                    </div>

                    {sent ? (
                      <div className="config-confirm">{sent === 'request' ? c.confirmRequest : c.confirm}</div>
                    ) : (
                      <form className="calc-order" onSubmit={handleSubmit}>
                        <h3>{onRequest ? c.requestHeading : c.orderHeading}</h3>
                        <p className="calc-order-sub">{c.orderSub}</p>

                        <div className="calc-fields">
                          <div className="calc-field">
                            <label htmlFor="calc-name">{t.order.fields.name}</label>
                            <input id="calc-name" name="name" type="text" placeholder={t.order.fields.namePlaceholder} required autoComplete="name" />
                          </div>
                          <div className="calc-field">
                            <label htmlFor="calc-email">{t.order.fields.email}</label>
                            <input id="calc-email" name="email" type="email" placeholder={t.order.fields.emailPlaceholder} required autoComplete="email" />
                          </div>
                          <div className="calc-field">
                            <label htmlFor="calc-phone">{t.order.fields.phone}</label>
                            <input id="calc-phone" name="phone" type="tel" placeholder={t.order.fields.phonePlaceholder} autoComplete="tel" />
                          </div>
                          <div className="calc-field calc-field-wide">
                            <label htmlFor="calc-notes">{t.order.fields.notes}</label>
                            <textarea id="calc-notes" name="notes" placeholder={t.order.fields.notesPlaceholder} />
                          </div>
                        </div>

                        <input
                          type="text"
                          name="company_website"
                          tabIndex={-1}
                          autoComplete="off"
                          aria-hidden="true"
                          className="hp-field"
                        />

                        {error && <p className="config-error" role="alert">{error}</p>}

                        <button type="submit" className="btn-primary config-submit" disabled={loading}>
                          {loading ? c.sending : onRequest ? t.order.sendRequest : c.submit}
                        </button>
                        <p className="config-note">{onRequest ? c.requestNote : c.priceNote}</p>
                      </form>
                    )}
                  </>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
