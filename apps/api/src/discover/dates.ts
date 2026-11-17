/** Finds event dates written in page text, such as "Nov 4 - 6, 2026" or "12 March 2027". */

const MONTH_WORDS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const DAY = '(\\d{1,2})(?:st|nd|rd|th)?';
const YEAR = '(20\\d\\d)';
const SEP = '\\s*(?:-|–|—|to|until|through|thru)\\s*';

/** "Nov 4 - 6, 2026", "Nov 4 - Dec 2, 2026", "Nov 4, 2026 - Jan 2, 2027" */
const RANGE_MDY = new RegExp(`\\b${MONTH}\\s+${DAY}(?:,?\\s+${YEAR})?${SEP}(?:${MONTH}\\s+)?${DAY},?\\s+${YEAR}\\b`, 'i');
/** "4 - 6 November 2026", "4 Nov - 2 Dec 2026", "4 Nov 2026 - 2 Jan 2027" */
const RANGE_DMY = new RegExp(`\\b${DAY}(?:\\s+${MONTH})?(?:,?\\s+${YEAR})?${SEP}${DAY}\\s+${MONTH},?\\s+${YEAR}\\b`, 'i');
const ONE_MDY = new RegExp(`\\b${MONTH}\\s+${DAY},?\\s+${YEAR}\\b`, 'i');
const ONE_DMY = new RegExp(`\\b${DAY}\\s+${MONTH},?\\s+${YEAR}\\b`, 'i');
const ONE_ISO = /\b(20\d\d)-(\d\d)-(\d\d)\b/;

const pad = (n: number) => String(n).padStart(2, '0');
const monthIndex = (word: string | undefined) => (word ? MONTH_WORDS.indexOf(word.slice(0, 3).toLowerCase()) : -1);

function ymd(year: number, month: number, day: number): string | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month, day));
  return d.getUTCMonth() === month ? `${year}-${pad(month + 1)}-${pad(day)}` : null;
}

/** The first date range in the text, read as the event's days. */
export function findRange(text: string): { start: string; end: string } | null {
  const mdy = text.match(RANGE_MDY);
  const dmy = text.match(RANGE_DMY);
  const pick = [mdy, dmy].filter((m): m is RegExpMatchArray => Boolean(m)).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
  if (!pick) return null;
  let m1: number, d1: number, y1: number | null, m2: number, d2: number, y2: number;
  if (pick === mdy) {
    [m1, d1, y1, m2, d2, y2] = [monthIndex(pick[1]), +pick[2], pick[3] ? +pick[3] : null, monthIndex(pick[4] ?? pick[1]), +pick[5], +pick[6]];
  } else {
    [d1, m1, y1, d2, m2, y2] = [+pick[1], monthIndex(pick[2] ?? pick[5]), pick[3] ? +pick[3] : null, +pick[4], monthIndex(pick[5]), +pick[6]];
  }
  const start = ymd(y1 ?? (m1 > m2 ? y2 - 1 : y2), m1, d1);
  const end = ymd(y2, m2, d2);
  return start && end && start <= end ? { start, end } : null;
}

/** The first single date in the text, as "YYYY-MM-DD". */
export function findDay(text: string): string | null {
  const hits: { at: number; day: string | null }[] = [];
  const mdy = text.match(ONE_MDY);
  if (mdy) hits.push({ at: mdy.index ?? 0, day: ymd(+mdy[3], monthIndex(mdy[1]), +mdy[2]) });
  const dmy = text.match(ONE_DMY);
  if (dmy) hits.push({ at: dmy.index ?? 0, day: ymd(+dmy[3], monthIndex(dmy[2]), +dmy[1]) });
  const isoDay = text.match(ONE_ISO);
  if (isoDay) hits.push({ at: isoDay.index ?? 0, day: ymd(+isoDay[1], +isoDay[2] - 1, +isoDay[3]) });
  return hits.sort((a, b) => a.at - b.at)[0]?.day ?? null;
}
