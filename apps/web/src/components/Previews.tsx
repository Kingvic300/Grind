// Small product previews for the marketing pages. All data here is sample data.
import { useMemo, useState } from 'react';
import { useNow } from '../lib/hooks';
import { countdown } from '../lib/time';
import { IconTrophy } from './Icons';
import { LogoMark } from './Logo';

const HOUR = 3_600_000;
const COLUMNS = ['Registered', 'Building', 'Submitted'] as const;
const COLUMN_CLASS = ['registered', 'building', 'submitted'] as const;

type DemoCard = { id: string; name: string; meta: string; column: number; hoursLeft?: number; stack: string[] };

const START_CARDS: DemoCard[] = [
  { id: 'a', name: 'Open Data Jam', meta: 'Online, Dec 5 to 7', column: 0, stack: ['Python', 'DuckDB'] },
  { id: 'b', name: 'Campus AI Sprint', meta: 'In person, Lagos', column: 0, stack: ['Next.js'] },
  { id: 'c', name: 'Midnight Build Weekend', meta: 'Online, 48 hours', column: 1, hoursLeft: 5.69, stack: ['React', 'NestJS', 'Postgres'] },
  { id: 'd', name: 'Climate Hack 48', meta: 'Hybrid, Nairobi', column: 2, stack: ['Svelte', 'Go'] },
];

/** The hero demo: a working mini board. Clicking a card moves it to the next column. */
export function DemoBoard() {
  const [cards, setCards] = useState(START_CARDS);
  const now = useNow();
  // Deadlines are set relative to page load so the demo countdown is always live.
  const loadedAt = useMemo(() => Date.now(), []);

  const advance = (id: string) =>
    setCards((list) => list.map((c) => (c.id === id ? { ...c, column: (c.column + 1) % COLUMNS.length } : c)));

  return (
    <div className="demo-board" aria-label="Sample board">
      <div className="demo-board-bar">
        <span className="demo-dots" aria-hidden="true"><i /><i /><i /></span>
        <span>Sample board. Click a card to move it forward.</span>
      </div>
      <div className="demo-columns">
        {COLUMNS.map((title, index) => {
          const inColumn = cards.filter((c) => c.column === index);
          return (
            <div className="demo-column" key={title}>
              <div className="demo-column-head">
                <span className={`dot dot-${COLUMN_CLASS[index]}`} />
                {title}
                <span className="demo-count">{inColumn.length}</span>
              </div>
              {inColumn.map((card) => {
                const left = card.hoursLeft
                  ? countdown(new Date(loadedAt + card.hoursLeft * HOUR).toISOString(), now)
                  : null;
                const next = COLUMNS[(card.column + 1) % COLUMNS.length];
                return (
                  <button
                    type="button"
                    className="demo-card"
                    key={card.id}
                    onClick={() => advance(card.id)}
                    aria-label={`Move ${card.name} to ${next}`}
                  >
                    <strong>{card.name}</strong>
                    <span className="demo-meta">{card.meta}</span>
                    {left && index < 2 && (
                      <span className="countdown is-urgent">
                        Submission closes in <span className="countdown-digits">{left.text}</span>
                      </span>
                    )}
                    <span className="chips">
                      {card.stack.map((s) => <span className="chip" key={s}>{s}</span>)}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MiniList() {
  const rows = [
    ['Midnight Build Weekend', 'building', 'Building', '05:41:12'],
    ['Open Data Jam', 'registered', 'Registered', '12d 4h'],
    ['Campus AI Sprint', 'interested', 'Interested', '19d 7h'],
    ['Climate Hack 48', 'submitted', 'Submitted', 'Closed'],
  ];
  return (
    <div className="mini mini-list" aria-hidden="true">
      <div className="mini-search">Search hackathons</div>
      {rows.map(([name, cls, label, left]) => (
        <div className="mini-row" key={name}>
          <span className="mini-name">{name}</span>
          <span className={`pill pill-${cls}`}>{label}</span>
          <span className="mini-left">{left}</span>
        </div>
      ))}
    </div>
  );
}

export function MiniCalendar() {
  // A fixed sample month: an event across three days and one deadline.
  const cells = Array.from({ length: 28 }, (_, i) => i + 1);
  return (
    <div className="mini mini-cal" aria-hidden="true">
      <div className="mini-cal-head">December</div>
      <div className="mini-cal-grid">
        {cells.map((day) => (
          <span
            key={day}
            className={`mini-day${day >= 5 && day <= 7 ? ' is-event' : ''}${day === 18 ? ' is-deadline' : ''}${day === 12 ? ' is-today' : ''}`}
          >
            {day}
          </span>
        ))}
      </div>
      <div className="mini-cal-legend">
        <span><i className="dot dot-building" />Event days</span>
        <span><i className="dot dot-deadline" />Deadline</span>
      </div>
    </div>
  );
}

export function MiniStats() {
  const bars = [['React', 9], ['Python', 6], ['NestJS', 5], ['Go', 2]] as const;
  return (
    <div className="mini mini-stats" aria-hidden="true">
      <div className="mini-stat-row">
        <div><strong>14</strong><span>entered</span></div>
        <div><strong>3</strong><span>wins</span></div>
        <div><strong>$4,500</strong><span>in prizes</span></div>
      </div>
      {bars.map(([label, value]) => (
        <div className="mini-bar" key={label}>
          <span>{label}</span>
          <i style={{ width: `${(value / 9) * 100}%` }} />
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}

export function ReminderEmail() {
  return (
    <div className="mini mini-email" aria-hidden="true">
      <div className="mini-email-head">
        <LogoMark size={26} />
        <div>
          <strong>Grind</strong>
          <span>Submission closes in 24 hours: Midnight Build Weekend</span>
        </div>
      </div>
      <div className="mini-email-body">
        <span className="mini-email-kicker">Midnight Build Weekend</span>
        <strong>Submission closes in 24 hours</strong>
        <span>Deadline: Sunday, 11:59 PM</span>
        <span className="mini-email-btn">Open Grind</span>
      </div>
    </div>
  );
}

export function ProjectRecord() {
  return (
    <div className="mini mini-record" aria-hidden="true">
      <div className="mini-record-top">
        <div>
          <span className="mini-record-event">Climate Hack 48</span>
          <strong>Floodline</strong>
        </div>
        <span className="win-badge"><IconTrophy />2nd place</span>
      </div>
      <p>Maps flood risk street by street from open rainfall data.</p>
      <div className="chips">
        <span className="chip">Svelte</span><span className="chip">Go</span><span className="chip">PostGIS</span>
      </div>
      <dl>
        <div><dt>Team</dt><dd>Amara, Tobi, Wanjiru</dd></div>
        <div><dt>Prize</dt><dd>$1,500</dd></div>
        <div><dt>Lesson</dt><dd>Record the demo video before the last hour.</dd></div>
      </dl>
    </div>
  );
}
