import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { managedCompanies, requireUser } from '@/lib/portal/context';
import { Badge, PageHeader, Tabs } from '@/components/portal/ui';
import { uuid } from '@/lib/portal/forms';
import { ladderStatus, serviceState } from '@/lib/portal/labels';
import type { LadderView } from '@/components/minside/util';
import Oversikt from './_sections/oversikt';
import Historikk from './_sections/historikk';
import Plan from './_sections/plan';
import Deling from './_sections/deling';
import Tilgang from './_sections/tilgang';

export const metadata: Metadata = { title: 'Leider' };

const FANER = ['oversikt', 'historikk', 'plan', 'deling', 'tilgang'] as const;
type Fane = (typeof FANER)[number];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Leidersiden: alt som gjelder én fysisk leider, delt i faner. Hver fane er
 * en egen URL (?fane=), så lenker fra varsler og oversikten treffer riktig.
 */
export default async function LeiderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fane?: string | string[]; type?: string | string[] }>;
}) {
  const { id: rawId } = await params;
  const query = await searchParams;

  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase, ctx } = await requireUser(`/minside/leider/${id}`);

  // RLS: en leider brukeren ikke har tilgang til finnes ikke for henne.
  const { data: row } = await supabase.from('ladder_status').select('*').eq('ladder_id', id).maybeSingle();
  if (!row?.ladder_id) notFound();
  const ladder: LadderView = { ...row, ladder_id: row.ladder_id };

  const [{ data: vesselRole }, { data: ladderRole }] = await Promise.all([
    ladder.vessel_id
      ? supabase.from('vessel_members').select('role').eq('vessel_id', ladder.vessel_id).eq('user_id', ctx.userId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('ladder_members').select('role').eq('ladder_id', id).eq('user_id', ctx.userId).maybeSingle(),
  ]);

  // Styrer bare hva som vises. Databasen gjør den samme vurderingen selv.
  const canManage =
    ctx.staffRole === 'admin' ||
    managedCompanies(ctx).some((company) => company.id === ladder.company_id) ||
    vesselRole?.role === 'master' ||
    ladderRole?.role === 'manager';

  const requested = first(query.fane);
  const fane: Fane = FANER.find((f) => f === requested) ?? 'oversikt';

  const base = `/minside/leider/${id}`;
  const href = (f: Fane) => (f === 'oversikt' ? base : `${base}?fane=${f}`);
  const status = ladderStatus(ladder.status);
  const service = serviceState(ladder.service_state);
  const props = { supabase, ctx, ladder, canManage };

  return (
    <>
      <PageHeader
        title={`Leider ${ladder.serial_number ?? ''}`}
        description={
          // Fartøyet og/eller prosjektet leideren står i; ellers eieren.
          [ladder.product_name, ladder.vessel_name, ladder.project_name, ladder.vessel_name || ladder.project_name ? null : ladder.company_name]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        crumbs={[
          { href: '/minside/leidere', label: 'Leidere' },
          { label: ladder.serial_number ?? 'Leider' },
        ]}
        badge={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            {ladder.status === 'installed' && <Badge tone={service.tone}>{service.label}</Badge>}
          </>
        }
      />

      <Tabs
        current={href(fane)}
        items={[
          { href: href('oversikt'), label: 'Oversikt' },
          { href: href('historikk'), label: 'Historikk' },
          { href: href('plan'), label: 'Service og oppgaver' },
          { href: href('deling'), label: 'Deling' },
          { href: href('tilgang'), label: 'Tilgang' },
        ]}
      />

      {fane === 'oversikt' && <Oversikt {...props} />}
      {fane === 'historikk' && <Historikk {...props} type={first(query.type)} />}
      {fane === 'plan' && <Plan {...props} />}
      {fane === 'deling' && <Deling {...props} />}
      {fane === 'tilgang' && <Tilgang {...props} />}
    </>
  );
}
