import type { Metadata } from 'next';
import { requireUser } from '@/lib/portal/context';
import { Card, PageHeader } from '@/components/portal/ui';
import Calendar, { OverdueList } from '@/components/portal/calendar';
import { loadCalendar, monthGrid, parseMonth } from '@/lib/portal/calendar';
import { idag } from '@/lib/format';

export const metadata: Metadata = { title: 'Kalender' };

/**
 * Kalender for leiderne brukeren har tilgang til: servicefrister, avtalt
 * service, kontroller og andre oppgaver, sertifikater og lenker som går ut.
 */
export default async function KalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ mnd?: string | string[] }>;
}) {
  const { supabase, ctx } = await requireUser('/minside/kalender');
  const query = await searchParams;

  const today = idag();
  const month = parseMonth(query.mnd, today);
  const { from, to } = monthGrid(month);
  const { events, overdue } = await loadCalendar(supabase, {
    from,
    to,
    today,
    showCompany: ctx.staffRole === 'admin' || ctx.companies.length > 1,
  });

  return (
    <>
      <PageHeader
        title="Kalender"
        description="Servicefrister, avtalt service og kontroller på leiderne dine. Kvartalsvis kontroll og test etter 30 måneder legges inn når en leider tas i bruk."
      />

      {overdue.length > 0 && (
        <Card title="Forfalt" description="Frister som har gått ut og ikke er fullført." flush>
          <OverdueList events={overdue} />
        </Card>
      )}

      <Card>
        <Calendar
          month={month}
          today={today}
          events={events}
          href={(target) => `/minside/kalender?mnd=${target}`}
        />
      </Card>
    </>
  );
}
