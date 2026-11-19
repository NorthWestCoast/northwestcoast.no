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

/** Dato og klokkeslett på norsk: «19.11.2026 kl. 08:15». */
export function datoTid(value: string | null | undefined): string {
  if (!value) return '–';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '–';
  const date = parsed.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Oslo' });
  const time = parsed.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' });
  return `${date} kl. ${time}`;
}

/** Dagens dato som YYYY-MM-DD i norsk tid (til <input type="date">). */
export function idag(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
}
