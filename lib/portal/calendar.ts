import type { PortalSupabase } from '@/components/minside/util';
import { addDays } from '@/components/minside/util';
import { CERTIFICATE_NAME, type Tone } from '@/lib/portal/labels';

/**
 * Det kalenderen viser: frister og avtaler på leiderne, hentet fra der de
 * allerede ligger.
 *
 * - servicefrister (ladder_status.next_service_due)
 * - avtalt og ønsket service (service_bookings)
 * - åpne oppgaver, også de faste kontrollene fra brukermanualen
 *   (ladder_tasks). Oppgaver som gjentar seg, vises også framover som
 *   «planlagt», selv om bare neste forekomst finnes i databasen.
 * - servicesertifikater som går ut (ladder_certificates)
 * - lenker for registrering som går ut (maintenance_links, bare for dem som
 *   forvalter leideren)
 *
 * Tilgangsreglene avgjør hva som kommer med. Med `companyId` avgrenses alt
 * til ett selskap: brukes av admin (filter og «Vis som kunde»), der
 * reglene ellers gir alle kundene.
 */

export type CalendarKind = 'service' | 'booking' | 'task' | 'certificate' | 'link';

export type CalendarEvent = {
  key: string;
  /** ÅÅÅÅ-MM-DD */
  date: string;
  kind: CalendarKind;
  title: string;
  /** Leideren og hvor den står, f.eks. «DEMO-2025-0001 · MS Demo Havørn». */
  detail: string;
  href: string;
  tone: Tone;
  /** Senere forekomst av en oppgave som gjentar seg. Finnes ikke ennå. */
  projected?: boolean;
};

export type CalendarData = {
  events: CalendarEvent[];
  /** Frister som har gått ut, uansett måned: forfalt service og oppgaver. */
  overdue: CalendarEvent[];
};

/** Brukes når et selskap ikke har noen leidere, så `in` ikke blir tom. */
const NO_LADDER = '00000000-0000-0000-0000-000000000000';

const addMonths = (iso: string, months: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
};

const ladderHref = (id: string, fane: string, hash = '') => `/minside/leider/${id}?fane=${fane}${hash}`;

