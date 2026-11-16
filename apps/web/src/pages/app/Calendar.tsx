import { useMemo, useState } from 'react';
import { PageHead, useShell } from '../../components/AppShell';
import { IconChevronLeft, IconChevronRight } from '../../components/Icons';
import { CalendarSkeleton } from '../../components/Loading';
import { useHackathons, useMe } from '../../lib/hooks';
import { dateKey, formatClock, formatRange, localDayKey } from '../../lib/time';
import { STATUSES, STATUS_LABEL, type Hackathon } from '../../lib/types';

const WEEKDAYS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_LANES = 3;
const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const shortMonth = new Intl.DateTimeFormat(undefined, { month: 'short' });

type Deadline = { hackathon: Hackathon; label: 'Register' | 'Submit'; at: string; day: string };
/** An event bar inside one week row: columns are 0 (Mon) to 6 (Sun). */
type Bar = { hackathon: Hackathon; from: number; to: number; lane: number; continuesLeft: boolean; continuesRight: boolean };

/** Weeks covering the month, without a trailing week that is all next month. */
function monthWeeks(year: number, month: number, sundayFirst: boolean): Date[][] {
  const first = new Date(year, month, 1);
  const offset = sundayFirst ? first.getDay() : (first.getDay() + 6) % 7;
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week = Array.from({ length: 7 }, (_, d) => new Date(year, month, 1 - offset + w * 7 + d));
    if (w > 0 && week[0].getMonth() !== month) break;
    weeks.push(week);
  }
  return weeks;
}

const eventSpan = (h: Hackathon) => {
  const start = h.startDate ? dateKey(h.startDate) : h.endDate ? dateKey(h.endDate) : null;
  const end = h.endDate ? dateKey(h.endDate) : start;
  return start && end ? { start, end } : null;
};

/** Places event bars in lanes so a multi-day event keeps one row across the week. */
function layoutWeek(week: Date[], list: Hackathon[]): Bar[] {
  const keys = week.map(localDayKey);
  const bars: Omit<Bar, 'lane'>[] = [];
  for (const h of list) {
    const span = eventSpan(h);
    if (!span || span.end < keys[0] || span.start > keys[6]) continue;
    const from = keys.findIndex((k) => k >= span.start);
    let to = 6;
    while (keys[to] > span.end) to--;
    bars.push({ hackathon: h, from, to, continuesLeft: span.start < keys[0], continuesRight: span.end > keys[6] });
  }
  bars.sort((a, b) => a.from - b.from || b.to - b.from - (a.to - a.from));
  const laneEnds: number[] = [];
  return bars.map((bar) => {
    let lane = laneEnds.findIndex((end) => end < bar.from);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = bar.to;
    return { ...bar, lane };
  });
}

