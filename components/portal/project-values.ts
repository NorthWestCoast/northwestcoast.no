import { optional, text } from '@/lib/portal/forms';
import { PROJECT_KINDS } from '@/lib/portal/labels';

/** Leser og kontrollerer feltene fra components/portal/project-fields.tsx. */
export type ProjectValues = {
  name: string;
  kind: string;
  location: string | null;
  description: string | null;
};

export function readProject(formData: FormData): { error: string } | { error: null; values: ProjectValues } {
  const name = text(formData.get('name'), 160);
  if (name.length < 2) return { error: 'Skriv inn et navn på prosjektet.' };

  const kind = text(formData.get('kind'), 20);
  if (!PROJECT_KINDS.includes(kind)) return { error: 'Velg hva slags prosjekt det er.' };

  return {
    error: null,
    values: {
      name,
      kind,
      location: optional(formData.get('location'), 160),
      description: optional(formData.get('description'), 2000),
    },
  };
}
