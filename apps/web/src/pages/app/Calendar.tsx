import { useMemo, useState } from 'react';
import { PageHead, useShell } from '../../components/AppShell';
import { IconChevronLeft, IconChevronRight } from '../../components/Icons';
import { useHackathons } from '../../lib/hooks';
import { dateKey, formatMoment, formatRange, localDayKey } from '../../lib/time';
import type { Hackathon } from '../../lib/types';

type DayEntry =
  | { type: 'event'; hackathon: Hackathon }
  | { type: 'deadline'; hackathon: Hackathon; label: string; at: string };

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

/** The six-week grid for a month, starting on Monday. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
}

export function CalendarPage() {
  const { openEditor } = useShell();
  const query = useHackathons();
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const list = query.data ?? [];

  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  const entriesFor = (key: string): DayEntry[] => {
    const out: DayEntry[] = [];
    for (const h of list) {
      const start = h.startDate ? dateKey(h.startDate) : h.endDate ? dateKey(h.endDate) : null;
      const end = h.endDate ? dateKey(h.endDate) : start;
      if (start && end && key >= start && key <= end) out.push({ type: 'event', hackathon: h });
      if (h.registrationDeadline && localDayKey(new Date(h.registrationDeadline)) === key)
        out.push({ type: 'deadline', hackathon: h, label: 'Register', at: h.registrationDeadline });
      if (h.submissionDeadline && localDayKey(new Date(h.submissionDeadline)) === key)
        out.push({ type: 'deadline', hackathon: h, label: 'Submit', at: h.submissionDeadline });
    }
    return out;
  };

  const shift = (delta: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  if (query.isPending) return <div className="page-loading" role="status">Loading your calendar</div>;
  if (query.isError) return <div className="page-error" role="alert">{query.error.message}</div>;

  const todayKey = localDayKey(today);
  const monthDays = days.filter((d) => d.getMonth() === cursor.month);
  const agenda = monthDays.flatMap((d) => {
    const key = localDayKey(d);
    // List each event once, on the first day it appears in this month.
    return entriesFor(key).filter((e) => {
      if (e.type === 'deadline') return true;
      const start = e.hackathon.startDate ? dateKey(e.hackathon.startDate) : key;
      return key === start || d.getDate() === 1;
    }).map((entry) => ({ key, entry }));
  });

  return (
    <>
      <PageHead title="Calendar" sub="Event days and deadlines, month by month.">
        <div className="cal-nav">
          <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><IconChevronLeft /></button>
          <strong aria-live="polite">{monthFmt.format(new Date(cursor.year, cursor.month, 1))}</strong>
          <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><IconChevronRight /></button>
          <button type="button" className="btn btn-outline" onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}>Today</button>
        </div>
      </PageHead>

      <div className="cal">
        <div className="cal-weekdays">{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="cal-grid">
          {days.map((d) => {
            const key = localDayKey(d);
            const entries = entriesFor(key);
            return (
              <div key={key} className={`cal-day${d.getMonth() !== cursor.month ? ' is-outside' : ''}${key === todayKey ? ' is-today' : ''}`}>
                <span className="cal-date">{d.getDate()}</span>
                {entries.slice(0, 3).map((e) => (
                  <button
                    type="button"
                    key={e.hackathon.id + e.type + (e.type === 'deadline' ? e.label : '')}
                    className={e.type === 'event' ? `cal-chip bg-soft-${e.hackathon.status.toLowerCase()}` : 'cal-chip cal-chip-deadline'}
                    onClick={() => openEditor(e.hackathon)}
                    title={e.type === 'event' ? e.hackathon.name : `${e.label}: ${e.hackathon.name}`}
                  >
                    <span>{e.type === 'deadline' ? `${e.label}: ` : ''}{e.hackathon.name}</span>
                  </button>
                ))}
                {entries.length > 3 && <span className="cal-more">+{entries.length - 3} more</span>}
              </div>
            );
          })}
        </div>
      </div>

      <section className="panel agenda">
        <h2>This month</h2>
        {agenda.length ? (
          <ul className="deadline-list">
            {agenda.map(({ key, entry }) => (
              <li key={key + entry.hackathon.id + entry.type + (entry.type === 'deadline' ? entry.label : '')}>
                <button type="button" onClick={() => openEditor(entry.hackathon)}>
                  <span className="deadline-text">
                    <strong>{entry.hackathon.name}</strong>
                    <span>
                      {entry.type === 'event'
                        ? formatRange(entry.hackathon.startDate, entry.hackathon.endDate)
                        : `${entry.label === 'Submit' ? 'Submission' : 'Registration'} closes ${formatMoment(entry.at)}`}
                    </span>
                  </span>
                  <span className={entry.type === 'event' ? 'tag' : 'tag tag-deadline'}>{entry.type === 'event' ? 'Event' : 'Deadline'}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel-empty">Nothing this month. Hackathons with dates or deadlines appear here.</p>
        )}
      </section>
    </>
  );
}