export async function loadCalendar(
  supabase: PortalSupabase,
  {
    from,
    to,
    today,
    companyId,
    showCompany = false,
  }: {
    from: string;
    to: string;
    today: string;
    companyId?: string | null;
    /** Ta med selskapet i teksten (admin uten filter). */
    showCompany?: boolean;
  },
): Promise<CalendarData> {
  let ladderQuery = supabase
    .from('ladder_status')
    .select('ladder_id, serial_number, vessel_name, project_name, company_name, next_service_due, service_state, status')
    .neq('status', 'retired')
    .limit(2000);
  if (companyId) ladderQuery = ladderQuery.eq('company_id', companyId);
  const { data: ladderRows } = await ladderQuery;

  const ladders = (ladderRows ?? []).filter((row): row is typeof row & { ladder_id: string } => Boolean(row.ladder_id));
  const ids = ladders.map((row) => row.ladder_id);
  const scoped = companyId ? (ids.length ? ids : [NO_LADDER]) : null;

  let taskQuery = supabase
    .from('ladder_tasks')
    .select('id, title, kind, due_date, ladder_id, recurrence_months, auto')
    .eq('status', 'open')
    .lte('due_date', to)
    .order('due_date')
    .limit(1000);
  let bookingQuery = supabase
    .from('service_bookings')
    .select('id, ladder_id, status, preferred_date, scheduled_date')
    .in('status', ['requested', 'scheduled'])
    .limit(500);
  let certificateQuery = supabase
    .from('ladder_certificates')
    .select('id, ladder_id, certificate_number, valid_until')
    .is('revoked_at', null)
    .is('replaced_by', null)
    .gte('valid_until', from)
    .lte('valid_until', to)
    .limit(500);
  let linkQuery = supabase
    .from('maintenance_links')
    .select('id, ladder_id, recipient, expires_at')
    .is('revoked_at', null)
    .gte('expires_at', `${from}T00:00:00Z`)
    .lte('expires_at', `${to}T23:59:59Z`)
    .limit(500);

  if (scoped) {
    taskQuery = taskQuery.in('ladder_id', scoped);
    bookingQuery = bookingQuery.in('ladder_id', scoped);
    certificateQuery = certificateQuery.in('ladder_id', scoped);
    linkQuery = linkQuery.in('ladder_id', scoped);
  }

  const [{ data: tasks }, { data: bookings }, { data: certificates }, { data: links }] = await Promise.all([
    taskQuery,
    bookingQuery,
    certificateQuery,
    linkQuery,
  ]);

  const info = new Map(
    ladders.map((row) => [
      row.ladder_id,
      [row.serial_number, row.vessel_name ?? row.project_name, showCompany ? row.company_name : null]
        .filter(Boolean)
        .join(' · '),
    ]),
  );
  // Oppgaver og avtaler på leidere utenfor utvalget (utrangert, eller et
  // annet selskap) tas ikke med.
  const known = (id: string) => info.has(id);
  const detailOf = (id: string) => info.get(id) ?? '';
  const inRange = (date: string) => date >= from && date <= to;

  const events: CalendarEvent[] = [];
  const overdue: CalendarEvent[] = [];

  for (const ladder of ladders) {
    const due = ladder.next_service_due;
    if (!due) continue;
    const late = due < today;
    const event: CalendarEvent = {
      key: `service-${ladder.ladder_id}`,
      date: due,
      kind: 'service',
      title: 'Servicefrist',
      detail: detailOf(ladder.ladder_id),
      href: ladderHref(ladder.ladder_id, 'plan'),
      tone: late ? 'danger' : ladder.service_state === 'due_soon' ? 'warn' : 'neutral',
    };
    if (inRange(due)) events.push(event);
    if (late) overdue.push(event);
  }

  for (const task of tasks ?? []) {
    if (!known(task.ladder_id)) continue;
    const late = task.due_date < today;
    const event: CalendarEvent = {
      key: `task-${task.id}`,
      date: task.due_date,
      kind: 'task',
      title: task.title,
      detail: detailOf(task.ladder_id),
      href: task.auto === 'quarterly_inspection' && !late
        ? ladderHref(task.ladder_id, 'registrer')
        : ladderHref(task.ladder_id, 'plan'),
      tone: late ? 'danger' : task.auto ? 'info' : 'neutral',
    };
    if (inRange(task.due_date)) events.push(event);
    if (late) overdue.push(event);

    // Senere forekomster innenfor perioden, slik de blir hvis kontrollen
    // gjøres på fristen.
    if (task.recurrence_months && task.recurrence_months > 0) {
      for (let step = 1; step <= 60; step += 1) {
        const date = addMonths(task.due_date, task.recurrence_months * step);
        if (date > to) break;
        if (date < from || date < today) continue;
        events.push({ ...event, key: `${event.key}-${step}`, date, tone: 'neutral', projected: true });
      }
    }
  }

  for (const booking of bookings ?? []) {
    if (!known(booking.ladder_id)) continue;
    const scheduled = booking.status === 'scheduled';
    const date = scheduled ? booking.scheduled_date : booking.preferred_date;
    if (!date || !inRange(date)) continue;
    events.push({
      key: `booking-${booking.id}`,
      date,
      kind: 'booking',
      title: scheduled ? 'Avtalt service' : 'Ønsket service',
      detail: detailOf(booking.ladder_id),
      href: ladderHref(booking.ladder_id, 'plan'),
      tone: scheduled ? 'ok' : 'info',
    });
  }

  for (const certificate of certificates ?? []) {
    if (!known(certificate.ladder_id)) continue;
    events.push({
      key: `certificate-${certificate.id}`,
      date: certificate.valid_until,
      kind: 'certificate',
      title: `${CERTIFICATE_NAME} går ut`,
      detail: [detailOf(certificate.ladder_id), certificate.certificate_number].filter(Boolean).join(' · '),
      href: ladderHref(certificate.ladder_id, 'historikk', '#sertifikat'),
      tone: 'warn',
    });
  }

  for (const link of links ?? []) {
    if (!known(link.ladder_id)) continue;
    events.push({
      key: `link-${link.id}`,
      date: link.expires_at.slice(0, 10),
      kind: 'link',
      title: 'Lenke for registrering går ut',
      detail: [detailOf(link.ladder_id), link.recipient].filter(Boolean).join(' · '),
      href: ladderHref(link.ladder_id, 'registrer', '#lenker'),
      tone: 'neutral',
    });
  }

  const order: Record<CalendarKind, number> = { service: 0, booking: 1, task: 2, certificate: 3, link: 4 };
  const byDate = (a: CalendarEvent, b: CalendarEvent) =>
    a.date.localeCompare(b.date) || order[a.kind] - order[b.kind] || a.detail.localeCompare(b.detail);

  return { events: events.sort(byDate), overdue: overdue.sort(byDate) };
}

/* ── Måneder ─────────────────────────────────────────────────────────────── */

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Måneden i adressen (?mnd=2026-12), eller måneden i dag. */
export function parseMonth(value: string | string[] | undefined, today: string): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && MONTH.test(raw)) {
    const year = Number(raw.slice(0, 4));
    if (year >= 2000 && year <= 2100) return raw;
  }
  return today.slice(0, 7);
}

export const shiftMonth = (month: string, delta: number) => addMonths(`${month}-01`, delta).slice(0, 7);

/**
 * Datoene kalenderen viser for en måned: fra mandagen i uka den 1. ligger i,
 * til søndagen i uka den siste ligger i.
 */
export function monthGrid(month: string): { from: string; to: string; days: string[] } {
  const first = `${month}-01`;
  const last = addDays(shiftMonth(month, 1) + '-01', -1);
  const weekday = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7; // mandag = 0
  const from = addDays(first, -weekday(first));
  const to = addDays(last, 6 - weekday(last));
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return { from, to, days };
}

/** ISO-ukenummer. */
export function isoWeek(iso: string): number {
  // Torsdagen i samme uke avgjør hvilket år uka hører til.
  const date = new Date(`${iso}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
}
