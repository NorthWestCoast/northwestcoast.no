import { Badge, Card, Empty, Td } from '@/components/portal/ui';
import { ActionButton, CopyField, PortalForm } from '@/components/portal/forms';
import MaintenanceChecklistForm from '@/components/maintenance-checklist-form';
import ChecklistPrint, { PrintSheetButton } from '@/components/checklist-print';
import { LINK_DAYS, LINK_TOKEN, linkDaysLabel, linkPath } from '@/components/minside/maintenance-links';
import { shareStatus } from '@/components/minside/util';
import { CHECKLISTS, printSheets, sheetLabels } from '@/lib/maintenance-checklists';
import { getDict } from '@/lib/i18n';
import { PORTAL_URL } from '@/lib/site';
import { dato, datoTid, idag } from '@/lib/format';
import {
  createMaintenanceLink, finishRegistration, registerMaintenance, revokeMaintenanceLink,
} from '../actions';
import type { SectionProps } from './types';

/**
 * Registrer vedlikehold: skjemaet med sjekkpunktene fra brukermanualen,
 * skjemaene for utskrift, og lenker som lar folk uten innlogging registrere
 * på denne leideren (bare for den som forvalter den).
 */
export default async function Registrer({
  supabase, ladder, canManage, newLink,
}: SectionProps & { newLink?: string }) {
  const id = ladder.ladder_id;
  const f = getDict('no').maintenanceForm;

  const { data: links } = canManage
    ? await supabase
        .from('maintenance_links')
        .select('id, recipient, created_at, created_by_name, expires_at, revoked_at, use_count, last_used_at')
        .eq('ladder_id', id)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] };

  const freshLink = newLink && LINK_TOKEN.test(newLink) ? `${PORTAL_URL}${linkPath(newLink)}` : null;

  return (
    <>
      <Card
        title="Registrer vedlikehold"
        description="Huk av sjekkpunktene, eller last opp et bilde av et utfylt papirskjema. Registreringen havner i historikken til leideren."
      >
        <MaintenanceChecklistForm
          lang="no"
          today={idag()}
          askName={false}
          submit={registerMaintenance.bind(null, id)}
          finish={finishRegistration.bind(null, id)}
        />
      </Card>

      <Card title={f.printTitle} description={f.printSub}>
        <div className="mf-print-buttons">
          {CHECKLISTS.map((kind) => (
            <PrintSheetButton key={kind} kind={kind} label={f.kinds[kind]} className="pt-btn pt-btn-ghost" />
          ))}
        </div>
        <ChecklistPrint
          sheets={printSheets('no')}
          labels={sheetLabels('no')}
          prefill={{ vessel: ladder.vessel_name, serial: ladder.serial_number }}
        />
      </Card>

      {canManage && (
        <Card
          id="lenker"
          title="Lenker for registrering uten innlogging"
          description="Send en lenke til mannskap eller servicefolk som ikke har innlogging. De kan registrere vedlikehold på akkurat denne leideren, så lenge lenken gjelder. Du kan trekke den tilbake når som helst."
        >
          {freshLink && (
            <div className="pt-alert" data-tone="ok">
              <div className="pt-stack" style={{ width: '100%' }}>
                <div>
                  <strong>Lenken er laget</strong>
                  <p>Kopier den nå og send den videre. Den kan ikke hentes fram igjen senere.</p>
                </div>
                <CopyField value={freshLink} />
              </div>
            </div>
          )}

          <PortalForm action={createMaintenanceLink} submitLabel="Lag lenke" pendingLabel="Lager…" tone="green">
            <input type="hidden" name="ladder_id" value={id} />
            <div className="pt-form-row">
              <div className="pt-field">
                <label htmlFor="link-recipient">Til hvem (valgfritt)</label>
                <input id="link-recipient" name="recipient" maxLength={160} placeholder="F.eks. Mannskapet på MS Havbris" />
              </div>
              <div className="pt-field">
                <label htmlFor="link-days">Gjelder i</label>
                <select id="link-days" name="days" defaultValue="90">
                  {LINK_DAYS.map((days) => (
                    <option key={days} value={days}>{linkDaysLabel(days)}</option>
                  ))}
                </select>
              </div>
            </div>
          </PortalForm>

          {links && links.length > 0 ? (
            <table className="pt-table" style={{ marginTop: '1.25rem' }}>
              <thead>
                <tr>
                  <th>Til</th>
                  <th>Laget</th>
                  <th>Gjelder til</th>
                  <th>Brukt</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {links.map((link) => {
                  const status = shareStatus(link);
                  return (
                    <tr key={link.id}>
                      <Td label="Til" className="pt-table-strong">{link.recipient ?? '–'}</Td>
                      <Td label="Laget">
                        {dato(link.created_at)}
                        {link.created_by_name ? ` av ${link.created_by_name}` : ''}
                      </Td>
                      <Td label="Gjelder til">{dato(link.expires_at)}</Td>
                      <Td label="Brukt">
                        {link.use_count === 1 ? '1 gang' : `${link.use_count} ganger`}
                        {link.last_used_at ? ` (sist ${datoTid(link.last_used_at)})` : ''}
                      </Td>
                      <Td label="Status"><div><Badge tone={status.tone}>{status.label}</Badge></div></Td>
                      <Td>
                        {status.active && (
                          <ActionButton
                            action={revokeMaintenanceLink}
                            fields={{ link_id: link.id }}
                            label="Trekk tilbake"
                            tone="danger"
                            confirm="Trekke tilbake lenken? Den kan ikke brukes igjen."
                          />
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty title="Ingen lenker ennå">Lag den første lenken i skjemaet over.</Empty>
          )}
        </Card>
      )}
    </>
  );
}
