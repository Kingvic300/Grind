import type { Format, HackathonInput, Status } from './types';

/** One cell as SheetJS returns it with raw values: Excel dates arrive as serial numbers. */
type Cell = string | number | boolean | null;

export type Sheet = {
  fileName: string;
  headers: string[];
  rows: { rowNumber: number; cells: Cell[] }[];
  /** Mac Excel files can count days from 1904 instead of 1900. */
  date1904: boolean;
};

type Kind = 'text' | 'url' | 'day' | 'moment' | 'list' | 'status' | 'format' | 'bool' | 'money';

export type FieldKey = Exclude<keyof HackathonInput, 'assigneeIds' | 'position'>;

type Field = { key: FieldKey; label: string; kind: Kind; max?: number; itemMax?: number; aliases: string[] };

/** Every hackathon field a spreadsheet column can fill, with header names people commonly use for it. */
export const FIELDS: Field[] = [
  { key: 'name', label: 'Name', kind: 'text', max: 120, aliases: ['hackathon', 'hackathon name', 'event', 'event name', 'title'] },
  { key: 'organizer', label: 'Organizer', kind: 'text', max: 120, aliases: ['organiser', 'host', 'hosted by', 'company'] },
  { key: 'url', label: 'Link', kind: 'url', aliases: ['url', 'website', 'site', 'event link', 'hackathon link'] },
  { key: 'format', label: 'Format', kind: 'format', aliases: ['mode', 'type', 'online or in person', 'online in person'] },
  { key: 'location', label: 'Location', kind: 'text', max: 120, aliases: ['city', 'venue', 'place', 'where'] },
  { key: 'startDate', label: 'Start date', kind: 'day', aliases: ['start', 'starts', 'begins', 'from', 'date'] },
  { key: 'endDate', label: 'End date', kind: 'day', aliases: ['end', 'ends', 'until', 'to'] },
  { key: 'status', label: 'Status', kind: 'status', aliases: ['stage', 'state', 'progress'] },
  { key: 'registrationDeadline', label: 'Registration deadline', kind: 'moment', aliases: ['registration', 'register by', 'registration closes', 'apply by', 'application deadline', 'signup deadline'] },
  { key: 'submissionDeadline', label: 'Submission deadline', kind: 'moment', aliases: ['deadline', 'submission', 'submit by', 'due', 'due date'] },
  { key: 'projectName', label: 'Project name', kind: 'text', max: 120, aliases: ['project'] },
  { key: 'projectDescription', label: 'Project description', kind: 'text', max: 2000, aliases: ['description', 'idea', 'pitch'] },
  { key: 'techStack', label: 'Tech stack', kind: 'list', itemMax: 40, aliases: ['tech', 'stack', 'technologies', 'tools', 'built with'] },
  { key: 'teammates', label: 'Teammates', kind: 'list', itemMax: 80, aliases: ['team', 'members', 'team members'] },
  { key: 'repoUrl', label: 'Repo link', kind: 'url', aliases: ['repo', 'repository', 'github', 'code'] },
  { key: 'demoUrl', label: 'Demo link', kind: 'url', aliases: ['demo', 'video', 'demo video'] },
  { key: 'won', label: 'Won', kind: 'bool', aliases: ['win', 'winner'] },
  { key: 'placement', label: 'Placement', kind: 'text', max: 60, aliases: ['place', 'rank', 'result'] },
  { key: 'prizeName', label: 'Prize', kind: 'text', max: 120, aliases: ['prize name', 'award'] },
  { key: 'prizeAmount', label: 'Prize money', kind: 'money', aliases: ['prize amount', 'amount', 'money', 'winnings'] },
  { key: 'notes', label: 'Notes', kind: 'text', max: 5000, aliases: ['note', 'comments', 'remarks'] },
];

const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));
export const fieldLabel = (key: FieldKey) => FIELD_BY_KEY.get(key)?.label ?? key;

const MAX_ROWS = 1000;
const MAX_BYTES = 5 * 1024 * 1024;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Names match when they differ only in case and spacing. Same rule as the API. */
export const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const columnLetter = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : columnLetter(Math.floor(i / 26) - 1) + columnLetter(i % 26));

