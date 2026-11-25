import { getDict, type Lang } from './i18n';
import { MAINTENANCE_PLAN } from './maintenance-plan';

/**
 * Sjekklistene fra brukermanualen, slik skjemaene i Min side, på lenkesiden
 * og på papir viser dem. Verdiene er de samme som enumen
 * maintenance_checklist i databasen.
 */
export const CHECKLISTS = ['quarterly', 'before_use', 'after_use'] as const;
export type ChecklistKind = (typeof CHECKLISTS)[number];

export const isChecklist = (value: unknown): value is ChecklistKind =>
  typeof value === 'string' && (CHECKLISTS as readonly string[]).includes(value);

/** Punktene på én sjekkliste, på riktig språk. */
export function checklistItems(lang: Lang, kind: ChecklistKind): string[] {
  const c = getDict(lang).guide.checklists;
  const months = MAINTENANCE_PLAN.testAfterMonths;
  if (kind === 'before_use') return c.before.items(months);
  if (kind === 'after_use') return [...c.after.items];
  return c.quarterly.items(months);
}

/** Navnet på kontrollen, f.eks. «Kvartalsvis kontroll». */
export function checklistTitle(lang: Lang, kind: ChecklistKind): string {
  return getDict(lang).maintenanceForm.kinds[kind];
}

/**
 * Tittelen loggføringen får i historikken. Alltid norsk, som resten av
 * portalen, og lik den submit_maintenance_via_link() setter.
 */
export function checklistLogTitle(kind: ChecklistKind): string {
  return checklistTitle('no', kind);
}

/**
 * Bygger punktene som lagres: teksten slik den ble vist, og om den ble huket
 * av. Klienten sender bare avkrysningene, så teksten kan ikke byttes ut.
 */
export function checklistPayload(lang: Lang, kind: ChecklistKind, checked: unknown): { label: string; checked: boolean }[] {
  const flags = Array.isArray(checked) ? checked : [];
  return checklistItems(lang, kind).map((label, index) => ({ label, checked: flags[index] === true }));
}

/** Ett skjema for utskrift: tittel og punkter. */
export type PrintSheet = { kind: ChecklistKind; title: string; items: string[] };

/** Feltene og tekstene på utskriften. */
export type SheetLabels = {
  brand: string;
  vessel: string;
  serial: string;
  date: string;
  by: string;
  signature: string;
  item: string;
  ok: string;
  deviation: string;
  remarks: string;
  footer: string;
};

/** Alle tre skjemaene, klare til å sendes til ChecklistPrint. */
export function printSheets(lang: Lang): PrintSheet[] {
  const sheet = getDict(lang).guide.sheet;
  return CHECKLISTS.map((kind) => ({
    kind,
    title: sheet.title(checklistTitle(lang, kind)),
    items: checklistItems(lang, kind),
  }));
}

export function sheetLabels(lang: Lang): SheetLabels {
  const s = getDict(lang).guide.sheet;
  return {
    brand: 'NorthWestCoast · Argostep',
    vessel: s.vessel,
    serial: s.serial,
    date: s.date,
    by: s.by,
    signature: s.signature,
    item: s.item,
    ok: s.ok,
    deviation: s.deviation,
    remarks: s.remarks,
    footer: s.footer,
  };
}
