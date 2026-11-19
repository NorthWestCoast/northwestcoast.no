import Link from 'next/link';
import { Badge, Card, Empty, Td } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { dato, datoTid } from '@/lib/format';
import { SHARE_CHECKLIST, SHARE_DAYS, shareStatus } from '@/components/minside/util';
import { createShare } from '../actions';
import type { SectionProps } from './types';

/**
 * Deling: tilstandsrapporter som kan åpnes av alle med lenken, uten
 * innlogging. Laget for å sende til los før bording.
 */
export default async function Deling({ supabase, ladder }: SectionProps) {
  const id = ladder.ladder_id;

  const { data: shares } = await supabase
    .from('ladder_state_shares')
    .select('id, title, recipient, created_at, created_by_name, expires_at, revoked_at, view_count, last_viewed_at')
    .eq('ladder_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <>
      <Card
        id="ny-rapport"
        title="Ny tilstandsrapport"
        description="Lag en lenke som viser leiderens tilstand akkurat nå: spesifikasjoner, siste service, sjekkliste og bilder. Bildene legger du til i neste steg."
      >
        <PortalForm action={createShare} submitLabel="Opprett rapport og lenke" pendingLabel="Oppretter…" tone="green">
          <input type="hidden" name="ladder_id" value={id} />
          <div className="pt-form-row">
            <div className="pt-field">
              <label htmlFor="share-title">Tittel</label>
              <input id="share-title" name="title" maxLength={160} defaultValue="Tilstand før losbording" required />
            </div>
            <div className="pt-field">
              <label htmlFor="share-recipient">Mottaker</label>
              <input id="share-recipient" name="recipient" maxLength={160} placeholder="F.eks. Los, Ålesund" />
            </div>
          </div>
          <fieldset style={{ border: 0, minWidth: 0, display: 'grid', gap: '0.45rem' }}>
            <legend className="pt-label" style={{ marginBottom: '0.45rem' }}>Sjekkliste</legend>
            {SHARE_CHECKLIST.map((label, index) => (
              <label key={label} className="pt-check">
                <input type="checkbox" name={`check_${index}`} />
                <span>{label}</span>
              </label>
            ))}
            <span className="pt-hint">Punkter du ikke krysser av, vises som ikke bekreftet i rapporten.</span>
          </fieldset>
          <div className="pt-field">
            <label htmlFor="share-note">Kommentar (valgfritt)</label>
            <textarea id="share-note" name="note" maxLength={2000} />
          </div>
          <div className="pt-field">
            <label htmlFor="share-days">Lenken er gyldig i</label>
            <select id="share-days" name="days" defaultValue="3">
              {SHARE_DAYS.map((days) => (
                <option key={days} value={days}>{days === 1 ? '1 dag' : `${days} dager`}</option>
              ))}
            </select>
          </div>
        </PortalForm>
      </Card>

      <Card title="Delte rapporter" flush>
        {shares && shares.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Rapport</th>
                <th>Mottaker</th>
                <th>Opprettet</th>
                <th>Utløper</th>
                <th>Visninger</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shares.map((share) => {
                const status = shareStatus(share);
                return (
                  <tr key={share.id}>
                    <Td label="Rapport" className="pt-table-strong">
                      <Link href={`/minside/leider/${id}/del/${share.id}`}>{share.title || 'Tilstandsrapport'}</Link>
                    </Td>
                    <Td label="Mottaker">{share.recipient ?? '–'}</Td>
                    <Td label="Opprettet">
                      {dato(share.created_at)}
                      {share.created_by_name ? ` av ${share.created_by_name}` : ''}
                    </Td>
                    <Td label="Utløper">{datoTid(share.expires_at)}</Td>
                    <Td label="Visninger">
                      {share.view_count}
                      {share.last_viewed_at ? ` (sist ${datoTid(share.last_viewed_at)})` : ''}
                    </Td>
                    <Td label="Status"><div><Badge tone={status.tone}>{status.label}</Badge></div></Td>
                    <Td>
                      <Link href={`/minside/leider/${id}/del/${share.id}`} className="pt-btn pt-btn-sm pt-btn-ghost">Administrer</Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen delte rapporter">Opprett den første rapporten i skjemaet over.</Empty>
        )}
      </Card>
    </>
  );
}
