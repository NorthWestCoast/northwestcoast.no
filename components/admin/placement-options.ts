import type { PlaceOption } from '@/components/portal/placement';
import type { PortalSupabase } from '@/components/minside/util';

/**
 * Valgene administratoren har når utstyr skal knyttes til en kunde og et
 * sted: alle selskap, og alle fartøy og prosjekter gruppert per kunde.
 * Avsluttede prosjekter tilbys ikke, bortsett fra det utstyret alt står i.
 */
export async function loadAdminPlaces(supabase: PortalSupabase, currentProjectId?: string | null) {
  const [{ data: companies }, { data: vessels }, { data: projects }] = await Promise.all([
    supabase.from('companies').select('id, name').order('name').limit(2000),
    supabase.from('vessels').select('id, name, companies(name)').order('name').limit(5000),
    supabase.from('projects').select('id, name, status, companies(name)').order('name').limit(5000),
  ]);

  const byGroup = (a: PlaceOption, b: PlaceOption) =>
    (a.group ?? '').localeCompare(b.group ?? '', 'nb') || a.name.localeCompare(b.name, 'nb');

  return {
    companies: companies ?? [],
    vessels: (vessels ?? [])
      .map((v): PlaceOption => ({ id: v.id, name: v.name, group: v.companies?.name ?? null }))
      .sort(byGroup),
    projects: (projects ?? [])
      .filter((p) => p.status === 'active' || p.id === currentProjectId)
      .map((p): PlaceOption => ({ id: p.id, name: p.name, group: p.companies?.name ?? null }))
      .sort(byGroup),
  };
}
