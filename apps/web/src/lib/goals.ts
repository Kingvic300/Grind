import { money } from './time';
import type { Goal, GoalKind } from './types';

export const KIND_LABEL: Record<GoalKind, string> = {
  ENTER: 'Hackathons entered',
  SUBMIT: 'Projects submitted',
  WIN: 'Wins',
  PRIZE: 'Prize money',
  TECH: 'Built with a tech',
  CUSTOM: 'Something else',
};

export const KIND_HINT: Record<GoalKind, string> = {
  ENTER: 'Counts hackathons you registered for or went further with.',
  SUBMIT: 'Counts hackathons marked Submitted or Done.',
  WIN: 'Counts hackathons marked as won.',
  PRIZE: 'Adds up the prize amounts you record.',
  TECH: 'Counts hackathons past Interested whose tech stack has it.',
  CUSTOM: 'Anything you want to do. Tick it off yourself.',
};

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** "Win 3 hackathons", "Earn $5,000 in prizes", or the goal's own title. */
export function goalTitle(g: Pick<Goal, 'kind' | 'title' | 'target' | 'tech'>): string {
  if (g.title) return g.title;
  const n = g.target ?? 0;
  switch (g.kind) {
    case 'ENTER': return `Enter ${plural(n, 'hackathon')}`;
    case 'SUBMIT': return `Submit ${plural(n, 'project')}`;
    case 'WIN': return `Win ${plural(n, 'hackathon')}`;
    case 'PRIZE': return `Earn ${money(n)} in prizes`;
    case 'TECH': return `Build with ${g.tech ?? 'a tech'} in ${plural(n, 'hackathon')}`;
    default: return 'Goal';
  }
}

/** "3 of 5", or "$1,200 of $5,000". */
export function progressText(g: Goal): string {
  if (g.kind === 'CUSTOM') return g.done ? 'Done' : 'Not yet';
  if (g.kind === 'PRIZE') return `${money(g.progress)} of ${money(g.target ?? 0)}`;
  return `${g.progress.toLocaleString()} of ${(g.target ?? 0).toLocaleString()}`;
}

export const reached = (g: Goal) => (g.kind === 'CUSTOM' ? g.done : g.progress >= (g.target ?? Infinity));
export const fraction = (g: Goal) => (g.kind === 'CUSTOM' ? (g.done ? 1 : 0) : Math.min(1, g.progress / Math.max(1, g.target ?? 1)));

const pad = (n: number) => String(n).padStart(2, '0');
/** "2027-03-14" from local calendar parts. Month is 0-based like Date. */
const day = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m, d));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

export const PERIODS = ['month', 'quarter', 'year', 'nextYear', 'custom', 'none'] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABEL: Record<Period, string> = {
  month: 'This month',
  quarter: 'This quarter',
  year: 'This year',
  nextYear: 'Next year',
  custom: 'Pick dates',
  none: 'No end date',
};

/** Start and end days for a preset, from today's local date. */
export function periodRange(period: Period, today = new Date()): { start: string; end: string } | null {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (period) {
    case 'month': return { start: day(y, m, 1), end: day(y, m + 1, 0) };
    case 'quarter': {
      const q = Math.floor(m / 3) * 3;
      return { start: day(y, q, 1), end: day(y, q + 3, 0) };
    }
    case 'year': return { start: day(y, 0, 1), end: day(y, 11, 31) };
    case 'nextYear': return { start: day(y + 1, 0, 1), end: day(y + 1, 11, 31) };
    default: return null;
  }
}

/** Which preset a stored window matches, so editing opens on the right choice. */
export function periodOf(g: Pick<Goal, 'startDate' | 'endDate'>, today = new Date()): Period {
  if (!g.startDate && !g.endDate) return 'none';
  const start = g.startDate?.slice(0, 10);
  const end = g.endDate?.slice(0, 10);
  for (const p of ['month', 'quarter', 'year', 'nextYear'] as const) {
    const r = periodRange(p, today)!;
    if (r.start === start && r.end === end) return p;
  }
  return 'custom';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}`;

/** "November 2026", "Q4 2026", "2027", "Mar 3 to Apr 1, 2027", "Until Jun 30, 2027", "No end date". */
export function windowLabel(g: Pick<Goal, 'startDate' | 'endDate'>): string {
  const start = g.startDate?.slice(0, 10);
  const end = g.endDate?.slice(0, 10);
  if (!start && !end) return 'No end date';
  if (start && end) {
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em] = end.split('-').map(Number);
    const lastOfEnd = day(ey, em, 0);
    if (sd === 1 && end === lastOfEnd && sy === ey) {
      if (sm === 1 && em === 12) return String(sy);
      if (sm === em) return `${new Date(Date.UTC(sy, sm - 1, 1)).toLocaleString(undefined, { month: 'long', timeZone: 'UTC' })} ${sy}`;
      if (em - sm === 2 && (sm - 1) % 3 === 0) return `Q${(sm - 1) / 3 + 1} ${sy}`;
    }
    return sy === ey ? `${short(start)} to ${short(end)}, ${ey}` : `${short(start)}, ${sy} to ${short(end)}, ${ey}`;
  }
  if (end) return `Until ${short(end)}, ${end.slice(0, 4)}`;
  return `From ${short(start!)}, ${start!.slice(0, 4)}`;
}

/** Today as a local "YYYY-MM-DD". */
export const todayKey = (d = new Date()) => day(d.getFullYear(), d.getMonth(), d.getDate());

/** "12 days left", "Last day", "Ended", "Starts Mar 1", or null for open-ended goals. */
export function timeLeft(g: Pick<Goal, 'startDate' | 'endDate'>, today = todayKey()): { text: string; ended: boolean } | null {
  const start = g.startDate?.slice(0, 10);
  const end = g.endDate?.slice(0, 10);
  if (start && start > today) return { text: `Starts ${short(start)}`, ended: false };
  if (!end) return null;
  if (end < today) return { text: 'Ended', ended: true };
  const days = Math.round((Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10)) - Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))) / 86_400_000);
  return { text: days === 0 ? 'Last day' : `${plural(days, 'day')} left`, ended: false };
}
