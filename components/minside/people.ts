import type { PortalSupabase } from './util';

export type Person = { full_name: string | null; email: string };

/**
 * Navn og e-post for en liste brukere. RLS avgjør hvem man får se: kolleger i
 * samme selskap og de man selv har gitt tilgang. Resten mangler i svaret.
 */
export async function loadPeople(supabase: PortalSupabase, userIds: string[]): Promise<Map<string, Person>> {
  const people = new Map<string, Person>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return people;

  const { data } = await supabase
    .from('profiles')
    .select('user_id, full_name, email')
    .in('user_id', unique);

  for (const row of data ?? []) {
    people.set(row.user_id, { full_name: row.full_name, email: row.email });
  }
  return people;
}

export function personName(person: Person | undefined): string {
  if (!person) return 'Ukjent bruker';
  return person.full_name?.trim() || person.email;
}
