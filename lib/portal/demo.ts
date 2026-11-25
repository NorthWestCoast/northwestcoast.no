/**
 * Demovisningen: hele portalen viser bare demodataene (Demo Rederi AS), til
 * demo for kunder. Slås på i /admin/demo.
 *
 * Bryteren er en cookie med brukerens id. Så lenge den finnes, sender
 * nettlaget hodet x-nwc-demo med hvert kall til databasen
 * (lib/supabase/server.ts). Databasen avgjør selv: hodet virker bare for
 * administratorer (app.demo_view() i migrasjonen demo_view). For alle andre
 * er det uten virkning.
 *
 * Demovisningen er bare til å se på. Middleware stopper alt som sender inn et
 * skjema mens den er på (lib/supabase/middleware.ts), og databasen slipper
 * ikke gjennom endringer der heller.
 */

export const DEMO_COOKIE = 'nwc_demo';
export const DEMO_HEADER = 'x-nwc-demo';

/** Slår seg av av seg selv etter en arbeidsdag, om ingen gjør det før. */
export const DEMO_HOURS = 8;

/** Stiene som slår demovisningen av og på. De er unntatt fra sperren. */
export const DEMO_START = '/admin/demo/start';
export const DEMO_STOP = '/admin/demo/avslutt';

/** Settes på adressen når middleware har stoppet et skjema. */
export const DEMO_BLOCKED_PARAM = 'demo';
export const DEMO_BLOCKED_VALUE = 'lest';

/** Dit «Start demovisning» kan sende. Alt annet går til Min side. */
const DEMO_TARGETS = ['/minside', '/admin'] as const;

export function demoTarget(value: unknown): string {
  return DEMO_TARGETS.find((target) => target === value) ?? '/minside';
}
