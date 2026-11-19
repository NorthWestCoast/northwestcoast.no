import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export const BUCKETS = {
  /** Bilder til loggføringer. Mappe = loggføringens id. */
  logs: 'maintenance-photos',
  /** Bilder til delte tilstandsrapporter. Mappe = delingens id. */
  shares: 'ladder-state-photos',
  /** Servicerapporter (PDF). Mappe = leiderens id. */
  reports: 'service-reports',
  /** Offentlige bilder til nyheter og produkter. */
  media: 'public-media',
} as const;

/**
 * Signerte lenker til private bilder, gyldige i én time.
 *
 * Kalles med brukerens egen klient: lagringspolicyene avgjør hva hun får
 * signert, så en sti hun ikke har tilgang til gir bare ingen lenke.
 */
export async function signedUrls(
  supabase: SupabaseClient<Database>,
  bucket: string,
  paths: string[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return result;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, expiresIn);
  if (error) {
    console.error('[storage] Kunne ikke signere lenker:', error.message);
    return result;
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) result.set(item.path, item.signedUrl);
  }
  return result;
}

/** Offentlig adresse til en fil i public-media. */
export function publicMediaUrl(supabase: SupabaseClient<Database>, path: string): string {
  return supabase.storage.from(BUCKETS.media).getPublicUrl(path).data.publicUrl;
}
