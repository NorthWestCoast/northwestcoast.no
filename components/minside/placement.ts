import { managedCompanies, type PortalContext } from '@/lib/portal/context';
import type { PlaceOption } from '@/components/portal/placement';
import type { PortalSupabase } from './util';

type Vessel = { id: string; name: string; company_id: string };
type Project = { id: string; name: string; company_id: string; status: string };

export type PlacementTargets = {
  vessels: Vessel[];
  projects: Project[];
  /** Selskapene brukeren er eier eller administrator i. */
  managedCompanyIds: Set<string>;
  isAdmin: boolean;
};

/**
 * Fartøyene og prosjektene brukeren kan plassere utstyr på: selskapets eiere
 * og administratorer (fartøy og prosjekter) og skippere (eget fartøy).
 *
 * Styrer bare hva som vises. install_ladder() og place_cabinet() gjør den
 * samme vurderingen i databasen.
 */
export async function loadPlacementTargets(supabase: PortalSupabase, ctx: PortalContext): Promise<PlacementTargets> {
  const [{ data: vessels }, { data: projects }, { data: vesselRoles }] = await Promise.all([
    supabase.from('vessels').select('id, name, company_id').order('name').limit(1000),
    supabase.from('projects').select('id, name, company_id, status').order('name').limit(1000),
    supabase.from('vessel_members').select('vessel_id, role').eq('user_id', ctx.userId),
  ]);

  const isAdmin = ctx.staffRole === 'admin';
  const managedCompanyIds = new Set(managedCompanies(ctx).map((company) => company.id));
  const masterOf = new Set((vesselRoles ?? []).filter((m) => m.role === 'master').map((m) => m.vessel_id));

  return {
    vessels: (vessels ?? []).filter((v) => isAdmin || managedCompanyIds.has(v.company_id) || masterOf.has(v.id)),
    projects: (projects ?? []).filter((p) => isAdmin || managedCompanyIds.has(p.company_id)),
    managedCompanyIds,
    isAdmin,
  };
}

/**
 * Valgene for én leider eller ett skap: fartøy og prosjekter i samme selskap
 * som enheten. Avsluttede prosjekter tilbys ikke, bortsett fra det enheten
 * allerede står i.
 */
export function targetsFor(
  targets: PlacementTargets,
  companyId: string | null,
  current?: { vesselId?: string | null; projectId?: string | null },
): { vessels: PlaceOption[]; projects: PlaceOption[] } {
  const sameCompany = (id: string) => !companyId || id === companyId;
  return {
    vessels: targets.vessels
      .filter((v) => sameCompany(v.company_id) || v.id === current?.vesselId)
      .map((v) => ({ id: v.id, name: v.name })),
    projects: targets.projects
      .filter((p) => (sameCompany(p.company_id) && p.status === 'active') || p.id === current?.projectId)
      .map((p) => ({ id: p.id, name: p.name })),
  };
}
