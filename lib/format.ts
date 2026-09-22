/** Felles formatering for Min side og admin. */

export const nok = (value: number) => `${value.toLocaleString('nb-NO')} kr`;

/** ISO-dato (YYYY-MM-DD) til norsk format. */
export function dato(value: string | null | undefined): string {
  if (!value) return '–';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '–'
    : parsed.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** «om 12 dager» / «14 dager på overtid» – mer lesbart enn en rå dato. */
export function fristTekst(days: number | null | undefined): string {
  if (days === null || days === undefined) return 'ukjent';
  if (days < 0) return `${Math.abs(days)} dager på overtid`;
  if (days === 0) return 'forfaller i dag';
  if (days === 1) return 'om 1 dag';
  return `om ${days} dager`;
}
