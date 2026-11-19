/**
 * Søketekst fra `?q=`, ryddet så den trygt kan stå i et PostgREST-filter.
 * Tegn som styrer filteret eller mønsteret (anførselstegn, prosent, stjerne,
 * omvendt skråstrek) fjernes.
 */
export function searchTerm(value: string | undefined): string {
  return (value ?? '').replace(/["%*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/**
 * `or`-filter som leter etter teksten i flere kolonner. Verdien står i
 * anførselstegn, så komma, punktum og parenteser i søket er ufarlige.
 */
export function anyColumnMatches(columns: string[], term: string): string {
  return columns.map((column) => `${column}.ilike."%${term}%"`).join(',');
}
