import { staffRoleLabel } from '@/lib/portal/labels';

/**
 * Rollene som kan velges på ansattlista, i rekkefølgen de vises. Verdiene er
 * de samme som typen staff_role i databasen; navnene kommer fra labels.ts.
 */
export const STAFF_ROLE_VALUES = ['admin', 'production', 'media'] as const;

export type StaffRoleValue = (typeof STAFF_ROLE_VALUES)[number];

/** Verdi → navn, til nedtrekkslister. */
export const STAFF_ROLE_OPTIONS: Record<StaffRoleValue, string> = {
  admin: staffRoleLabel('admin').label,
  production: staffRoleLabel('production').label,
  media: staffRoleLabel('media').label,
};

/** Hva medierollen gir tilgang til, i én setning. Står ved rollevalget. */
export const MEDIA_ACCESS =
  'Media styrer nyhetene og bildene i galleriet på nettsiden, og ser ikke kunder, bestillinger, priser eller produksjon.';
