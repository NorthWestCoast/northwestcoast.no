import { Card, Disclosure } from '@/components/portal/ui';
import { Place } from '@/components/portal/placement';
import { dato, idag } from '@/lib/format';
import { loadPlacementTargets, targetsFor } from '@/components/minside/placement';
import { LadderPlacementForm, LadderTakeDown } from '@/components/minside/placement-forms';
import type { SectionProps } from './types';

/**
 * Plassering: hvor leideren står, og skjemaet for å ta den i bruk, flytte den
 * eller ta den ned. En leider kan stå på et fartøy, i et prosjekt (kai,
 * anlegg på land) eller begge deler.
 *
 * Vises for dem som kan administrere leideren, når den er levert eller i bruk.
 */
export default async function Plassering({ supabase, ctx, ladder, canManage }: SectionProps) {
  if (!canManage || (ladder.status !== 'delivered' && ladder.status !== 'installed')) return null;

  const targets = await loadPlacementTargets(supabase, ctx);
  const options = targetsFor(targets, ladder.company_id, { vesselId: ladder.vessel_id, projectId: ladder.project_id });

  const placed = Boolean(ladder.vessel_id || ladder.project_id);
  const inUse = placed && ladder.status === 'installed';
  const form = (
    <LadderPlacementForm
      ladder={{
        id: ladder.ladder_id,
        status: ladder.status,
        vessel_id: ladder.vessel_id,
        project_id: ladder.project_id,
        installed_at: ladder.installed_at,
      }}
      options={options}
      today={idag()}
    />
  );

  if (!inUse) {
    return (
      <Card
        id="plassering"
        title="Plassering"
        description="Velg fartøyet eller prosjektet leideren står på. Du kan velge begge når fartøyet hører til et prosjekt."
      >
        {form}
      </Card>
    );
  }

  return (
    <Card id="plassering" title="Plassering" flush>
      <p style={{ padding: '1.1rem' }}>
        Står nå:{' '}
        <strong>
          <Place
            vesselId={ladder.vessel_id}
            vesselName={ladder.vessel_name}
            projectId={ladder.project_id}
            projectName={ladder.project_name}
          />
        </strong>
        {ladder.installed_at ? `. Tatt i bruk ${dato(ladder.installed_at)}.` : '.'}
      </p>
      <Disclosure summary="Flytt leideren">{form}</Disclosure>
      <Disclosure summary="Ta ned leideren">
        <p className="pt-hint" style={{ marginBottom: '0.75rem' }}>
          Brukes når leideren ikke lenger står på fartøyet eller i prosjektet. Den blir stående som levert til den
          plasseres på nytt. Historikken beholdes.
        </p>
        <LadderTakeDown ladderId={ladder.ladder_id} />
      </Disclosure>
    </Card>
  );
}
