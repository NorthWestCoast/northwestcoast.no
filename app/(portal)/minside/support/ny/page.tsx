import type { Metadata } from 'next';
import { requireUser } from '@/lib/portal/context';
import { Card, PageHeader } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { uuid } from '@/lib/portal/forms';
import { TICKET_CATEGORIES } from '@/lib/portal/labels';
import { createTicket } from '../actions';

export const metadata: Metadata = { title: 'Ny sak' };

/** Ny sak til NorthWest Coast. ?leider=<id> forhåndsvelger leideren. */
export default async function NySakPage({
  searchParams,
}: {
  searchParams: Promise<{ leider?: string | string[] }>;
}) {
  const query = await searchParams;
  const { supabase } = await requireUser('/minside/support/ny');

  const { data: ladders } = await supabase
    .from('ladder_status')
    .select('ladder_id, serial_number, vessel_name')
    .order('serial_number')
    .limit(500);

  const requested = uuid(Array.isArray(query.leider) ? query.leider[0] : query.leider ?? null);
  const options = (ladders ?? []).filter((l) => l.ladder_id);
  const preselected = options.some((l) => l.ladder_id === requested) ? requested : null;

  return (
    <>
      <PageHeader
        title="Ny sak"
        description="Beskriv hva det gjelder, så svarer vi i saken."
        crumbs={[{ href: '/minside/support', label: 'Support' }, { label: 'Ny sak' }]}
      />

      <Card>
        <PortalForm action={createTicket} submitLabel="Send saken" pendingLabel="Sender…">
          <div className="pt-field">
            <label htmlFor="ticket-subject">Emne</label>
            <input id="ticket-subject" name="subject" required minLength={3} maxLength={200} />
          </div>
          <div className="pt-form-row">
            <div className="pt-field">
              <label htmlFor="ticket-category">Kategori</label>
              <select id="ticket-category" name="category" defaultValue="support" required>
                {Object.entries(TICKET_CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="pt-field">
              <label htmlFor="ticket-ladder">Gjelder leider (valgfritt)</label>
              <select id="ticket-ladder" name="ladder_id" defaultValue={preselected ?? ''}>
                <option value="">Ingen bestemt leider</option>
                {options.map((ladder) => (
                  <option key={ladder.ladder_id} value={ladder.ladder_id as string}>
                    {[ladder.serial_number, ladder.vessel_name].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-field">
            <label htmlFor="ticket-body">Beskrivelse</label>
            <textarea id="ticket-body" name="body" required maxLength={5000} style={{ minHeight: '160px' }} />
          </div>
        </PortalForm>
      </Card>
    </>
  );
}
