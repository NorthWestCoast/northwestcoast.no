import Link from 'next/link';
import { Badge } from '@/components/portal/ui';
import { LADDER_ROLES, requestStatus } from '@/lib/portal/labels';
import { dato } from '@/lib/format';

export type OwnRequest = {
  id: string;
  ladder_id: string;
  status: string;
  message: string | null;
  granted_role: string | null;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  /** Nummeret brukeren selv skrev inn. */
  serial_number?: string | null;
  /** Bare synlig når man har (fått) tilgang til leideren. */
  ladders: { serial_number: string } | null;
};

/** Brukerens egne forespørsler om tilgang, med status og eventuelt svar. */
export default function OwnRequestList({ requests }: { requests: OwnRequest[] }) {
  return (
    <ul className="pt-list">
      {requests.map((request) => {
        const status = requestStatus(request.status);
        return (
          <li key={request.id}>
            <div className="pt-list-main">
              {request.ladders ? (
                <Link href={`/minside/leider/${request.ladder_id}`}>Leider {request.ladders.serial_number}</Link>
              ) : (
                <strong>Leider {request.serial_number ?? '(ukjent nummer)'}</strong>
              )}
              <div className="pt-list-sub">
                Sendt {dato(request.created_at)}
                {request.decided_at ? ` · besvart ${dato(request.decided_at)}` : ''}
                {request.status === 'approved' && request.granted_role
                  ? ` · ${LADDER_ROLES[request.granted_role] ?? request.granted_role}`
                  : ''}
              </div>
              {request.message && <div className="pt-list-sub">Din melding: {request.message}</div>}
              {request.decision_note && <div className="pt-list-sub">Svar: {request.decision_note}</div>}
            </div>
            <div className="pt-list-side">
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
