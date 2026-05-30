'use client';

import { useMemo, useState } from 'react';
import Script from 'next/script';

// Priser iht. offisiell tabell. Skap- og PVC-pris (og størrelse/antall) følger lengden.
type Row = { length: number; price: number; cabinetSize: number; cabinetPrice: number; pvcQty: number; pvcPrice: number };

const PRICE_TABLE: Row[] = [
  { length: 3,  price: 9499,  cabinetSize: 1, cabinetPrice: 4999, pvcQty: 1, pvcPrice: 3999 },
  { length: 4,  price: 10999, cabinetSize: 1, cabinetPrice: 4999, pvcQty: 1, pvcPrice: 3999 },
  { length: 5,  price: 12499, cabinetSize: 1, cabinetPrice: 4999, pvcQty: 1, pvcPrice: 3999 },
  { length: 6,  price: 13999, cabinetSize: 1, cabinetPrice: 4999, pvcQty: 1, pvcPrice: 3999 },
  { length: 7,  price: 15499, cabinetSize: 2, cabinetPrice: 5999, pvcQty: 2, pvcPrice: 4999 },
  { length: 8,  price: 16999, cabinetSize: 2, cabinetPrice: 5999, pvcQty: 2, pvcPrice: 4999 },
  { length: 9,  price: 18099, cabinetSize: 2, cabinetPrice: 5999, pvcQty: 2, pvcPrice: 4999 },
  { length: 10, price: 20699, cabinetSize: 2, cabinetPrice: 5999, pvcQty: 2, pvcPrice: 4999 },
  { length: 11, price: 22199, cabinetSize: 3, cabinetPrice: 6999, pvcQty: 3, pvcPrice: 5999 },
  { length: 12, price: 24199, cabinetSize: 3, cabinetPrice: 6999, pvcQty: 3, pvcPrice: 5999 },
  { length: 13, price: 25499, cabinetSize: 3, cabinetPrice: 6999, pvcQty: 3, pvcPrice: 5999 },
  { length: 14, price: 26799, cabinetSize: 3, cabinetPrice: 6999, pvcQty: 3, pvcPrice: 5999 },
  { length: 15, price: 28999, cabinetSize: 3, cabinetPrice: 6999, pvcQty: 3, pvcPrice: 5999 },
];

const LENGTHS = PRICE_TABLE.map((r) => r.length); // 3..15

export default function OrderConfigurator() {
  const [length, setLength] = useState(6);
  const [extras, setExtras] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  const row = useMemo(
    () => PRICE_TABLE.find((r) => r.length === length) ?? PRICE_TABLE[0],
    [length],
  );

  const accessories = useMemo(
    () => [
      { id: 'cabinet', label: `Oppbevaringsskap (str. ${row.cabinetSize})`, price: row.cabinetPrice },
      { id: 'pvc', label: 'PVC-duk', price: row.pvcPrice },
    ],
    [row],
  );

  const total = useMemo(() => {
    const addons = accessories.filter((a) => extras.includes(a.id)).reduce((s, a) => s + a.price, 0);
    return row.price + addons;
  }, [row, accessories, extras]);

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
            {accessories.map((a) => (
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
            <span className="config-total-label">Totalpris</span>
            <span className="config-total-sub">{length} m leider · {fmt(row.price)} kr{extras.length > 0 ? ' + tilbehør' : ''}</span>
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
