import Link from 'next/link';
import { Badge, Td } from '@/components/portal/ui';
import { Place } from '@/components/portal/placement';
import { cabinetStatus } from '@/lib/portal/labels';
import { dato } from '@/lib/format';

/** Kolonnene tabellen trenger. Brukes i `.select(CABINET_COLUMNS)`. */
export const CABINET_COLUMNS =
  'id, serial_number, status, installed_at, location_note, company_id, vessel_id, project_id, ladder_id, products(name, product_number), vessels(name), projects(name), ladders(serial_number)';

export type CabinetRow = {
  id: string;
  serial_number: string | null;
  status: string;
  installed_at: string | null;
  location_note: string | null;
  company_id: string | null;
  vessel_id: string | null;
  project_id: string | null;
  ladder_id: string | null;
  products: { name: string; product_number: string } | null;
  vessels: { name: string } | null;
  projects: { name: string } | null;
  ladders: { serial_number: string } | null;
};

export const cabinetName = (cabinet: Pick<CabinetRow, 'products'>) => cabinet.products?.name ?? 'Oppbevaringsskap';

/** «MS Havørn · Skansekaia», «Ikke plassert» – til overskrifter og lister. */
export function cabinetPlaceText(cabinet: Pick<CabinetRow, 'vessel_id' | 'project_id' | 'vessels' | 'projects'>): string {
  if (!cabinet.vessel_id && !cabinet.project_id) return 'ikke plassert';
  return [
    cabinet.vessel_id ? cabinet.vessels?.name ?? 'fartøy' : null,
    cabinet.project_id ? cabinet.projects?.name ?? 'prosjekt' : null,
  ].filter(Boolean).join(' · ');
}

/**
 * Oppbevaringsskap i en tabell. På fartøy- og prosjektsiden (`on`) er
 * plasseringen gitt av siden, og kolonnen viser i stedet nøyaktig sted.
 */
export default function CabinetTable({ cabinets, on }: { cabinets: CabinetRow[]; on?: 'vessel' | 'project' }) {
  const placeLabel = on === 'vessel' ? 'Sted om bord' : on === 'project' ? 'Nøyaktig sted' : 'Plassering';

  return (
    <table className="pt-table">
      <thead>
        <tr>
          <th>Modell</th>
          <th>{placeLabel}</th>
          <th>Hører til leider</th>
          <th>Plassert</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {cabinets.map((cabinet) => {
          const status = cabinetStatus(cabinet.status);
          // På fartøysiden er det prosjektet som er nytt å vite, og omvendt.
          const elsewhere = on === 'vessel'
            ? { projectId: cabinet.project_id, projectName: cabinet.projects?.name }
            : on === 'project'
              ? { vesselId: cabinet.vessel_id, vesselName: cabinet.vessels?.name }
              : {
                  vesselId: cabinet.vessel_id,
                  vesselName: cabinet.vessels?.name,
                  projectId: cabinet.project_id,
                  projectName: cabinet.projects?.name,
                };
          const hasPlace = Boolean(elsewhere.vesselId || elsewhere.projectId);

          return (
            <tr key={cabinet.id}>
              <Td label="Modell" className="pt-table-strong">
                <div>
                  {cabinetName(cabinet)}
                  {cabinet.serial_number && <div className="pt-hint">Nr. {cabinet.serial_number}</div>}
                </div>
              </Td>
              <Td label={placeLabel}>
                <div>
                  {(hasPlace || !on) && <div><Place {...elsewhere} /></div>}
                  {cabinet.location_note
                    ? <div className={hasPlace || !on ? 'pt-hint' : undefined}>{cabinet.location_note}</div>
                    : on && !hasPlace && '–'}
                </div>
              </Td>
              <Td label="Hører til leider">
                {cabinet.ladder_id && cabinet.ladders ? (
                  <Link href={`/minside/leider/${cabinet.ladder_id}`}>{cabinet.ladders.serial_number}</Link>
                ) : '–'}
              </Td>
              <Td label="Plassert">{dato(cabinet.installed_at)}</Td>
              <Td label="Status"><div><Badge tone={status.tone}>{status.label}</Badge></div></Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
