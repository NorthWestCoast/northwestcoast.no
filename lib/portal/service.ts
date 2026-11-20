/**
 * Frist for neste service når rapporten ikke oppgir en: utført dato pluss
 * leiderens serviceintervall. Samme regel som ladder_status bruker.
 *
 * Brukes både av skjemaet (forslag til «gyldig til» på sertifikatet) og av
 * handlingen som lagrer rapporten, så de to aldri regner ulikt.
 */
export function nextServiceDue(performedAt: string, intervalMonths: number): string {
  const due = new Date(`${performedAt}T00:00:00Z`);
  due.setUTCMonth(due.getUTCMonth() + intervalMonths);
  return due.toISOString().slice(0, 10);
}
