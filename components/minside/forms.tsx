import { PortalForm } from '@/components/portal/forms';
import type { ActionResult } from '@/lib/portal/forms';

type Action = (formData: FormData) => Promise<ActionResult>;

/** «Har du allerede en leider?» – ber om tilgang via produksjonsnummeret. */
export function LadderAccessForm({ action, idPrefix = 'tilgang' }: { action: Action; idPrefix?: string }) {
  return (
    <PortalForm action={action} submitLabel="Be om tilgang" pendingLabel="Sender…">
      <div className="pt-field">
        <label htmlFor={`${idPrefix}-serial`}>Produksjonsnummer</label>
        <input
          id={`${idPrefix}-serial`}
          name="serial"
          required
          minLength={3}
          maxLength={60}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="Står på merkeskiltet på leideren"
        />
      </div>
      <div className="pt-field">
        <label htmlFor={`${idPrefix}-message`}>Melding (valgfritt)</label>
        <textarea
          id={`${idPrefix}-message`}
          name="message"
          maxLength={1000}
          placeholder="Hvem du er og hvorfor du trenger tilgang"
        />
      </div>
    </PortalForm>
  );
}

/** Registrer et selskap. Den som registrerer blir eier. */
export function CompanyForm({ action, idPrefix = 'selskap' }: { action: Action; idPrefix?: string }) {
  return (
    <PortalForm action={action} submitLabel="Registrer selskapet" pendingLabel="Registrerer…">
      <div className="pt-form-row">
        <div className="pt-field">
          <label htmlFor={`${idPrefix}-name`}>Navn på selskapet</label>
          <input id={`${idPrefix}-name`} name="name" required minLength={2} maxLength={160} autoComplete="organization" />
        </div>
        <div className="pt-field">
          <label htmlFor={`${idPrefix}-org`}>Organisasjonsnummer</label>
          <input id={`${idPrefix}-org`} name="org_number" inputMode="numeric" maxLength={14} placeholder="9 siffer" />
        </div>
      </div>
      <div className="pt-field">
        <label htmlFor={`${idPrefix}-address`}>Adresse</label>
        <input id={`${idPrefix}-address`} name="address" maxLength={200} autoComplete="street-address" />
      </div>
      <div className="pt-form-row pt-form-row-3">
        <div className="pt-field">
          <label htmlFor={`${idPrefix}-postal`}>Postnummer</label>
          <input id={`${idPrefix}-postal`} name="postal_code" inputMode="numeric" maxLength={10} autoComplete="postal-code" />
        </div>
        <div className="pt-field">
          <label htmlFor={`${idPrefix}-city`}>Poststed</label>
          <input id={`${idPrefix}-city`} name="city" maxLength={80} autoComplete="address-level2" />
        </div>
        <div className="pt-field">
          <label htmlFor={`${idPrefix}-phone`}>Telefon</label>
          <input id={`${idPrefix}-phone`} name="phone" type="tel" maxLength={40} autoComplete="tel" />
        </div>
      </div>
    </PortalForm>
  );
}

/** Inviter en person på e-post til et selskap, et fartøy eller en leider. */
export function InviteForm({
  action,
  fields,
  roles,
  defaultRole,
  idPrefix,
  submitLabel = 'Gi tilgang',
}: {
  action: Action;
  /** Skjulte felt, f.eks. hvilken leider invitasjonen gjelder. */
  fields: Record<string, string>;
  roles: Record<string, string>;
  defaultRole: string;
  idPrefix: string;
  submitLabel?: string;
}) {
  return (
    <PortalForm action={action} submitLabel={submitLabel} pendingLabel="Sender…">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="pt-form-row">
        <div className="pt-field">
          <label htmlFor={`${idPrefix}-email`}>E-post</label>
          <input id={`${idPrefix}-email`} name="email" type="email" required maxLength={160} autoComplete="off" />
        </div>
        <div className="pt-field">
          <label htmlFor={`${idPrefix}-role`}>Rolle</label>
          <select id={`${idPrefix}-role`} name="role" defaultValue={defaultRole}>
            {Object.entries(roles).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="pt-field">
        <label htmlFor={`${idPrefix}-message`}>Melding (valgfritt)</label>
        <textarea id={`${idPrefix}-message`} name="message" maxLength={500} />
        <small>Tilgangen gjelder fra første gang personen logger inn med denne e-postadressen.</small>
      </div>
    </PortalForm>
  );
}

/** Bestill service på en leider. Med flere leidere velges den i en liste. */
export function ServiceRequestForm({
  action,
  ladders,
  minDate,
  idPrefix = 'service',
}: {
  action: Action;
  ladders: { id: string; label: string }[];
  /** Tidligste dato som kan velges (i dag). */
  minDate: string;
  idPrefix?: string;
}) {
  return (
    <PortalForm action={action} submitLabel="Bestill service" pendingLabel="Sender…" tone="green">
      {ladders.length === 1 ? (
        <input type="hidden" name="ladder_id" value={ladders[0].id} />
      ) : (
        <div className="pt-field">
          <label htmlFor={`${idPrefix}-ladder`}>Leider</label>
          <select id={`${idPrefix}-ladder`} name="ladder_id" required defaultValue="">
            <option value="" disabled>Velg leider</option>
            {ladders.map((ladder) => (
              <option key={ladder.id} value={ladder.id}>{ladder.label}</option>
            ))}
          </select>
        </div>
      )}
      <div className="pt-form-row">
        <div className="pt-field">
          <label htmlFor={`${idPrefix}-date`}>Ønsket dato (valgfritt)</label>
          <input id={`${idPrefix}-date`} name="preferred_date" type="date" min={minDate} />
        </div>
        <div className="pt-field">
          <label htmlFor={`${idPrefix}-location`}>Sted eller havn</label>
          <input id={`${idPrefix}-location`} name="location" maxLength={200} placeholder="F.eks. Ålesund" />
        </div>
      </div>
      <div className="pt-field">
        <label htmlFor={`${idPrefix}-notes`}>Kommentar (valgfritt)</label>
        <textarea id={`${idPrefix}-notes`} name="notes" maxLength={2000} />
      </div>
    </PortalForm>
  );
}
