/**
 * Versjonshistorikken til nyhetsinnleggene (tabellen post_revisions).
 *
 * Hver lagring blir en versjon, skrevet av en trigger i databasen. `data` er
 * hele raden slik den ble lagret; ved sletting slik den var. Her ligger det
 * admin trenger for å vise historikken: navn på handlingene og hva som ble
 * endret fra en versjon til den neste.
 */

export type RevisionAction = 'created' | 'updated' | 'deleted' | 'restored';

export type Revision = {
  id: string;
  post_id: string;
  action: string;
  data: unknown;
  restored_from: string | null;
  changed_by_name: string | null;
  changed_at: string;
};

/** Feltene i en versjon som admin viser. Alt er tekst eller null. */
export type RevisionPost = {
  slug: string;
  title_no: string;
  title_en: string | null;
  tag_no: string;
  tag_en: string;
  excerpt_no: string | null;
  excerpt_en: string | null;
  body_no: string;
  body_en: string | null;
  cover_image_url: string | null;
  status: string;
  published_at: string | null;
};

const FIELDS: { key: keyof RevisionPost; label: string }[] = [
  { key: 'title_no', label: 'tittel' },
  { key: 'title_en', label: 'engelsk tittel' },
  { key: 'slug', label: 'adresse' },
  { key: 'tag_no', label: 'stikkord' },
  { key: 'tag_en', label: 'engelsk stikkord' },
  { key: 'excerpt_no', label: 'ingress' },
  { key: 'excerpt_en', label: 'engelsk ingress' },
  { key: 'body_no', label: 'norsk tekst' },
  { key: 'body_en', label: 'engelsk tekst' },
  { key: 'cover_image_url', label: 'forsidebilde' },
  { key: 'status', label: 'status' },
  { key: 'published_at', label: 'publiseringsdato' },
];

const asText = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** Innholdet i en versjon. Felt som mangler, blir tomme. */
export function revisionPost(data: unknown): RevisionPost {
  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return {
    slug: asText(row.slug) ?? '',
    title_no: asText(row.title_no) ?? '',
    title_en: asText(row.title_en),
    tag_no: asText(row.tag_no) ?? '',
    tag_en: asText(row.tag_en) ?? '',
    excerpt_no: asText(row.excerpt_no),
    excerpt_en: asText(row.excerpt_en),
    body_no: asText(row.body_no) ?? '',
    body_en: asText(row.body_en),
    cover_image_url: asText(row.cover_image_url),
    status: asText(row.status) ?? 'draft',
    published_at: asText(row.published_at),
  };
}

/** Hva som er endret fra `before` til `after`, som en liste med feltnavn. */
export function changedFields(after: RevisionPost, before: RevisionPost | null): string[] {
  if (!before) return [];
  return FIELDS.filter(({ key }) => (after[key] ?? '') !== (before[key] ?? '')).map(({ label }) => label);
}

export const ACTION_LABEL: Record<RevisionAction, string> = {
  created: 'Opprettet',
  updated: 'Lagret',
  deleted: 'Slettet',
  restored: 'Hentet tilbake',
};

export const actionLabel = (action: string) =>
  ACTION_LABEL[action as RevisionAction] ?? 'Lagret';

/** «tittel, norsk tekst og forsidebilde». */
export function listFields(fields: string[]): string {
  if (fields.length <= 1) return fields.join('');
  return `${fields.slice(0, -1).join(', ')} og ${fields[fields.length - 1]}`;
}