/** Reads the first sheet that has data. Accepts .xlsx, .xls and .csv. */
export async function readSheet(file: File): Promise<Sheet> {
  if (file.size > MAX_BYTES) throw new Error('That file is over 5 MB. Remove extra sheets or split it, then try again.');
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Choose an .xlsx, .xls or .csv file.');
  const XLSX = await import('xlsx');
  let wb: import('xlsx').WorkBook;
  try {
    // CSV goes in as text so accented names survive. raw keeps CSV values as typed, without guessing.
    wb = /\.csv$/i.test(file.name)
      ? XLSX.read(await file.text(), { type: 'string', raw: true })
      : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  } catch {
    throw new Error('Grind could not read that file. Open it in Excel or Google Sheets and save it again as .xlsx.');
  }

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws?.['!ref']) continue;
    const firstRow = XLSX.utils.decode_range(ws['!ref']).s.r;
    const grid = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
    const filled = (row: Cell[]) => row.some((c) => c !== null && String(c).trim() !== '');
    const headerAt = grid.findIndex(filled);
    if (headerAt === -1) continue;

    const width = Math.max(...grid.map((r) => r.length));
    const headers = Array.from({ length: width }, (_, i) => {
      const h = grid[headerAt][i];
      return h === null || String(h).trim() === '' ? `Column ${columnLetter(i)}` : String(h).trim();
    });
    const rows = grid
      .map((cells, i) => ({ rowNumber: firstRow + i + 1, cells }))
      .slice(headerAt + 1)
      .filter((r) => filled(r.cells));
    if (!rows.length) throw new Error(`The sheet "${sheetName}" has a header row but no hackathons under it.`);
    if (rows.length > MAX_ROWS) throw new Error(`That sheet has ${rows.length.toLocaleString()} rows. Grind imports up to ${MAX_ROWS.toLocaleString()} at a time.`);
    return { fileName: file.name, headers, rows, date1904: Boolean(wb.Workbook?.WBProps?.date1904) };
  }
  throw new Error('That file is empty.');
}

/** Picks a field for each column by its header. Each field goes to the first column that matches it. */
export function guessMapping(headers: string[]): (FieldKey | null)[] {
  const used = new Set<FieldKey>();
  return headers.map((header) => {
    const h = norm(header);
    const field = FIELDS.find((f) => !used.has(f.key) && [f.key, f.label, ...f.aliases].some((n) => norm(n) === h));
    if (!field) return null;
    used.add(field.key);
    return field.key;
  });
}

// ---------- Value parsing ----------

type When = { y: number; m: number; d: number; time: [number, number] | null } | { iso: string };

const pad = (n: number) => String(n).padStart(2, '0');

function fromSerial(serial: number, date1904: boolean): When {
  const ms = Math.round((serial + (date1904 ? 1462 : 0) - 25569) * 86_400_000);
  const t = new Date(ms);
  const hasTime = t.getUTCHours() !== 0 || t.getUTCMinutes() !== 0;
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), time: hasTime ? [t.getUTCHours(), t.getUTCMinutes()] : null };
}

/** True when the browser writes dates month first, as in the US. Decides what 03/04/2026 means. */
const monthFirst = () => /^en-(US|PH|CA)$|^en$/i.test(navigator.language);

function fromText(raw: string): When | null {
  const s = raw.trim();
  // ISO dates, as Grind's own CSV export writes them.
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s);
  if (iso) {
    if (/[T ]\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(s) && !Number.isNaN(Date.parse(s))) return { iso: new Date(s).toISOString() };
    return { y: +iso[1], m: +iso[2] - 1, d: +iso[3], time: iso[4] ? [+iso[4], +iso[5]] : null };
  }
  // 03/04/2026, 3.4.26, 03-04-2026, with an optional 14:30 after.
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)(?:,?\s+(\d{1,2}):(\d{2}))?/.exec(s);
  if (dmy) {
    let [a, b] = [+dmy[1], +dmy[2]];
    const y = dmy[3].length === 2 ? 2000 + +dmy[3] : +dmy[3];
    if (a > 12 || (b <= 12 && !monthFirst())) [a, b] = [b, a];
    return { y, m: a - 1, d: b, time: dmy[4] ? [+dmy[4], +dmy[5]] : null };
  }
  // "Nov 20, 2026", "20 November 2026 18:00" and the like.
  const t = new Date(s);
  if (Number.isNaN(t.getTime())) return null;
  const hasTime = /\d:\d{2}/.test(s);
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate(), time: hasTime ? [t.getHours(), t.getMinutes()] : null };
}

