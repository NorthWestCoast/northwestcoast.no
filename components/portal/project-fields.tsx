import { PROJECT_KINDS, projectKind } from '@/lib/portal/labels';
import type { Tables } from '@/lib/supabase/database.types';

type Project = Pick<Tables<'projects'>, 'name' | 'kind' | 'location' | 'description'>;

/**
 * Feltene for et prosjekt: et sted eller oppdrag som ikke er et fartøy.
 * Brukes ved opprettelse og redigering, på Min side og i admin. Leses på
 * serveren med readProject() i project-values.ts.
 */
export default function ProjectFields({ scope, project }: { scope: string; project?: Project }) {
  return (
    <>
      <div className="pt-form-row pt-form-row-3">
        <div className="pt-field">
          <label htmlFor={`${scope}-name`}>Navn</label>
          <input
            id={`${scope}-name`}
            name="name"
            required
            minLength={2}
            maxLength={160}
            defaultValue={project?.name ?? ''}
            placeholder="F.eks. Skansekaia"
          />
        </div>
        <div className="pt-field">
          <label htmlFor={`${scope}-kind`}>Type</label>
          <select id={`${scope}-kind`} name="kind" defaultValue={project?.kind ?? 'quay'}>
            {PROJECT_KINDS.map((kind) => (
              <option key={kind} value={kind}>{projectKind(kind).label}</option>
            ))}
          </select>
        </div>
        <div className="pt-field">
          <label htmlFor={`${scope}-location`}>Sted</label>
          <input
            id={`${scope}-location`}
            name="location"
            maxLength={160}
            defaultValue={project?.location ?? ''}
            placeholder="F.eks. Ålesund"
          />
        </div>
      </div>
      <div className="pt-field">
        <label htmlFor={`${scope}-description`}>Beskrivelse (valgfritt)</label>
        <textarea
          id={`${scope}-description`}
          name="description"
          maxLength={2000}
          defaultValue={project?.description ?? ''}
          placeholder="Hva utstyret brukes til, og hvem som har ansvaret på stedet"
        />
      </div>
    </>
  );
}
