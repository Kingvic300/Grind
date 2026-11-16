/**
 * Fetchers for public hackathon listings. Each one turns a site's own format into Listing.
 * These are unofficial endpoints the sites use for their own pages, so any of them can
 * change without notice. A failing source must never break the others.
 */

export type Source = 'devpost' | 'dorahacks' | 'devfolio' | 'mlh';
export type ListingFormat = 'ONLINE' | 'IN_PERSON' | 'HYBRID';

export type Listing = {
  id: string;
  source: Source;
  name: string;
  organizer: string | null;
  url: string;
  format: ListingFormat;
  location: string | null;
  /** Event days as "YYYY-MM-DD". */
  startDate: string | null;
  endDate: string | null;
  /** Exact moments as ISO strings, when the site publishes them. */
  registrationDeadline: string | null;
  submissionDeadline: string | null;
  prize: string | null;
  tags: string[];
  imageUrl: string | null;
};

const TIMEOUT_MS = 12_000;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; GrindHackathonTracker/1.0)',
  Accept: 'application/json, text/html;q=0.9',
};

async function get(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...HEADERS, ...init.headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

const clean = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  // Some listings fill blank fields with placeholder words.
  return t && !/^(nil|nill|null|none|n\/a|-)$/i.test(t) ? t : null;
};

const https = (v: string | null | undefined): string | null => {
  if (!v) return null;
  if (v.startsWith('//')) return `https:${v}`;
  return /^https?:\/\//i.test(v) ? v : null;
};

/** Calendar day of a moment in a time zone, as "YYYY-MM-DD". */
function dayIn(iso: string | Date | null | undefined, timeZone = 'UTC'): string | null {
  if (!iso) return null;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

const iso = (v: unknown): string | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

function formatOf(text: string | null | undefined): ListingFormat {
  const t = (text ?? '').toLowerCase();
  if (t.includes('hybrid') || t.includes('mixed')) return 'HYBRID';
  if (t.includes('online') || t.includes('virtual')) return 'ONLINE';
  return 'IN_PERSON';
}

// ---------- Devpost ----------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Devpost gives dates as text only: "Nov 04 - 30, 2026", "Nov 01 - Dec 02, 2026",
 * or "Aug 23, 2026 - Jan 02, 2027". Returns the first and last day.
 */
export function parseDevpostRange(text: string): { start: string | null; end: string | null } {
  const [left, right] = text.split(' - ').map((s) => s.trim());
  if (!left || !right) return { start: null, end: null };
  const l = left.match(/^([A-Za-z]{3})\w* (\d{1,2})(?:, (\d{4}))?$/);
  const r = right.match(/^(?:([A-Za-z]{3})\w* )?(\d{1,2}), (\d{4})$/);
  if (!l || !r) return { start: null, end: null };
  const lMonth = MONTHS.indexOf(l[1].toLowerCase());
  const rMonth = r[1] ? MONTHS.indexOf(r[1].toLowerCase()) : lMonth;
  if (lMonth < 0 || rMonth < 0) return { start: null, end: null };
  const rYear = Number(r[3]);
  const lYear = l[3] ? Number(l[3]) : lMonth > rMonth ? rYear - 1 : rYear;
  return {
    start: `${lYear}-${pad(lMonth + 1)}-${pad(Number(l[2]))}`,
    end: `${rYear}-${pad(rMonth + 1)}-${pad(Number(r[2]))}`,
  };
}

type DevpostItem = {
  id: number;
  title: string;
  url: string;
  thumbnail_url?: string;
  displayed_location?: { location?: string };
  submission_period_dates?: string;
  themes?: { name: string }[];
  prize_amount?: string;
  organization_name?: string;
  invite_only?: boolean;
};

export async function fetchDevpost(): Promise<Listing[]> {
  const out: Listing[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await get(`https://devpost.com/api/hackathons?status[]=upcoming&status[]=open&page=${page}`);
    const data = (await res.json()) as { hackathons: DevpostItem[]; meta?: { total_count?: number; per_page?: number } };
    for (const h of data.hackathons ?? []) {
      if (h.invite_only) continue;
      const place = h.displayed_location?.location ?? null;
      const { start, end } = parseDevpostRange(h.submission_period_dates ?? '');
      const prize = clean(h.prize_amount);
      out.push({
        id: `devpost:${h.id}`,
        source: 'devpost',
        name: h.title,
        organizer: clean(h.organization_name),
        url: h.url,
        format: formatOf(place),
        location: place && !/^online$/i.test(place) ? place : null,
        startDate: start,
        endDate: end,
        registrationDeadline: null,
        submissionDeadline: null,
        prize: prize && prize !== '$0' ? `${prize} in prizes` : null,
        tags: (h.themes ?? []).map((t) => t.name),
        imageUrl: https(h.thumbnail_url),
      });
    }
    const total = data.meta?.total_count ?? 0;
    const perPage = data.meta?.per_page ?? 40;
    if (page * perPage >= total || !data.hackathons?.length) break;
  }
  return out;
}

// ---------- DoraHacks ----------

type DoraItem = {
  id: number;
  uname: string;
  title: string;
  image_url?: string;
  ecosystem?: string;
  tags?: string;
  owner?: { name?: string };
  timeline_start?: number;
  timeline_end?: number;
  timeline_pre_register?: number;
  venue_form?: string;
  venue_name?: string | null;
  venue_address?: string | null;
  bonus_price?: number;
  bonus_token?: string;
};

export async function fetchDoraHacks(): Promise<Listing[]> {
  const out: Listing[] = [];
  for (const status of ['ongoing', 'upcoming']) {
    const res = await get(`https://dorahacks.io/api/v1/hub/hackathons?page=1&page_size=100&status=${status}`);
    const data = (await res.json()) as { results: DoraItem[] };
    for (const h of data.results ?? []) {
      const amount = h.bonus_price ?? 0;
      const token = h.bonus_token || 'USD';
      out.push({
        id: `dorahacks:${h.id}`,
        source: 'dorahacks',
        name: h.title,
        organizer: clean(h.owner?.name),
        url: `https://dorahacks.io/hackathon/${encodeURIComponent(h.uname)}`,
        format: formatOf(h.venue_form),
        location: clean([h.venue_name, h.venue_address].filter(Boolean).join(', ')),
        startDate: h.timeline_start ? dayIn(new Date(h.timeline_start * 1000)) : null,
        endDate: h.timeline_end ? dayIn(new Date(h.timeline_end * 1000)) : null,
        registrationDeadline: null,
        // DoraHacks closes BUIDL submission when the timeline ends.
        submissionDeadline: h.timeline_end ? iso(h.timeline_end) : null,
        prize: amount > 0 ? `${amount.toLocaleString('en-US')} ${token} in prizes` : null,
        tags: [...(h.tags ?? '').split(','), ...(h.ecosystem ?? '').split(',')].map((t) => t.trim()).filter(Boolean).slice(0, 8),
        imageUrl: https(h.image_url),
      });
    }
  }
  return out;
}

// ---------- Devfolio ----------

type DevfolioItem = {
  uuid: string;
  name: string;
  slug: string;
  tagline?: string;
  starts_at?: string;
  ends_at?: string;
  is_online?: boolean;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  timezone?: string;
  themes?: { name?: string }[] | null;
  private?: boolean;
  hackathon_setting?: { reg_ends_at?: string | null; logo?: string | null; site?: string | null };
};

export async function fetchDevfolio(): Promise<Listing[]> {
  const out: Listing[] = [];
  const seen = new Set<string>();
  for (const type of ['application_open', 'upcoming']) {
    const res = await get('https://api.devfolio.co/api/search/hackathons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, from: 0, size: 100 }),
    });
    const data = (await res.json()) as { hits?: { hits?: { _source: DevfolioItem }[] } };
    for (const { _source: h } of data.hits?.hits ?? []) {
      if (h.private || seen.has(h.uuid)) continue;
      seen.add(h.uuid);
      const tz = h.timezone || 'UTC';
      out.push({
        id: `devfolio:${h.uuid}`,
        source: 'devfolio',
        name: h.name,
        organizer: null,
        url: `https://${h.slug}.devfolio.co/`,
        format: h.is_online ? 'ONLINE' : 'IN_PERSON',
        location: h.is_online ? null : clean([h.city, h.state, h.country].filter(Boolean).join(', ')),
        startDate: dayIn(h.starts_at, tz),
        endDate: dayIn(h.ends_at, tz),
        registrationDeadline: iso(h.hackathon_setting?.reg_ends_at),
        submissionDeadline: null,
        prize: null,
        tags: (h.themes ?? []).map((t) => t?.name).filter((t): t is string => Boolean(t)),
        imageUrl: https(h.hackathon_setting?.logo),
      });
    }
  }
  return out;
}

