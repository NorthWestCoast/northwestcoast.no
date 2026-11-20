import Link from 'next/link';

/**
 * Plassering av utstyr: en leider eller et oppbevaringsskap står på et
 * fartøy, i et prosjekt (kai, anlegg på land), begge deler eller ingen av
 * delene. Her ligger visningen og skjemafeltene som er felles for Min side
 * og admin.
 */

/** Et valg i en nedtrekksliste. `group` samler valgene per kunde (admin). */
export type PlaceOption = { id: string; name: string; group?: string | null };

/** Hvor utstyret står, med lenker. Uten plassering vises `empty`. */
export function Place({
  vesselId,
  vesselName,
  projectId,
  projectName,
  empty = 'Ikke plassert',
}: {
  vesselId?: string | null;
  vesselName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  empty?: React.ReactNode;
}) {
  if (!vesselId && !projectId) return <span className="pt-muted">{empty}</span>;

  return (
    <>
      {vesselId && <Link href={`/minside/fartoy/${vesselId}`}>{vesselName ?? 'Fartøy'}</Link>}
      {vesselId && projectId && ' · '}
      {/* Mannskap med tilgang bare til fartøyet ser ikke prosjektet (RLS),
          og da finnes det verken navn eller side å lenke til. */}
      {projectId && (projectName
        ? <Link href={`/minside/prosjekter/${projectId}`}>{projectName}</Link>
        : <span className="pt-muted">Prosjekt</span>)}
    </>
  );
}

/** Samme som Place, som ren tekst (til beskrivelser og nedtrekkslister). */
export function placeText(vesselName?: string | null, projectName?: string | null): string | null {
  return [vesselName, projectName].filter(Boolean).join(' · ') || null;
}

function Options({ options }: { options: PlaceOption[] }) {
  const groups = new Map<string, PlaceOption[]>();
  for (const option of options) {
    const key = option.group ?? '';
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }
  // Uten grupper (kundens egne lister) vises valgene rett i lista.
  if (groups.size === 1 && groups.has('')) {
    return options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>);
  }
  return [...groups.entries()].map(([group, items]) => (
    <optgroup key={group} label={group || 'Uten kunde'}>
      {items.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
    </optgroup>
  ));
}

/**
 * Feltene for plassering: fartøy, prosjekt, dato og eventuelt nøyaktig sted.
 * Feltnavn: vessel_id, project_id, installed_at, location_note.
 *
 * Lister som er tomme vises ikke. Den som kaller sørger for at minst én av
 * dem har innhold.
 */
export function PlacementFields({
  scope,
  vessels,
  projects,
  vesselId,
  projectId,
  date,
  maxDate,
  dateLabel,
  dateHint,
  dateRequired = true,
  location,
}: {
  scope: string;
  vessels: PlaceOption[];
  projects: PlaceOption[];
  vesselId?: string | null;
  projectId?: string | null;
  /** Forhåndsutfylt dato (ÅÅÅÅ-MM-DD). */
  date?: string | null;
  maxDate?: string;
  dateLabel: string;
  dateHint?: string;
  dateRequired?: boolean;
  /** Vis feltet for nøyaktig sted (skap). `value` er gjeldende tekst. */
  location?: { value: string | null };
}) {
  const columns = (vessels.length > 0 ? 1 : 0) + (projects.length > 0 ? 1 : 0) + 1;

  return (
    <>
      <div className={columns === 3 ? 'pt-form-row pt-form-row-3' : 'pt-form-row'}>
        {vessels.length > 0 && (
          <div className="pt-field">
            <label htmlFor={`${scope}-vessel`}>Fartøy</label>
            <select id={`${scope}-vessel`} name="vessel_id" defaultValue={vesselId ?? ''}>
              <option value="">Ikke på et fartøy</option>
              <Options options={vessels} />
            </select>
          </div>
        )}
        {projects.length > 0 && (
          <div className="pt-field">
            <label htmlFor={`${scope}-project`}>Prosjekt</label>
            <select id={`${scope}-project`} name="project_id" defaultValue={projectId ?? ''}>
              <option value="">Ikke i et prosjekt</option>
              <Options options={projects} />
            </select>
          </div>
        )}
        <div className="pt-field">
          <label htmlFor={`${scope}-date`}>{dateLabel}</label>
          <input
            id={`${scope}-date`}
            name="installed_at"
            type="date"
            defaultValue={date ?? ''}
            max={maxDate}
            required={dateRequired}
          />
          {dateHint && <small>{dateHint}</small>}
        </div>
      </div>
      {location && (
        <div className="pt-field">
          <label htmlFor={`${scope}-location`}>Nøyaktig sted (valgfritt)</label>
          <input
            id={`${scope}-location`}
            name="location_note"
            maxLength={200}
            defaultValue={location.value ?? ''}
            placeholder="F.eks. akterdekk babord side, eller ved landgangen på kaia"
          />
        </div>
      )}
    </>
  );
}
