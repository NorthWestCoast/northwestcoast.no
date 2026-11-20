import { PortalForm } from '@/components/portal/forms';
import { Hidden, Input, Select } from '@/components/admin/fields';
import type { ActionResult } from '@/lib/portal/forms';
import { MANUAL_MOVEMENTS } from '@/lib/portal/labels';
import { fmtQty } from '@/lib/stock';
import type { OpenPurchaseLine } from './data';
import { type ManualKind, PURCHASE_PREFIX } from './register';

/**
 * Skjemaene som endrer beholdningen: bevegelse for hånd og varetelling.
 * Samme skjema i admin og i produksjon; siden sender inn sin egen action,
 * som har vokteren for området.
 */

type Action = (formData: FormData) => Promise<ActionResult>;

/** Mengdefelt: tekst med talltastatur, så både komma og punktum går på telefon. */
const QTY = { type: 'text', inputMode: 'decimal', autoComplete: 'off', maxLength: 14 } as const;

/**
 * «Registrer bevegelse». Skjemaet sender en positiv mengde og hva som har
 * skjedd; fortegnet settes av handlingen.
 *
 * Har varen åpne innkjøp, kan varemottaket føres rett på innkjøpet. Da går
 * «i bestilling» ned med det samme, og innkjøpet lukkes når alt er kommet.
 */
export function MovementForm({
  action,
  itemId,
  unit,
  kinds,
  today,
  purchaseLines = [],
}: {
  action: Action;
  itemId: string;
  unit: string;
  /** Slagene dette området får registrere. */
  kinds: readonly ManualKind[];
  /** Dagens dato (YYYY-MM-DD). Forvalg, og seneste dato som kan velges. */
  today: string;
  purchaseLines?: OpenPurchaseLine[];
}) {
  const canReceive = kinds.includes('receipt');
  const onPurchase = canReceive ? purchaseLines : [];

  return (
    <PortalForm action={action} submitLabel="Registrer" pendingLabel="Registrerer…">
      <Hidden fields={{ item_id: itemId }} />
      <Select
        scope="movement"
        name="kind"
        label="Hva har skjedd"
        required
        defaultValue=""
        hint={onPurchase.length > 0 ? 'Velg innkjøpet når varene kommer fra en bestilling hos leverandør.' : undefined}
      >
        {/* Ingen forvalg: en bevegelse kan ikke slettes, så slaget skal velges med vilje. */}
        <option value="" disabled>Velg</option>
        {onPurchase.map((line) => (
          <option key={line.id} value={`${PURCHASE_PREFIX}${line.id}`}>
            Varemottak på innkjøp {line.po_number} ({fmtQty(line.remaining, unit)} gjenstår)
          </option>
        ))}
        {MANUAL_MOVEMENTS.filter((movement) => kinds.includes(movement.kind)).map((movement) => (
          <option key={movement.kind} value={movement.kind}>
            {movement.kind === 'receipt' && onPurchase.length > 0 ? 'Varemottak uten innkjøp' : movement.label}
          </option>
        ))}
      </Select>
      <div className="pt-form-row">
        <Input scope="movement" name="quantity" label={`Mengde (${unit})`} required {...QTY} />
        <Input scope="movement" name="occurred_on" label="Dato" type="date" defaultValue={today} max={today} required />
      </div>
      <Input scope="movement" name="note" label="Notat (valgfritt)" maxLength={500} />
    </PortalForm>
  );
}

/**
 * «Varetelling». Brukeren skriver det som faktisk ble talt. Handlingen
 * regner ut forskjellen mot beholdningen og fører den som én justering.
 */
export function CountForm({
  action,
  itemId,
  unit,
  onHand,
}: {
  action: Action;
  itemId: string;
  unit: string;
  onHand: number;
}) {
  return (
    <PortalForm action={action} submitLabel="Registrer telling" pendingLabel="Registrerer…">
      <Hidden fields={{ item_id: itemId }} />
      <div className="pt-form-row">
        <div className="pt-field">
          <label htmlFor="count-on-hand">Står som nå</label>
          {/* Bare til å lese. Feltet har ikke navn og sendes ikke med skjemaet. */}
          <input
            id="count-on-hand"
            value={fmtQty(onHand, unit)}
            readOnly
            disabled
            style={{ background: 'var(--pt-sunken)', color: 'var(--pt-muted)' }}
          />
        </div>
        <Input scope="count" name="counted" label={`Talt (${unit})`} required {...QTY} />
      </div>
      <Input
        scope="count"
        name="note"
        label="Notat (valgfritt)"
        maxLength={300}
        hint="Forskjellen føres som én justering. Stemmer tellingen, føres ingenting."
      />
    </PortalForm>
  );
}
