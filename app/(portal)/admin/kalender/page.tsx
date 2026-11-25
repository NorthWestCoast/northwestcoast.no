import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/portal/context';
import { Card, PageHeader } from '@/components/portal/ui';
import Calendar, { OverdueList } from '@/components/portal/calendar';
import { loadCalendar, monthGrid, parseMonth } from '@/lib/portal/calendar';
import { uuid } from '@/lib/portal/forms';
import { idag } from '@/lib/format';

export const metadata: Metadata = { title: 'Kalender' };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Kalender for alle kundene, eller ett selskap (?selskap=). Samme frister som
 * kundene ser i sin egen kalender.
 */
export default async function AdminKalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ mnd?: string | string[]; selskap?: string | string[] }>;
}) {
  const { supabase } = await requireAdmin('/admin/kalender');
  const query = await searchParams;

  const today = idag();
  const month = parseMonth(query.mnd, today);
  const companyId = uuid(first(query.selskap) ?? null);
  const { from, to } = monthGrid(month);

  const [{ data: companies }, { events, overdue }] = await Promise.all([
    supabase.from('companies').select('id, name').order('name').limit(1000),
    loadCalendar(supabase, { from, to, today, companyId, showCompany: !companyId }),
  ]);
  const company = companyId ? companies?.find((row) => row.id === companyId) : null;

  const href = (target: string) =>
    `/admin/kalender?mnd=${target}${companyId ? `&selskap=${companyId}` : ''}`;

  return (
    <>
      <PageHeader
        title="Kalender"
        description={
          company
            ? `Frister og avtaler for ${company.name}.`
            : 'Servicefrister, avtalt service og kontroller hos alle kundene.'
        }
        actions={
          company ? (
            <Link href={`/admin/selskap/${company.id}/kunde`} className="pt-btn pt-btn-ghost">
              Vis som kunde
            </Link>
          ) : undefined
        }
      />

      <form method="get" action="/admin/kalender" className="pt-cal-filter" style={{ marginBottom: '1.25rem' }}>
        <input type="hidden" name="mnd" value={month} />
        <div className="pt-field">
          <label htmlFor="cal-company">Selskap</label>
          <select id="cal-company" name="selskap" defaultValue={companyId ?? ''}>
            <option value="">Alle kunder</option>
            {(companies ?? []).map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="pt-btn pt-btn-ghost">Vis</button>
      </form>

      {overdue.length > 0 && (
        <Card title="Forfalt" description="Frister som har gått ut og ikke er fullført." flush>
          <OverdueList events={overdue} />
        </Card>
      )}

      <Card>
        <Calendar month={month} today={today} events={events} href={href} />
      </Card>
    </>
  );
}