// ---------- MLH ----------

const decode = (s: string) =>
  s
    .replace(/<!--.*?-->/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

/** MLH seasons run from summer to summer: events in November 2026 are in season 2027. */
export const mlhSeason = (now = new Date()) => (now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear());

/** MLH has no API. Its events page marks each event with schema.org microdata, which this reads. */
export function parseMlh(html: string): Listing[] {
  const out: Listing[] = [];
  const blocks = html.split('itemType="https://schema.org/Event"').slice(1);
  for (const block of blocks) {
    const meta = (prop: string) => block.match(new RegExp(`itemProp="${prop}" content="([^"]*)"`))?.[1] ?? null;
    const url = meta('url');
    const name = block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/)?.[1];
    if (!url || !name) continue;
    const place = block.match(/itemType="https:\/\/schema\.org\/Place"[^>]*><span itemProp="name">([\s\S]*?)<\/span>/)?.[1];
    const mode = meta('eventAttendanceMode');
    out.push({
      id: `mlh:${url}`,
      source: 'mlh',
      name: decode(name).trim(),
      organizer: 'MLH member event',
      url: decode(url),
      format: mode?.includes('Mixed') ? 'HYBRID' : mode?.includes('Online') ? 'ONLINE' : 'IN_PERSON',
      location: place ? clean(decode(place)) : null,
      startDate: dayIn(meta('startDate')),
      endDate: dayIn(meta('endDate')),
      registrationDeadline: null,
      submissionDeadline: null,
      prize: null,
      tags: [],
      imageUrl: https(meta('image')),
    });
  }
  return out;
}

export async function fetchMlh(): Promise<Listing[]> {
  const res = await get(`https://www.mlh.com/seasons/${mlhSeason()}/events`);
  return parseMlh(await res.text());
}

export const SOURCES: Record<Source, { label: string; fetch: () => Promise<Listing[]> }> = {
  devpost: { label: 'Devpost', fetch: fetchDevpost },
  dorahacks: { label: 'DoraHacks', fetch: fetchDoraHacks },
  devfolio: { label: 'Devfolio', fetch: fetchDevfolio },
  mlh: { label: 'MLH', fetch: fetchMlh },
};