function parseWhen(v: Cell, date1904: boolean): When | null {
  if (typeof v === 'number') return fromSerial(v, date1904);
  if (typeof v === 'string') return fromText(v);
  return null;
}

const validDay = (w: { y: number; m: number; d: number }) =>
  w.y >= 2000 && w.y <= 2100 && w.m >= 0 && w.m <= 11 && w.d >= 1 && w.d <= new Date(w.y, w.m + 1, 0).getDate();

const STATUS_WORDS: [Status, string[]][] = [
  ['INTERESTED', ['interested', 'idea', 'maybe', 'wishlist', 'todo', 'planned', 'planning', 'considering']],
  ['REGISTERED', ['registered', 'applied', 'signedup', 'accepted', 'confirmed', 'rsvp']],
  ['BUILDING', ['building', 'inprogress', 'working', 'hacking', 'ongoing', 'active', 'started']],
  ['SUBMITTED', ['submitted', 'sent', 'judging']],
  ['DONE', ['done', 'finished', 'completed', 'complete', 'over', 'ended', 'closed']],
];

const FORMAT_WORDS: [Format, string[]][] = [
  ['ONLINE', ['online', 'remote', 'virtual', 'digital']],
  ['IN_PERSON', ['inperson', 'offline', 'onsite', 'irl', 'physical', 'local']],
  ['HYBRID', ['hybrid', 'both', 'onlineandinperson']],
];

const pick = <T,>(table: [T, string[]][], v: string): T | undefined => {
  const n = norm(v);
  return table.find(([value, words]) => norm(String(value)) === n || words.includes(n))?.[0];
};

const YES = new Set(['yes', 'y', 'true', '1', 'x', 'won', 'winner', '✓', '✔']);
const NO = new Set(['no', 'n', 'false', '0', '-', 'lost']);

/** "$5,000", "5k", "1.2M", "€300" become whole numbers. */
function parseMoney(v: Cell): number | null {
  if (typeof v === 'number') return Math.round(Math.abs(v));
  const m = /(\d[\d,]*(?:\.\d+)?)\s*([km])?\b/i.exec(String(v));
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, '')) * (m[2]?.toLowerCase() === 'k' ? 1e3 : m[2]?.toLowerCase() === 'm' ? 1e6 : 1);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// People paste links without a scheme, so add one. Same rule as the editor drawer.
function parseLink(v: string): string | null {
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.hostname.includes('.') && !/\s/.test(v) && withScheme.length <= 500 ? withScheme : null;
  } catch {
    return null;
  }
}

/** A cell as people expect to read it. Excel stores dates as day counts, so date columns show the date. */
export function displayCell(sheet: Sheet, v: Cell, key: FieldKey | null): string {
  if (v == null) return '';
  const kind = key ? FIELD_BY_KEY.get(key)?.kind : null;
  if (typeof v === 'number' && (kind === 'day' || kind === 'moment')) {
    const w = fromSerial(v, sheet.date1904);
    if ('y' in w) return `${w.y}-${pad(w.m + 1)}-${pad(w.d)}${w.time ? ` ${pad(w.time[0])}:${pad(w.time[1])}` : ''}`;
  }
  return String(v);
}

// ---------- Rows ----------

export type PreparedRow = {
  rowNumber: number;
  input: HackathonInput;
  /** Values Grind could not read. The row still imports without them. */
  warnings: string[];
  /** Why the row will not import. Null when it will. */
  skip: string | null;
};

