'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

const Ladder3D = dynamic(() => import('./ladder-3d'), {
  ssr: false,
  loading: () => <div className="ladder-loading">Laster 3D-modell…</div>,
});

const MIN = 2;
const MAX = 15;
const PRICE_PER_M = 2450; // NOK per meter, veiledende

const VESSELS = [
  'Fiskefartøy under 15m',
  'Servicefartøy under 15m',
  'Mindre lasteskip',
  'Passasjerfartøy',
];

const ACCESSORIES = [
  { id: 'cabinet', label: 'Oppbevaringsskap', price: 4900 },
  { id: 'spares', label: 'Reservedelssett', price: 1900 },
  { id: 'mount', label: 'Veggmontering', price: 1200 },
];

export default function OrderConfigurator() {
  const [length, setLength] = useState(6);
  const [vessel, setVessel] = useState(VESSELS[0]);
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
      {/* 3D viewer */}
      <div className="config-viewer">
        <Ladder3D length={length} />
        <div className="config-viewer-badge">{length.toFixed(1)} m · {Math.round(length / 0.32)} trinn</div>
        <div className="config-viewer-hint">Dra for å rotere</div>
      </div>

      {/* Options */}
      <div className="config-panel">
        <div className="lbl">Konfigurer din leider</div>
        <h2 className="stitle">Argostep Livbåtleider</h2>

        <div className="config-block">
          <div className="config-row">
            <label htmlFor="length">Lengde</label>
            <span className="config-value">{length.toFixed(1)} m</span>
          </div>
          <input
            id="length"
            type="range"
            min={MIN}
            max={MAX}
            step={0.5}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="config-slider"
          />
          <div className="config-scale">
            <span>{MIN} m</span>
            <span>{MAX} m</span>
          </div>
          <div className="config-quick">
            {[2, 4, 6, 8, 10, 12, 15].map((v) => (
              <button
                key={v}
                type="button"
                className={`config-chip${length === v ? ' active' : ''}`}
                onClick={() => setLength(v)}
              >
                {v}m
              </button>
            ))}
          </div>
        </div>

        <div className="config-block">
          <div className="config-row">
            <label htmlFor="vessel">Fartøystype</label>
          </div>
          <select
            id="vessel"
            className="config-select"
            value={vessel}
            onChange={(e) => setVessel(e.target.value)}
          >
            {VESSELS.map((v) => (
              <option key={v}>{v}</option>
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
            <span className="config-total-sub">{length.toFixed(1)} m · {vessel}</span>
          </div>
          <span className="config-total-amount">{fmt(total)} kr</span>
        </div>

        {!sent ? (
          <button type="button" className="btn-primary config-submit" onClick={() => setSent(true)}>
            Bestill nå →
          </button>
        ) : (
          <div className="config-confirm">
            ✓ Takk! Vi har mottatt din bestilling på en {length.toFixed(1)} m Argostep og tar kontakt for bekreftelse.
          </div>
        )}
        <p className="config-note">
          Prisen er veiledende eks. mva. Endelig tilbud bekreftes etter kontakt.
        </p>
      </div>
    </div>
  );
}
