import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/portal/context';
import { Card, PageHeader } from '@/components/portal/ui';
import CustomerDashboard from '@/components/minside/dashboard';
import Calendar, { OverdueList } from '@/components/portal/calendar';
import { loadCalendar, monthGrid, parseMonth } from '@/lib/portal/calendar';
import { uuid } from '@/lib/portal/forms';
import { idag } from '@/lib/format';

export const metadata: Metadata = { title: 'Vis som kunde' };

/**
 * «Vis som kunde»: oversikten og kalenderen slik selskapet ser dem i Min side.
 *
 * Bare lesing, og ingen innlogging som kunden: siden bruker administratorens
 * egen sesjon og avgrenser alt til selskapet. Til demo på møter og når en
 * kunde ringer og spør hva de ser.
 */
export default async function VisSomKundePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mnd?: string | string[] }>;
}) {
  const { id: rawId } = await params;
  const query = await searchParams;
  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase } = await requireAdmin(`/admin/selskap/${id}/kunde`);

  const { data: company } = await supabase.from('companies').select('id, name').eq('id', id).maybeSingle();
  if (!company) notFound();

  const today = idag();
  const month = parseMonth(query.mnd, today);
  const { from, to } = monthGrid(month);
  const { events, overdue } = await loadCalendar(supabase, { from, to, today, companyId: company.id });

  return (
    <>
      <div className="pt-preview-banner" role="note">
        <p>
          <strong>Vis som kunde.</strong> Slik ser {company.name} oversikten og kalenderen i Min side. Bare lesing.
          Lenkene til leiderne virker; lister som ville vist alle kundene, er ikke lenket.
        </p>
        <Link href={`/admin/selskap/${company.id}`} className="pt-btn pt-btn-ghost pt-btn-sm">Tilbake til selskapet</Link>
      </div>

      <PageHeader
        title="Oversikt"
        description={`Min side for ${company.name}.`}
        crumbs={[
          { href: '/admin/selskap', label: 'Selskap' },
          { href: `/admin/selskap/${company.id}`, label: company.name },
          { label: 'Vis som kunde' },
        ]}
      />

      <CustomerDashboard supabase={supabase} companyId={company.id} preview />

      <PageHeader title="Kalender" description="Servicefrister, avtalt service og kontroller på leiderne." />

      {overdue.length > 0 && (
        <Card title="Forfalt" description="Frister som har gått ut og ikke er fullført." flush>
          <OverdueList events={overdue} />
        </Card>
      )}

      <Card id="kalender">
        <Calendar
          month={month}
          today={today}
          events={events}
          href={(target) => `/admin/selskap/${company.id}/kunde?mnd=${target}#kalender`}
        />
      </Card>
    </>
  );
}