/** Turns sheet rows into hackathon inputs using the chosen column mapping. */
export function prepareRows(sheet: Sheet, mapping: (FieldKey | null)[], existingNames: Iterable<string>): PreparedRow[] {
  const taken = new Set([...existingNames].map(nameKey));
  const seen = new Set<string>();

  return sheet.rows.map(({ rowNumber, cells }) => {
    const input: Record<string, unknown> = {};
    const warnings: string[] = [];

    mapping.forEach((key, col) => {
      const field = key && FIELD_BY_KEY.get(key);
      const v = cells[col] ?? null;
      if (!field || v === null || String(v).trim() === '') return;
      const text = String(v).trim();
      const bad = () => warnings.push(`${field.label} "${text.slice(0, 40)}" was not understood, so it is left empty.`);

      switch (field.kind) {
        case 'text': {
          if (field.max && text.length > field.max) warnings.push(`${field.label} was cut to ${field.max} characters.`);
          input[field.key] = field.max ? text.slice(0, field.max) : text;
          break;
        }
        case 'url': {
          const link = parseLink(text);
          if (link) input[field.key] = link;
          else bad();
          break;
        }
        case 'day': {
          const w = parseWhen(v, sheet.date1904);
          if (w && 'iso' in w) input[field.key] = `${w.iso.slice(0, 10)}T00:00:00.000Z`;
          else if (w && validDay(w)) input[field.key] = `${w.y}-${pad(w.m + 1)}-${pad(w.d)}T00:00:00.000Z`;
          else bad();
          break;
        }
        case 'moment': {
          // A deadline with no time means the end of that day, in the importer's time zone.
          const w = parseWhen(v, sheet.date1904);
          if (w && 'iso' in w) input[field.key] = w.iso;
          else if (w && validDay(w)) input[field.key] = new Date(w.y, w.m, w.d, w.time?.[0] ?? 23, w.time?.[1] ?? 59).toISOString();
          else bad();
          break;
        }
        case 'list': {
          const items = [...new Set(text.split(/[,;|\n]/).map((s) => s.trim()).filter(Boolean))];
          if (items.length > 30 || items.some((s) => s.length > (field.itemMax ?? 80))) warnings.push(`${field.label} was shortened to fit.`);
          input[field.key] = items.slice(0, 30).map((s) => s.slice(0, field.itemMax ?? 80));
          break;
        }
        case 'status': {
          const status = pick(STATUS_WORDS, text);
          if (status) input.status = status;
          else warnings.push(`Status "${text.slice(0, 40)}" was not understood, so it is set to Interested.`);
          break;
        }
        case 'format': {
          const format = pick(FORMAT_WORDS, text);
          if (format) input.format = format;
          else warnings.push(`Format "${text.slice(0, 40)}" was not understood, so it is set to Online.`);
          break;
        }
        case 'bool': {
          const n = text.toLowerCase();
          if (YES.has(n) || v === true) input.won = true;
          else if (NO.has(n) || v === false) input.won = false;
          else bad();
          break;
        }
        case 'money': {
          const n = parseMoney(v);
          if (n !== null && n <= 100_000_000) input.prizeAmount = n;
          else bad();
          break;
        }
      }
    });

    if (input.startDate && input.endDate && String(input.endDate) < String(input.startDate)) {
      warnings.push('End date was before the start date, so it is left empty.');
      delete input.endDate;
    }

    const name = typeof input.name === 'string' ? input.name : '';
    let skip: string | null = null;
    if (!name) skip = 'No name.';
    else if (taken.has(nameKey(name))) skip = 'Already in this list.';
    else if (seen.has(nameKey(name))) skip = 'Repeats an earlier row in this file.';
    if (name) seen.add(nameKey(name));

    return { rowNumber, input: input as HackathonInput, warnings, skip };
  });
}

/** Downloads an .xlsx with every column Grind reads, and a filled-in example on a second sheet. */
export async function downloadTemplate() {
  const XLSX = await import('xlsx');
  const headers = FIELDS.map((f) => f.label);
  const example = [
    'ETHGlobal Online', 'ETHGlobal', 'https://ethglobal.com', 'Online', '', new Date(2026, 11, 4), new Date(2026, 11, 6), 'Registered',
    new Date(2026, 11, 1, 23, 59), new Date(2026, 11, 6, 12, 0), 'Splitwise onchain', 'Split bills with friends, settle in USDC.',
    'Solidity, React, Foundry', 'Ada, Linus', 'https://github.com/you/project', '', 'No', '', '', '', 'Ask Ada about the oracle.',
  ];
  const sheet = XLSX.utils.aoa_to_sheet([headers], { cellDates: true });
  const sample = XLSX.utils.aoa_to_sheet([headers, example], { cellDates: true, dateNF: 'yyyy-mm-dd hh:mm' });
  const cols = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  sheet['!cols'] = cols;
  sample['!cols'] = cols;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Hackathons');
  XLSX.utils.book_append_sheet(wb, sample, 'Example');
  XLSX.writeFile(wb, 'grind-import-template.xlsx');
}
