'use client';

import { useRef, useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/portal/forms';
import { fmtQty } from '@/lib/stock';

export type PurchaseItem = {
  id: string;
  item_number: string;
  name: string;
  unit: string;
  on_hand: number;
  on_order: number;
  available: number;
  reorder_point: number;
  below_minimum: boolean;
};

type Line = { key: number; itemId: string; qty: string };

/** Tre desimaler, som kolonnene i databasen, og med punktum så feltet kan leses tilbake. */
const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Det som mangler for å komme opp på minimum, når det som alt er bestilt er
 * regnet med. Null eller mindre betyr at varen er dekket.
 */
const shortfall = (item: PurchaseItem) => round(item.reorder_point - item.available - item.on_order);

/**
 * Skjemaet for et nytt innkjøp: leverandør, datoer og linjer.
 *
 * Linjene holdes i tilstand her, fordi de legges til og fjernes før noe er
 * lagret. Hver linje sender feltene `item` og `qty`; serveren leser dem parvis
 * og validerer alt på nytt. En vare kan bare stå på én linje, så varer som er
 * valgt på en annen linje er grået ut i lista.
 */
export function PurchaseForm({
  action,
  suppliers,
  items,
  kinds,
  today,
  initialItemId,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  suppliers: { id: string; name: string }[];
  items: PurchaseItem[];
  /** Slagene innkjøp, verdi → ledetekst. */
  kinds: Record<string, string>;
  /** Dagens dato (YYYY-MM-DD) i norsk tid. */
  today: string;
  /** Vare som skal stå på første linje, når siden åpnes fra en vare. */
  initialItemId?: string;
}) {
  const nextKey = useRef(1);
  const [lines, setLines] = useState<Line[]>(() => [
    { key: 0, itemId: items.some((item) => item.id === initialItemId) ? initialItemId ?? '' : '', qty: '' },
  ]);
  const [supplier, setSupplier] = useState(suppliers.length === 0 ? 'new' : '');
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = new Map(items.map((item) => [item.id, item]));
  const chosen = new Set(lines.map((line) => line.itemId).filter(Boolean));
  const below = items.filter((item) => item.below_minimum);

  const update = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  /** Ny, tom linje. Nøkkelen tas her og ikke i oppdateringen, som React kan kjøre to ganger. */
  const blank = (): Line => ({ key: nextKey.current++, itemId: '', qty: '' });

  function addLine() {
    const line = blank();
    setLines((current) => [...current, line]);
    setNotice('');
  }

  function removeLine(key: number) {
    // Den siste linja tømmes i stedet for å forsvinne: skjemaet har alltid én.
    const empty = blank();
    setLines((current) => (current.length === 1 ? [empty] : current.filter((line) => line.key !== key)));
    setNotice('');
  }

  /**
   * Legger til varene som ligger under minimum, med det som mangler som
   * forslag til mengde. Varer der det bestilte allerede dekker minimum,
   * hoppes over og nevnes, så ingen bestiller dobbelt.
   */
  function addBelowMinimum() {
    const wanted = below.filter((item) => !chosen.has(item.id));
    const needed = wanted.filter((item) => shortfall(item) > 0);
    const covered = wanted.filter((item) => shortfall(item) <= 0);

    if (needed.length > 0) {
      const added = needed.map((item) => ({ ...blank(), itemId: item.id, qty: String(shortfall(item)) }));
      // Tomme linjer fjernes, så forslagene ikke havner under en blank rad.
      setLines((current) => [...current.filter((line) => line.itemId || line.qty), ...added]);
    }

    const parts = [
      needed.length === 1 ? 'La til 1 vare.' : needed.length > 1 ? `La til ${needed.length} varer.` : '',
      covered.length > 0
        ? `${covered.map((item) => item.item_number).join(', ')} er under minimum, men det som er bestilt dekker det.`
        : '',
      wanted.length === 0 ? 'Alle varer under minimum står allerede på lista.' : '',
    ].filter(Boolean);
    setNotice(parts.join(' '));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      // Når innkjøpet er opprettet, sender handlingen videre til det, og det kommer ikke noe svar.
      const response = await action(formData);
      if (response) setResult(response);
    });
  }

  return (
    <form onSubmit={submit} className="pt-form">
      <div className="pt-form-row">
        {/* Nabofeltet har hjelpetekst: feltet skal stå øverst, ikke strekkes til samme høyde. */}
        <div className="pt-field" style={{ alignContent: 'start' }}>
          <label htmlFor="purchase-supplier">Leverandør</label>
          <select
            id="purchase-supplier"
            name="supplier"
            value={supplier}
            onChange={(event) => setSupplier(event.target.value)}
            required
          >
            <option value="" disabled>Velg leverandør</option>
            {suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            <option value="new">Ny leverandør …</option>
          </select>
        </div>
        <div className="pt-field">
          <label htmlFor="purchase-kind">Type</label>
          <select id="purchase-kind" name="kind" defaultValue={Object.keys(kinds)[0]} required>
            {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <small>Velg produksjon hos ekstern part når delene lages på bestilling.</small>
        </div>
      </div>

      {supplier === 'new' && (
        <div className="pt-subform">
          <div className="pt-form-row">
            <div className="pt-field">
              <label htmlFor="purchase-supplier-name">Navn på leverandøren</label>
              <input id="purchase-supplier-name" name="supplier_name" minLength={2} maxLength={160} required />
            </div>
            <div className="pt-field">
              <label htmlFor="purchase-supplier-contact">Kontaktperson (valgfritt)</label>
              <input id="purchase-supplier-contact" name="supplier_contact_name" maxLength={160} />
            </div>
          </div>
          <div className="pt-form-row">
            <div className="pt-field">
              <label htmlFor="purchase-supplier-email">E-post (valgfritt)</label>
              <input id="purchase-supplier-email" name="supplier_email" type="email" maxLength={200} />
            </div>
            <div className="pt-field">
              <label htmlFor="purchase-supplier-phone">Telefon (valgfritt)</label>
              <input id="purchase-supplier-phone" name="supplier_phone" type="tel" maxLength={40} />
            </div>
          </div>
          <p className="pt-hint">Leverandøren lagres sammen med innkjøpet og kan velges neste gang.</p>
        </div>
      )}

      <div className="pt-form-row pt-form-row-3">
        <div className="pt-field">
          <label htmlFor="purchase-ordered">Bestilt dato</label>
          <input id="purchase-ordered" name="ordered_on" type="date" defaultValue={today} max={today} required />
        </div>
        <div className="pt-field">
          <label htmlFor="purchase-expected">Ventet dato (valgfritt)</label>
          <input id="purchase-expected" name="expected_on" type="date" />
        </div>
        <div className="pt-field">
          <label htmlFor="purchase-reference">Leverandørens referanse (valgfritt)</label>
          <input id="purchase-reference" name="reference" maxLength={120} autoComplete="off" />
        </div>
      </div>

      <div className="pt-field">
        <label htmlFor="purchase-notes">Notat (valgfritt)</label>
        <textarea id="purchase-notes" name="notes" maxLength={2000} rows={2} style={{ minHeight: '4.5rem' }} />
      </div>

      <fieldset className="pt-fieldset">
        <legend className="pt-label" style={{ marginBottom: '0.3rem' }}>Linjer</legend>
        <ul className="pt-list pt-list-plain">
          {lines.map((line, index) => {
            const item = byId.get(line.itemId);
            return (
              <li key={line.key} style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 18rem', minWidth: 0 }}>
                  <select
                    className="pt-input"
                    name="item"
                    value={line.itemId}
                    onChange={(event) => update(line.key, { itemId: event.target.value })}
                    aria-label={`Vare, linje ${index + 1}`}
                    required
                  >
                    <option value="">Velg vare</option>
                    {items.map((option) => (
                      <option
                        key={option.id}
                        value={option.id}
                        disabled={option.id !== line.itemId && chosen.has(option.id)}
                      >
                        {option.item_number} · {option.name} ({option.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 'none' }}>
                  {/* Synlig ledetekst: plassholdere er nesten usynlige på hvite felt i portalen. */}
                  <span className="pt-muted" style={{ fontSize: '0.84rem' }} aria-hidden="true">Mengde</span>
                  <input
                    className="pt-input"
                    name="qty"
                    value={line.qty}
                    onChange={(event) => update(line.key, { qty: event.target.value })}
                    inputMode="decimal"
                    maxLength={14}
                    autoComplete="off"
                    aria-label={`Mengde, linje ${index + 1}`}
                    style={{ width: '5.5rem' }}
                    required
                  />
                  {/* Fast bredde: enheten skal ikke flytte knappen når varen velges. */}
                  <span className="pt-muted" style={{ width: '2.3rem' }}>{item?.unit ?? ''}</span>
                </div>
                <button
                  type="button"
                  className="pt-btn pt-btn-ghost pt-btn-sm"
                  style={{ marginLeft: 'auto', marginTop: '4px' }}
                  onClick={() => removeLine(line.key)}
                  aria-label={`Fjern linje ${index + 1}`}
                >
                  Fjern
                </button>
                {/* Alltid én linje tekst, så raden er like høy med og uten vare. */}
                <div className="pt-hint" style={{ flexBasis: '100%', minHeight: '1.35em' }}>
                  {item
                    ? [
                        `På lager ${fmtQty(item.on_hand, item.unit)}`,
                        item.on_order > 0 ? `bestilt ${fmtQty(item.on_order, item.unit)}` : null,
                        item.reorder_point > 0 ? `minimum ${fmtQty(item.reorder_point, item.unit)}` : null,
                      ].filter(Boolean).join(' · ')
                    : 'Velg en vare og skriv inn mengden.'}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="pt-actions" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm" onClick={addLine} disabled={lines.length >= 100}>
            Legg til linje
          </button>
          {below.length > 0 && (
            <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm" onClick={addBelowMinimum}>
              Legg til varer under minimum ({below.length})
            </button>
          )}
        </div>
        <p className="pt-hint" role="status" style={{ marginTop: '0.4rem', minHeight: '1.35em' }}>{notice}</p>
      </fieldset>

      <div className="pt-form-foot">
        <button type="submit" className="pt-btn" disabled={pending}>
          {pending ? 'Oppretter…' : 'Opprett innkjøp'}
        </button>
        {result && !result.ok && <span className="pt-msg" data-ok="false" role="alert">{result.error}</span>}
      </div>
    </form>
  );
}
