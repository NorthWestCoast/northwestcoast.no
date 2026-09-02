'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ATTACHMENT_ALLOWANCE_M,
  TIDE_PRESETS,
  calculate,
  metres,
  type TideId,
} from '@/lib/ladder-calc';
import { MAX_LENGTH, fmt } from '@/lib/products';

/**
 * The interactive Leiderkalkulator.
 *
 * Design decisions worth knowing:
 *
 * 1. No submit button and no server round-trip. The result recomputes on every
 *    input change, so the page is useful within a second of landing on it. Tools
 *    that gate the answer behind a form get abandoned, and an abandoned tool
 *    earns no links and no repeat visits.
 *
 * 2. The full arithmetic is always visible. The user can see exactly which
 *    allowance produced the recommendation and argue with it — that is what
 *    makes the page trustworthy enough to be linked to, and quotable enough for
 *    an answer engine to cite rather than paraphrase.
 *
 * 3. The result deep-links into /bestill with the length preselected, so the
 *    tool converts instead of just informing.
 */

/** Slider + numeric entry for one measurement, in metres. */
function MeasureField({
  id, label, hint, value, min, max, step, onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  /*
   * The text box keeps its own draft string so intermediate states ("3,", "")
   * survive keystrokes, while the slider and the result always read the
   * committed numeric value. The draft resyncs whenever the value changes from
   * elsewhere — dragging the slider, for instance.
   */
  const [draft, setDraft] = useState(metres(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (Number(draft.replace(',', '.')) !== value) setDraft(metres(value));
  }

  return (
    <div className="calc-field">
      <div className="calc-field-head">
        <label htmlFor={id}>{label}</label>
        <div className="calc-field-value">
          <input
            id={`${id}-num`}
            // type="text" rather than "number": a number input only accepts a
            // decimal *point*, while a Norwegian user types "3,5". The text
            // input keeps the numeric keypad on mobile via inputMode and accepts
            // either separator.
            type="text"
            inputMode="decimal"
            value={draft}
            aria-label={`${label} i meter`}
            onChange={(e) => {
              const raw = e.target.value;
              setDraft(raw);
              const n = Number(raw.replace(',', '.'));
              // Only commit valid numbers; a half-typed "3," must not reset the
              // field to 0 while the user is still typing.
              if (raw.trim() !== '' && Number.isFinite(n)) {
                onChange(Math.min(max, Math.max(min, n)));
              }
            }}
            onBlur={() => setDraft(metres(value))}
          />
          <span>m</span>
        </div>
      </div>
      <input
        id={id}
        type="range"
        className="calc-range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className="calc-field-hint" id={`${id}-hint`}>{hint}</p>
    </div>
  );
}

export default function LadderCalculator() {
  const [fixingHeight, setFixingHeight] = useState(3.5);
  const [lightCondition, setLightCondition] = useState(0.5);
  const [seaState, setSeaState] = useState(0.5);
  const [region, setRegion] = useState<TideId>('midt');
  const [customTide, setCustomTide] = useState(1.0);
  const [customTideDraft, setCustomTideDraft] = useState('1,0');
  const [copied, setCopied] = useState(false);

  const tide = region === 'custom'
    ? customTide
    : TIDE_PRESETS.find((p) => p.id === region)!.tide;

  const result = useMemo(
    () => calculate({ fixingHeight, lightCondition, tide, seaState }),
    [fixingHeight, lightCondition, tide, seaState],
  );

  const { recommended, required, overMax, surplus, terms } = result;

  const summary = [
    'Leiderkalkulator – NorthWest Coast',
    ...terms.map((t) => `${t.label}: ${metres(t.value)} m`),
    `Beregnet minimumslengde: ${metres(required)} m`,
    recommended
      ? `Anbefalt modell: ${recommended.productName} (${recommended.length} m, ${recommended.steps} trinn, produktnr. ${recommended.productNumber})`
      : `Over ${MAX_LENGTH} m – krever spesialtilpasning.`,
    'Beregningen er veiledende. Kontroller alltid mot gjeldende krav for ditt fartøy.',
  ].join('\n');

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard is blocked in some in-app browsers; the summary stays on screen.
    }
  }

  return (
    <div className="calc-grid">
      {/* ── Inputs ── */}
      <div className="calc-panel">
        <div className="lbl">Målene dine</div>
        <h2 className="stitle">Fyll inn fartøyets mål</h2>
        <p className="calc-panel-sub">
          Alle mål i meter. Resultatet oppdateres mens du skriver – ingenting sendes noe sted.
        </p>

        <MeasureField
          id="calc-fixing"
          label="Høyde fra vannlinje til innfesting"
          hint="Mål fra vannflaten opp til punktet der leideren festes – rekke, dekksøye eller leiderkasse."
          value={fixingHeight}
          min={0.5}
          max={20}
          step={0.1}
          onChange={setFixingHeight}
        />

        <MeasureField
          id="calc-light"
          label="Ekstra fribord ved letteste kondisjon"
          hint="Hvor mye høyere fartøyet ligger når det går tomt eller i ballast. Sett 0 hvis fribordet er tilnærmet konstant."
          value={lightCondition}
          min={0}
          max={4}
          step={0.1}
          onChange={setLightCondition}
        />

        <div className="calc-field">
          <div className="calc-field-head">
            <label htmlFor="calc-region">Fartsområde (tidevann)</label>
            <div className="calc-field-value calc-field-value-static">
              <span>{metres(tide)}</span>
              <span>m</span>
            </div>
          </div>
          <select
            id="calc-region"
            className="config-select"
            value={region}
            onChange={(e) => setRegion(e.target.value as TideId)}
          >
            {TIDE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.id !== 'custom' ? ` – ca. ${metres(p.tide)} m` : ''}
              </option>
            ))}
          </select>
          {region === 'custom' && (
            <input
              type="text"
              inputMode="decimal"
              className="calc-custom-tide"
              value={customTideDraft}
              aria-label="Tidevannsforskjell i meter"
              placeholder="f.eks. 1,4"
              onChange={(e) => {
                setCustomTideDraft(e.target.value);
                const n = Number(e.target.value.replace(',', '.'));
                if (Number.isFinite(n)) setCustomTide(Math.min(5, Math.max(0, n)));
              }}
            />
          )}
          <p className="calc-field-hint">
            Typiske verdier for dimensjonering. Eksakt tidevann for din havn finner du hos
            Kartverket på{' '}
            <a href="https://www.kartverket.no/til-sjos/se-havniva" target="_blank" rel="noopener noreferrer">
              sehavniva.no
            </a>.
          </p>
        </div>

        <MeasureField
          id="calc-sea"
          label="Margin for sjøgang og bevegelse"
          hint="Legg til høyere margin for åpent farvann og eksponerte havner enn for skjermet kai."
          value={seaState}
          min={0}
          max={3}
          step={0.1}
          onChange={setSeaState}
        />

        <p className="calc-fixed-note">
          I tillegg legges det automatisk til{' '}
          <strong>{metres(ATTACHMENT_ALLOWANCE_M)} m festetillegg</strong> for lengden som går
          med til å sikre leideren i toppen.
        </p>
      </div>

      {/* ── Result ── */}
      <div className="calc-result" aria-live="polite">
        <div className="lbl">Resultat</div>

        <div className="calc-headline">
          <span className="calc-headline-num">{metres(required)}</span>
          <span className="calc-headline-unit">meter</span>
        </div>
        <p className="calc-headline-sub">beregnet minimumslengde på leideren</p>

        <ol className="calc-breakdown">
          {terms.map((t) => (
            <li key={t.label}>
              <span className="calc-breakdown-label">
                {t.label}
                <em>{t.hint}</em>
              </span>
              <span className="calc-breakdown-value">+ {metres(t.value)} m</span>
            </li>
          ))}
          <li className="calc-breakdown-sum">
            <span className="calc-breakdown-label">Sum – minimumslengde</span>
            <span className="calc-breakdown-value">{metres(required)} m</span>
          </li>
        </ol>

        {recommended && !overMax ? (
          <div className="calc-reco">
            <div className="calc-reco-head">
              <span className="calc-reco-tag">Anbefalt modell</span>
              <h3>{recommended.productName}</h3>
              <p className="calc-reco-meta">
                {recommended.length} meter · {recommended.steps} trinn · produktnr.{' '}
                {recommended.productNumber}
              </p>
            </div>

            <dl className="calc-reco-specs">
              <div>
                <dt>Standardlengde</dt>
                <dd>{recommended.length} m</dd>
              </div>
              <div>
                <dt>Overskytende lengde</dt>
                <dd>{metres(surplus)} m</dd>
              </div>
              <div>
                <dt>Oppbevaringsskap</dt>
                <dd>{recommended.cabinetName}</dd>
              </div>
              <div>
                <dt>Veiledende pris</dt>
                <dd>{fmt(recommended.price)} kr</dd>
              </div>
            </dl>

            <div className="calc-actions">
              <Link href={`/bestill?lengde=${recommended.length}`} className="btn-primary">
                Bestill {recommended.length} m →
              </Link>
              <button type="button" className="btn-ghost calc-copy" onClick={copySummary}>
                {copied ? '✓ Kopiert' : 'Kopier beregningen'}
              </button>
            </div>
          </div>
        ) : (
          <div className="calc-reco calc-reco-over">
            <div className="calc-reco-head">
              <span className="calc-reco-tag">Utenfor standardsortimentet</span>
              <h3>Over {MAX_LENGTH} meter</h3>
              <p className="calc-reco-meta">
                Beregningen gir {metres(required)} m, som er lengre enn den lengste
                standardleideren. Vi skreddersyr leidere utover standardlengdene – ta kontakt med
                målene dine, så setter vi sammen en løsning.
              </p>
            </div>
            <div className="calc-actions">
              <Link href="/#kontakt" className="btn-primary">Be om tilbud →</Link>
              <a href="tel:+4790407341" className="btn-ghost">Ring +47 904 07 341</a>
            </div>
          </div>
        )}

        <p className="calc-disclaimer">
          <strong>Veiledende beregning.</strong> Verktøyet dimensjonerer ut fra målene du oppgir og
          erstatter ikke en vurdering av hvilke krav som gjelder for ditt fartøy. Krav til leidertype,
          utforming og sertifisering følger av fartøyets størrelse, fartsområde og gjeldende
          forskrift – kontroller alltid mot Sjøfartsdirektoratet eller ta kontakt med oss.
        </p>
      </div>
    </div>
  );
}
