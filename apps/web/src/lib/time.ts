const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-20" for a stored event date. Event dates are stored at UTC midnight. */
export const dateKey = (iso: string) => iso.slice(0, 10);

/** Local calendar day of a moment, as "YYYY-MM-DD". Used for deadlines. */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Value for an <input type="datetime-local"> from a stored ISO moment. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${localDayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const dayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayYearFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export type ClockPref = 'auto' | '12h' | '24h';
const hour12Of = (pref: ClockPref) => (pref === 'auto' ? undefined : pref === '12h');
let momentFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
let clockFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
let clockPref: ClockPref = 'auto';

/** Applies the user's 12 or 24 hour setting to every time Grind shows. */
export function setClockPreference(pref: ClockPref) {
  if (pref === clockPref) return;
  clockPref = pref;
  const hour12 = hour12Of(pref);
  momentFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12 });
  clockFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12 });
}

/** "5:00 PM" or "17:00", following the user's setting. */
export const formatClock = (iso: string) => clockFmt.format(new Date(iso));

/** "Nov 20 to Nov 22, 2026" for an event's start and end dates. */
export function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'No dates yet';
  if (start && end && dateKey(start) !== dateKey(end)) {
    return `${dayFmt.format(new Date(start))} to ${dayYearFmt.format(new Date(end))}`;
  }
  return dayYearFmt.format(new Date((start ?? end) as string));
}

export const formatMoment = (iso: string) => momentFmt.format(new Date(iso));

/** Time left until a deadline: "05:41:12" inside two days, "3d 4h" beyond, "Closed" once passed. */
export function countdown(iso: string, now: number): { text: string; urgent: boolean; closed: boolean } {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return { text: 'Closed', urgent: false, closed: true };
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  if (hours < 48) {
    const text = `${pad(hours)}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;
    return { text, urgent: hours < 24, closed: false };
  }
  const days = Math.floor(hours / 24);
  return { text: `${days}d ${hours % 24}h`, urgent: false, closed: false };
}

export const money = (amount: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
