import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isoWeek, monthGrid, shiftMonth, type CalendarEvent } from '@/lib/portal/calendar';

const WEEKDAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const SHOWN_PER_DAY = 3;

const monthName = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const dayName = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/**
 * Månedskalender. Ren servervisning: bla med lenker (?mnd=ÅÅÅÅ-MM), ingen
 * JavaScript. På smale skjermer vises en liste dag for dag i stedet for
 * rutenettet.
 *
 * `href(month)` lager adressen til en annen måned, med de andre valgene
 * (f.eks. selskap) beholdt.
 */
export default function Calendar({
  month,
  today,
  events,
  href,
}: {
  month: string;
  today: string;
  events: CalendarEvent[];
  href: (month: string) => string;
}) {
  const { days } = monthGrid(month);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = byDay.get(event.date);
    if (list) list.push(event);
    else byDay.set(event.date, [event]);
  }

  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const inMonth = (iso: string) => iso.startsWith(month);
  const agendaDays = days.filter((day) => inMonth(day) && byDay.has(day));
  const thisMonth = today.slice(0, 7);

  return (
    <div className="pt-cal">
      <div className="pt-cal-head">
        <Link href={href(shiftMonth(month, -1))} className="pt-btn pt-btn-ghost pt-btn-sm" aria-label="Forrige måned">
          <ChevronLeft size={18} aria-hidden="true" />
        </Link>
        <h2>{monthName(month)}</h2>
        <Link href={href(shiftMonth(month, 1))} className="pt-btn pt-btn-ghost pt-btn-sm" aria-label="Neste måned">
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
        {month !== thisMonth && (
          <Link href={href(thisMonth)} className="pt-btn pt-btn-ghost pt-btn-sm">I dag</Link>
        )}
      </div>

      <table className="pt-cal-grid">
        <caption className="sr-only">Frister og avtaler i {monthName(month)}</caption>
        <thead>
          <tr>
            <th scope="col" className="pt-cal-week"><abbr title="Ukenummer">Uke</abbr></th>
            {WEEKDAYS.map((name) => (
              <th scope="col" key={name}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              <th scope="row" className="pt-cal-week">{isoWeek(week[0])}</th>
              {week.map((day) => {
                const list = byDay.get(day) ?? [];
                return (
                  <td
                    key={day}
                    className="pt-cal-day"
                    data-outside={inMonth(day) ? undefined : 'true'}
                    data-today={day === today ? 'true' : undefined}
                  >
                    <span className="pt-cal-date">{Number(day.slice(8, 10))}</span>
                    {list.length > 0 && (
                      <ul>
                        {list.slice(0, SHOWN_PER_DAY).map((event) => (
                          <li key={event.key}>
                            <Link
                              href={event.href}
                              className="pt-cal-event"
                              data-tone={event.tone}
                              data-projected={event.projected ? 'true' : undefined}
                              title={`${event.title}${event.projected ? ' (planlagt)' : ''}\n${event.detail}`}
                            >
                              <strong>{event.title}</strong>
                              <span>{event.detail}</span>
                            </Link>
                          </li>
                        ))}
                        {list.length > SHOWN_PER_DAY && (
                          <li className="pt-cal-more">+{list.length - SHOWN_PER_DAY} til</li>
                        )}
                      </ul>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pt-cal-agenda">
        {agendaDays.length > 0 ? (
          <ol>
            {agendaDays.map((day) => (
              <li key={day} data-today={day === today ? 'true' : undefined}>
                <h3>{dayName(day)}</h3>
                <ul>
                  {(byDay.get(day) ?? []).map((event) => (
                    <li key={event.key}>
                      <Link
                        href={event.href}
                        className="pt-cal-event"
                        data-tone={event.tone}
                        data-projected={event.projected ? 'true' : undefined}
                      >
                        <strong>{event.title}{event.projected ? ' (planlagt)' : ''}</strong>
                        <span>{event.detail}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <p className="pt-hint">Ingen frister eller avtaler i {monthName(month)}.</p>
        )}
      </div>

      <ul className="pt-cal-legend" aria-label="Forklaring">
        <li data-tone="danger">Forfalt</li>
        <li data-tone="warn">Frist snart</li>
        <li data-tone="ok">Avtalt service</li>
        <li data-tone="info">Kontroll fra manualen</li>
        <li data-projected="true">Planlagt</li>
      </ul>
    </div>
  );
}

/** Liste over det som er forfalt, uansett måned. Vises over kalenderen. */
export function OverdueList({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;
  return (
    <ul className="pt-list">
      {events.slice(0, 20).map((event) => (
        <li key={event.key}>
          <div className="pt-list-main">
            <Link href={event.href}>{event.title}</Link>
            <div className="pt-list-sub">{event.detail}</div>
          </div>
          <div className="pt-list-side">
            <span className="pt-badge" data-tone="danger">
              Frist {new Date(`${event.date}T00:00:00Z`).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}
            </span>
          </div>
        </li>
      ))}
      {events.length > 20 && <li className="pt-list-sub">og {events.length - 20} til</li>}
    </ul>
  );
}
