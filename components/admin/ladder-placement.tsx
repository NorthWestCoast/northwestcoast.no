import { Disclosure } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { PlacementFields } from '@/components/portal/placement';
import type { PortalSupabase } from '@/components/minside/util';
import { assignLadder } from '@/app/(portal)/admin/actions';
import { Hidden, Select } from './fields';
import { loadAdminPlaces } from './placement-options';

/**
 * Admin: knytt leideren til en kunde og et sted. En leider kan stå på et
 * fartøy, i et prosjekt (kai, anlegg på land), begge deler eller ingen av
 * delene. Brukes i administrasjonspanelet på leidersiden.
 */
export default async function LadderPlacement({ supabase, ladderId }: { supabase: PortalSupabase; ladderId: string }) {
  const { data: ladder } = await supabase
    .from('ladders')
    .select('id, company_id, vessel_id, project_id, installed_at')
    .eq('id', ladderId)
    .maybeSingle();
  if (!ladder) return null;

  const places = await loadAdminPlaces(supabase, ladder.project_id);

  return (
    <Disclosure summary="Kunde og plassering">
      <PortalForm action={assignLadder} submitLabel="Lagre kunde og plassering" resetOnSuccess={false}>
        {/* exact: skjemaet viser plasseringen som er, så tomme felt betyr «ta ned». */}
        <Hidden fields={{ ladder_id: ladder.id, exact: 'true' }} />
        <Select scope="adm-move" name="company_id" label="Selskap" defaultValue={ladder.company_id ?? ''}>
          <option value="">Ikke valgt</option>
          {places.companies.map((company) => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </Select>
        <PlacementFields
          scope="adm-move"
          vessels={places.vessels}
          projects={places.projects}
          vesselId={ladder.vessel_id}
          projectId={ladder.project_id}
          date={ladder.installed_at}
          dateLabel="Tatt i bruk"
          dateRequired={false}
        />
        <p className="pt-hint">
          Skjemaet viser hvor leideren står nå. Velg fartøy, prosjekt eller begge, så følger selskapet med.
          Uten fartøy og prosjekt tas leideren ned og blir stående hos selskapet. Med dato regnes leideren som
          i bruk, og servicefristen løper fra datoen. Uten dato er den levert, men ikke tatt i bruk.
        </p>
      </PortalForm>
    </Disclosure>
  );
}
