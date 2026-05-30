'use client';

import { useMemo, useState } from 'react';
import Script from 'next/script';

const MIN = 2;
const MAX = 15;
const PRICE_PER_M = 2450; // NOK per meter, veiledende

const LENGTHS = Array.from({ length: MAX - MIN + 1 }, (_, i) => MIN + i); // 2..15

const ACCESSORIES = [
  { id: 'cabinet', label: 'Oppbevaringsskap', price: 4900 },
  { id: 'pvc', label: 'PVC-duk', price: 1900 },
];

export default function OrderConfigurator() {
  const [length, setLength] = useState(6);
  const [extras, setExtras] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  const total = useMemo(() => {
    const base = Math.round(length * PRICE_PER_M);
    const addons = ACCESSORIES.filter((a) => extras.includes(a.id)).reduce((s, a) => s + a.price, 0);
    return base + addons;
  }, [length, extras]);

  const toggleExtra = (id: string) =>
    setExtras((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const fmt = (n: number) => n.toLocaleString('nb-NO');

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
            {ACCESSORIES.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`config-extra${extras.includes(a.id) ? ' active' : ''}`}
                onClick={() => toggleExtra(a.id)}
              >
                <span>{a.label}</span>
                <span className="config-extra-price">+{fmt(a.price)} kr</span>
              </button>
            ))}
          </div>
        </div>

        <div className="config-total">
          <div>
            <span className="config-total-label">Veiledende pris</span>
            <span className="config-total-sub">{length} m Argostep Livbåtleider</span>
          </div>
          <span className="config-total-amount">{fmt(total)} kr</span>
        </div>

        {!sent ? (
          <button type="button" className="btn-primary config-submit" onClick={() => setSent(true)}>
            Bestill nå →
          </button>
        ) : (
          <div className="config-confirm">
            ✓ Takk! Vi har mottatt din bestilling på en {length} m Argostep og tar kontakt for bekreftelse.
          </div>
        )}
        <p className="config-note">
          Prisen er veiledende eks. mva. Endelig tilbud bekreftes etter kontakt.
        </p>
      </div>
    </div>
  );
}
