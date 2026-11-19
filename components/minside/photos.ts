export type UploadedPhoto = { path: string; captured_at: string | null };

const FILE_NAME = /^[A-Za-z0-9._-]{1,80}$/;

/**
 * Leser listen PhotoUploader sender (`photos`: JSON med { path, captured_at }).
 *
 * Bare stier i den oppgitte mappen godtas, så en action aldri kan knytte en
 * rad til en fil som hører til noe annet. Tidspunkt fram i tid settes til nå.
 */
export function parseUploadedPhotos(value: FormDataEntryValue | null, folder: string, max = 12): UploadedPhoto[] {
  if (typeof value !== 'string' || value.length > 20_000) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const prefix = `${folder}/`;
  const seen = new Set<string>();
  const photos: UploadedPhoto[] = [];

  for (const item of parsed) {
    if (photos.length >= max) break;
    if (!item || typeof item !== 'object') continue;

    const { path, captured_at: capturedAt } = item as { path?: unknown; captured_at?: unknown };
    if (typeof path !== 'string' || !path.startsWith(prefix)) continue;
    if (!FILE_NAME.test(path.slice(prefix.length)) || seen.has(path)) continue;
    seen.add(path);

    let captured: string | null = null;
    if (typeof capturedAt === 'string') {
      const time = Date.parse(capturedAt);
      if (!Number.isNaN(time)) captured = new Date(Math.min(time, Date.now())).toISOString();
    }
    photos.push({ path, captured_at: captured });
  }
  return photos;
}