function deadlinesOf(list: Hackathon[]): Deadline[] {
  const out: Deadline[] = [];
  for (const h of list) {
    if (h.registrationDeadline) out.push({ hackathon: h, label: 'Register', at: h.registrationDeadline, day: localDayKey(new Date(h.registrationDeadline)) });
    if (h.submissionDeadline) out.push({ hackathon: h, label: 'Submit', at: h.submissionDeadline, day: localDayKey(new Date(h.submissionDeadline)) });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export function CalendarPage() {
  const { openEditor } = useShell();
  const query = useHackathons();
  const sundayFirst = useMe().data?.weekStart === 'SUN';
  const WEEKDAYS = sundayFirst ? WEEKDAYS_SUN : WEEKDAYS_MON;
  const weekendCols = sundayFirst ? [0, 6] : [5, 6];
  const today = new Date();
  const todayKey = localDayKey(today);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const list = useMemo(() => query.data ?? [], [query.data]);

  const weeks = useMemo(() => monthWeeks(cursor.year, cursor.month, sundayFirst), [cursor, sundayFirst]);
  const deadlines = useMemo(() => deadlinesOf(list), [list]);

  const shift = (delta: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  if (query.isPending) return <CalendarSkeleton />;
  if (query.isError) return <div className="page-error" role="alert">{query.error.message}</div>;

  const monthStart = localDayKey(new Date(cursor.year, cursor.month, 1));
  const monthEnd = localDayKey(new Date(cursor.year, cursor.month + 1, 0));
  const monthEvents = list.filter((h) => {
    const span = eventSpan(h);
    return span && span.end >= monthStart && span.start <= monthEnd;
  });
  const monthDeadlines = deadlines.filter((d) => d.day >= monthStart && d.day <= monthEnd);

  // Agenda: one row per event (on its first day in this month) and per deadline, grouped by day.
  const agendaItems = [
    ...monthEvents.map((h) => {
      const span = eventSpan(h)!;
      return { day: span.start < monthStart ? monthStart : span.start, kind: 'event' as const, hackathon: h, at: '' };
    }),
    ...monthDeadlines.map((d) => ({ day: d.day, kind: d.label, hackathon: d.hackathon, at: d.at })),
  ].sort((a, b) => a.day.localeCompare(b.day) || (a.at || '').localeCompare(b.at || ''));
  const agenda = new Map<string, typeof agendaItems>();
  for (const item of agendaItems) agenda.set(item.day, [...(agenda.get(item.day) ?? []), item]);

  const isThisMonth = cursor.year === today.getFullYear() && cursor.month === today.getMonth();
  const summary = `${monthEvents.length} ${monthEvents.length === 1 ? 'event' : 'events'}, ${monthDeadlines.length} ${monthDeadlines.length === 1 ? 'deadline' : 'deadlines'} this month.`;

  return (
    <>
      <PageHead
        title={<>{monthName.format(new Date(cursor.year, cursor.month, 1))} <span className="cal-year">{cursor.year}</span></>}
        sub={summary}
      >
        <div className="cal-nav" role="group" aria-label="Change month">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month"><IconChevronLeft /></button>
          <button type="button" className="cal-today" onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })} disabled={isThisMonth}>Today</button>
          <button type="button" onClick={() => shift(1)} aria-label="Next month"><IconChevronRight /></button>
        </div>
      </PageHead>

      <div className="cal-legend" aria-hidden="true">
        {STATUSES.map((s) => <span key={s}><i className={`dot dot-${s.toLowerCase()}`} />{STATUS_LABEL[s]}</span>)}
        <span><i className="cal-legend-deadline" />Deadline</span>
      </div>

      <div className="cal">
        <div className="cal-weekdays">{WEEKDAYS.map((d, i) => <span key={d} className={weekendCols.includes(i) ? 'is-weekend' : ''}>{d}</span>)}</div>
        {weeks.map((week) => {
          const keys = week.map(localDayKey);
          const bars = layoutWeek(week, list);
          const shownLanes = Math.min(MAX_LANES, bars.reduce((m, b) => Math.max(m, b.lane + 1), 0));
          const firstFree = 2 + shownLanes;
          return (
            <div className="cal-week" key={keys[0]}>
              <div className="cal-week-bg" aria-hidden="true">
                {week.map((d, i) => (
                  <span
                    key={keys[i]}
                    className={`${d.getMonth() !== cursor.month ? 'is-outside' : ''}${keys[i] === todayKey ? ' is-today' : ''}${weekendCols.includes(i) ? ' is-weekend' : ''}`}
                  />
                ))}
              </div>
              <div className="cal-week-fg">
                {week.map((d, i) => (
                  <span
                    key={keys[i]}
                    className={`cal-date${d.getMonth() !== cursor.month ? ' is-outside' : ''}${keys[i] === todayKey ? ' is-today' : ''}`}
                    style={{ gridColumn: i + 1, gridRow: 1 }}
                  >
                    {d.getDate() === 1 ? `${shortMonth.format(d)} 1` : d.getDate()}
                  </span>
                ))}

                {bars.filter((b) => b.lane < MAX_LANES).map((b) => (
                  <button
                    type="button"
                    key={b.hackathon.id}
                    className={`cal-bar bg-soft-${b.hackathon.status.toLowerCase()}${b.continuesLeft ? ' cont-left' : ''}${b.continuesRight ? ' cont-right' : ''}`}
                    style={{ gridColumn: `${b.from + 1} / ${b.to + 2}`, gridRow: 2 + b.lane }}
                    onClick={() => openEditor(b.hackathon)}
                    title={`${b.hackathon.name}, ${formatRange(b.hackathon.startDate, b.hackathon.endDate)}`}
                  >
                    <i className={`dot dot-${b.hackathon.status.toLowerCase()}`} />
                    <span>{b.hackathon.name}</span>
                  </button>
                ))}

                {keys.map((_, i) => {
                  const hidden = bars.filter((b) => b.lane >= MAX_LANES && b.from <= i && b.to >= i).length;
                  const due = deadlines.filter((x) => x.day === keys[i]);
                  const visible = due.slice(0, 2);
                  const more = hidden + due.length - visible.length;
                  return [
                    ...visible.map((x, j) => (
                      <button
                        type="button"
                        key={`${x.hackathon.id}-${x.label}`}
                        className={`cal-deadline${x.at < today.toISOString() ? ' is-past' : ''}`}
                        style={{ gridColumn: i + 1, gridRow: firstFree + j }}
                        onClick={() => openEditor(x.hackathon)}
                        title={`${x.label === 'Submit' ? 'Submission' : 'Registration'} closes ${formatClock(x.at)}: ${x.hackathon.name}`}
                      >
                        <b>{x.label}</b>
                        <span>{x.hackathon.name}</span>
                      </button>
                    )),
                    more > 0 ? (
                      <span key={`more-${keys[i]}`} className="cal-more" style={{ gridColumn: i + 1, gridRow: firstFree + visible.length }}>
                        +{more} more
                      </span>
                    ) : null,
                  ];
                })}
              </div>
            </div>
          );
        })}
      </div>

      <section className="panel agenda">
        <div className="agenda-head">
          <h2>Agenda</h2>
          <span className="muted">{monthName.format(new Date(cursor.year, cursor.month, 1))}</span>
        </div>
        {agenda.size ? (
          <ol className="agenda-days">
            {[...agenda.entries()].map(([day, items]) => {
              const date = new Date(`${day}T12:00:00`);
              return (
                <li key={day} className={`agenda-day${day < todayKey ? ' is-past' : ''}${day === todayKey ? ' is-today' : ''}`}>
                  <span className="agenda-date">
                    <b>{date.getDate()}</b>
                    <span>{day === todayKey ? 'Today' : weekdayFmt.format(date)}</span>
                  </span>
                  <ul>
                    {items.map((item) => (
                      <li key={item.hackathon.id + item.kind}>
                        <button type="button" onClick={() => openEditor(item.hackathon)}>
                          <i className={item.kind === 'event' ? `dot dot-${item.hackathon.status.toLowerCase()}` : 'cal-legend-deadline'} />
                          <span className="agenda-text">
                            <strong>{item.hackathon.name}</strong>
                            <span>
                              {item.kind === 'event'
                                ? formatRange(item.hackathon.startDate, item.hackathon.endDate)
                                : `${item.kind === 'Submit' ? 'Submission' : 'Registration'} closes at ${formatClock(item.at)}`}
                            </span>
                          </span>
                          <span className={item.kind === 'event' ? 'tag' : 'tag tag-deadline'}>{item.kind === 'event' ? 'Event' : 'Deadline'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="agenda-empty">
            <p className="nextup-cmd-light"><b>&gt;</b> grind agenda --month</p>
            <p>Nothing scheduled. Hackathons with dates or deadlines show up here.</p>
          </div>
        )}
      </section>
    </>
  );
}
