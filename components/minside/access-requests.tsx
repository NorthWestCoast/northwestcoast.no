import Link from 'next/link';
import { Disclosure } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { LADDER_ROLES } from '@/lib/portal/labels';
import { dato } from '@/lib/format';
import { decideAccessRequest } from '@/app/(portal)/minside/actions';

export type PendingRequest = {
  id: string;
  ladder_id: string;
  requester_name: string | null;
  requester_email: string | null;
  message: string | null;
  created_at: string;
  ladders: { serial_number: string } | null;
};

/**
 * Forespørsler om tilgang som venter på at brukeren svarer: godkjenn med
 * valgt rolle, eller avslå med en kort begrunnelse.
 */
export default function PendingRequests({
  requests,
  showLadder = true,
}: {
  requests: PendingRequest[];
  /** Skjules på leidersiden, der det er gitt hvilken leider det gjelder. */
  showLadder?: boolean;
}) {
  return (
    <ul className="pt-list">
      {requests.map((request) => (
        <li key={request.id}>
          <div className="pt-list-main">
            <strong>{request.requester_name || request.requester_email || 'Ukjent bruker'}</strong>
            <div className="pt-list-sub">
              {request.requester_name && request.requester_email ? `${request.requester_email} · ` : ''}
              {showLadder && (
                <>
                  <Link href={`/minside/leider/${request.ladder_id}?fane=tilgang`}>
                    leider {request.ladders?.serial_number ?? '–'}
                  </Link>
                  {' · '}
                </>
              )}
              sendt {dato(request.created_at)}
            </div>
            {request.message && <div className="pt-list-sub">Melding: {request.message}</div>}
          </div>

          <div style={{ flexBasis: '100%' }}>
            <PortalForm action={decideAccessRequest} submitLabel="Godkjenn" tone="green">
              <input type="hidden" name="request_id" value={request.id} />
              <input type="hidden" name="approve" value="true" />
              <div className="pt-form-row">
                <div className="pt-field">
                  <label htmlFor={`role-${request.id}`}>Tilgang</label>
                  <select id={`role-${request.id}`} name="role" defaultValue="viewer">
                    {Object.entries(LADDER_ROLES).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-field">
                  <label htmlFor={`note-${request.id}`}>Melding til den som spør (valgfritt)</label>
                  <input id={`note-${request.id}`} name="note" maxLength={500} />
                </div>
              </div>
            </PortalForm>

            <div style={{ margin: '0.9rem -1.1rem -0.8rem' }}>
              <Disclosure summary="Avslå forespørselen">
                <PortalForm action={decideAccessRequest} submitLabel="Avslå" pendingLabel="Avslår…">
                  <input type="hidden" name="request_id" value={request.id} />
                  <input type="hidden" name="approve" value="false" />
                  <div className="pt-field">
                    <label htmlFor={`reject-${request.id}`}>Begrunnelse (valgfritt)</label>
                    <input id={`reject-${request.id}`} name="note" maxLength={500} />
                  </div>
                </PortalForm>
              </Disclosure>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
