/**
 * Fetchers for public hackathon listings. Each one turns a site's own format into Listing.
 * These are unofficial endpoints the sites use for their own pages, so any of them can
 * change without notice. A failing source must never break the others.
 */

export type Source =
  | 'devpost' | 'dorahacks' | 'devfolio' | 'mlh'
  | 'superteam' | 'ethglobal' | 'taikai' | 'unstop' | 'hackerearth' | 'hackclub';
/** A bounty is a paid task with a deadline, not an event. Superteam Earn lists both. */
export type ListingKind = 'hackathon' | 'bounty';
export type ListingFormat = 'ONLINE' | 'IN_PERSON' | 'HYBRID';

export type Listing = {
  id: string;
  source: Source;
  kind: ListingKind;
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
  /** Plain text from the event's own page, trimmed. Filled in by enrich(). */
  description: string | null;
  /** Derived from name, tags and description. */
  categories: Category[];
  stack: string[];
};

/** A listing straight from a site, before descriptions and tags are added. */
export type RawListing = Omit<Listing, 'description' | 'categories' | 'stack' | 'kind'> & {
  /** Leave out for hackathons. */
  kind?: ListingKind;
  /** Description the list endpoint already gave, so no page fetch is needed. */
  inlineDescription?: string | null;
};

import type { Category } from './classify';

const TIMEOUT_MS = 12_000;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; GrindHackathonTracker/1.0)',
  Accept: 'application/json, text/html;q=0.9',
};

export async function get(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...HEADERS, ...init.headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export const clean = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  // Some listings fill blank fields with placeholder words.
  return t && !/^(nil|nill|null|none|n\/a|-)$/i.test(t) ? t : null;
};

export const https = (v: string | null | undefined): string | null => {
  if (!v) return null;
  if (v.startsWith('//')) return `https:${v}`;
  return /^https?:\/\//i.test(v) ? v : null;
};

/** Calendar day of a moment in a time zone, as "YYYY-MM-DD". */
export function dayIn(iso: string | Date | null | undefined, timeZone = 'UTC'): string | null {
  if (!iso) return null;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export const iso = (v: unknown): string | null => {
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

export type DevpostItem = {
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

export function devpostListing(h: DevpostItem): RawListing {
  const place = h.displayed_location?.location ?? null;
  const { start, end } = parseDevpostRange(h.submission_period_dates ?? '');
  const prize = clean(h.prize_amount);
  return {
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
  };
}

export async function fetchDevpost(): Promise<RawListing[]> {
  const out: RawListing[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await get(`https://devpost.com/api/hackathons?status[]=upcoming&status[]=open&page=${page}`);
    const data = (await res.json()) as { hackathons: DevpostItem[]; meta?: { total_count?: number; per_page?: number } };
    for (const h of data.hackathons ?? []) {
      if (!h.invite_only) out.push(devpostListing(h));
    }
    const total = data.meta?.total_count ?? 0;
    const perPage = data.meta?.per_page ?? 40;
    if (page * perPage >= total || !data.hackathons?.length) break;
  }
  return out;
}

// ---------- DoraHacks ----------

export type DoraItem = {
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

export function doraListing(h: DoraItem): RawListing {
  const amount = h.bonus_price ?? 0;
  const token = h.bonus_token || 'USD';
  return {
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
  };
}

export async function fetchDoraHacks(): Promise<RawListing[]> {
  const out: RawListing[] = [];
  for (const status of ['ongoing', 'upcoming']) {
    const res = await get(`https://dorahacks.io/api/v1/hub/hackathons?page=1&page_size=100&status=${status}`);
    const data = (await res.json()) as { results: DoraItem[] };
    for (const h of data.results ?? []) out.push(doraListing(h));
  }
  return out;
}

// ---------- Devfolio ----------

export type DevfolioItem = {
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
  desc?: string | null;
  private?: boolean;
  hackathon_setting?: { reg_ends_at?: string | null; logo?: string | null; site?: string | null };
};

export function devfolioListing(h: DevfolioItem): RawListing {
  const tz = h.timezone || 'UTC';
  return {
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
    inlineDescription: [h.tagline, h.desc].filter(Boolean).join('. '),
  };
}

export async function fetchDevfolio(): Promise<RawListing[]> {
  const out: RawListing[] = [];
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
      out.push(devfolioListing(h));
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
export function parseMlh(html: string): RawListing[] {
  const out: RawListing[] = [];
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

export async function fetchMlh(): Promise<RawListing[]> {
  const res = await get(`https://www.mlh.com/seasons/${mlhSeason()}/events`);
  return parseMlh(await res.text());
}

/** Reads the JSON a Next.js page embeds for its first render. */
export function nextData<T>(html: string): T | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as T;
  } catch {
    return null;
  }
}

/** "150,000 INR in prizes" from amounts that may be in several currencies. */
export function prizeText(amounts: { amount: number | null | undefined; currency: string | null | undefined }[]): string | null {
  const totals = new Map<string, number>();
  for (const { amount, currency } of amounts) {
    if (!amount || amount <= 0) continue;
    const c = currency || 'USD';
    totals.set(c, (totals.get(c) ?? 0) + amount);
  }
  if (!totals.size) return null;
  return `${[...totals].map(([c, n]) => `${Math.round(n).toLocaleString('en-US')} ${c}`).join(' + ')} in prizes`;
}

const dateOnly = (v: string | null | undefined, timeZone?: string) => (v ? dayIn(v, timeZone) : null);

// ---------- Superteam Earn ----------

type SuperteamHackathon = {
  slug: string;
  name: string;
  logo?: string | null;
  startDate?: string | null;
  deadline?: string | null;
  description?: string | null;
  Sponsor?: { name?: string } | null;
};

type SuperteamListing = {
  id: string;
  slug: string;
  title: string;
  type?: string;
  deadline?: string | null;
  rewardAmount?: number | null;
  token?: string | null;
  compensationType?: string | null;
  minRewardAsk?: number | null;
  maxRewardAsk?: number | null;
  sponsor?: { name?: string; logo?: string | null } | null;
};

const SUPERTEAM = 'https://superteam.fun';

/** Superteam has no hackathon index, so this reads the slugs linked from the Earn home page. */
async function superteamHackathons(now: number): Promise<RawListing[]> {
  const home = await (await get(`${SUPERTEAM}/earn/`, { headers: { Accept: 'text/html' } })).text();
  const slugs = [...new Set([...home.matchAll(/\/earn\/hackathon\/([a-z0-9-]+)/g)].map((m) => m[1]))].slice(0, 10);
  const out: RawListing[] = [];
  for (const slug of slugs) {
    const page = await get(`${SUPERTEAM}/earn/hackathon/${slug}/`, { headers: { Accept: 'text/html' } }).then((r) => r.text()).catch(() => '');
    const h = nextData<{ props?: { pageProps?: { hackathon?: SuperteamHackathon } } }>(page)?.props?.pageProps?.hackathon;
    if (!h?.name || !h.deadline || Date.parse(h.deadline) < now) continue;
    // Each side track is a listing with its own reward. Their sum is the prize pool.
    const tracks = await get(`${SUPERTEAM}/api/hackathon/${encodeURIComponent(slug)}`)
      .then((r) => r.json() as Promise<{ rewardAmount?: number; token?: string }[]>)
      .catch(() => []);
    out.push({
      id: `superteam:hackathon:${slug}`,
      source: 'superteam',
      name: h.name,
      organizer: clean(h.Sponsor?.name) ?? 'Superteam',
      url: `${SUPERTEAM}/earn/hackathon/${slug}/`,
      format: 'ONLINE',
      location: null,
      startDate: dateOnly(h.startDate),
      endDate: dateOnly(h.deadline),
      registrationDeadline: null,
      submissionDeadline: iso(h.deadline),
      prize: prizeText((Array.isArray(tracks) ? tracks : []).map((t) => ({ amount: t.rewardAmount, currency: t.token }))),
      tags: ['Solana'],
      imageUrl: https(h.logo),
      inlineDescription: h.description ?? null,
    });
  }
  return out;
}

function bountyReward(b: SuperteamListing): string | null {
  const token = b.token || 'USDC';
  if (b.compensationType === 'range' && b.minRewardAsk && b.maxRewardAsk) {
    return `${b.minRewardAsk.toLocaleString('en-US')} to ${b.maxRewardAsk.toLocaleString('en-US')} ${token} reward`;
  }
  if (b.compensationType === 'variable') return 'Reward set per submission';
  return b.rewardAmount ? `${b.rewardAmount.toLocaleString('en-US')} ${token} reward` : null;
}

async function superteamBounties(): Promise<RawListing[]> {
  const res = await get(`${SUPERTEAM}/api/listings?context=all&tab=all&status=open`);
  const data = (await res.json()) as SuperteamListing[];
  return (Array.isArray(data) ? data : [])
    .filter((b) => b.type === 'bounty' && b.slug && b.title)
    .map((b) => ({
      id: `superteam:bounty:${b.id}`,
      source: 'superteam' as const,
      kind: 'bounty' as const,
      name: b.title,
      organizer: clean(b.sponsor?.name),
      url: `${SUPERTEAM}/earn/listing/${b.slug}/`,
      format: 'ONLINE' as const,
      location: null,
      startDate: null,
      endDate: dateOnly(b.deadline),
      registrationDeadline: null,
      submissionDeadline: iso(b.deadline),
      prize: bountyReward(b),
      tags: ['Solana', 'Bounty'],
      imageUrl: https(b.sponsor?.logo),
    }));
}

/** Superteam Earn: Solana hackathons and open bounties. Either half may fail alone. */
export async function fetchSuperteam(): Promise<RawListing[]> {
  const [hackathons, bounties] = await Promise.allSettled([superteamHackathons(Date.now()), superteamBounties()]);
  if (hackathons.status === 'rejected' && bounties.status === 'rejected') throw hackathons.reason;
  return [
    ...(hackathons.status === 'fulfilled' ? hackathons.value : []),
    ...(bounties.status === 'fulfilled' ? bounties.value : []),
  ];
}

// ---------- ETHGlobal ----------

const MONTH_INDEX = (word: string) => MONTHS.indexOf(word.slice(0, 3).toLowerCase());
const WEEKDAYS = /^(mon|tue|wed|thu|fri|sat|sun)/i;

/**
 * ETHGlobal has no API. Each event card on /events is a link to /events/<slug> whose text
 * reads like "April 14 16 Wed — Fri ETHGlobal Cannes 2027 Cannes , France IRL Hackathon".
 * Only cards above the "Past" heading are read, and conferences are skipped.
 */
export function parseEthGlobal(html: string, now = new Date()): RawListing[] {
  const pastAt = html.search(/>\s*Past\s*</);
  const upcoming = pastAt > 0 ? html.slice(0, pastAt) : html;
  const out: RawListing[] = [];
  const seen = new Set<string>();
  for (const card of upcoming.split(/<a [^>]*href="\/events\//).slice(1)) {
    const slug = card.match(/^([a-z0-9-]+)"/)?.[1];
    if (!slug || seen.has(slug)) continue;
    const words = [...card.slice(0, 8000).matchAll(/>([^<>]+)</g)].map((m) => decode(m[1]).trim()).filter(Boolean);
    const type = words.find((w) => /hackathon|conference|summit|meetup/i.test(w) && w.length < 40) ?? '';
    if (!/hackathon/i.test(type)) continue;
    seen.add(slug);

    // Date words come first: month, day, optional second month, optional day, then weekdays.
    const dateWords: string[] = [];
    for (const w of words) {
      if (WEEKDAYS.test(w) || w === '—') break;
      dateWords.push(w);
    }
    const weekdayAt = words.findIndex((w) => WEEKDAYS.test(w));
    const afterDays = words.slice(weekdayAt + 1).filter((w) => !WEEKDAYS.test(w) && w !== '—');
    const name = afterDays[0];
    if (!name) continue;
    const typeAt = afterDays.indexOf(type);
    const location = clean(afterDays.slice(1, typeAt > 0 ? typeAt : undefined).join(' ').replace(/\s+,/g, ','));

    let month = -1;
    const days: { m: number; d: number }[] = [];
    for (const w of dateWords) {
      if (/^\d{1,2}$/.test(w) && month >= 0) days.push({ m: month, d: Number(w) });
      else if (MONTH_INDEX(w) >= 0) month = MONTH_INDEX(w);
    }
    // Years come from the name or slug ("cannes2027"). Otherwise the next time that month comes round.
    const named = Number(name.match(/\b(20\d\d)\b/)?.[1] ?? slug.match(/(20\d\d)$/)?.[1] ?? 0);
    const yearFor = (m: number) => named || (m < now.getUTCMonth() ? now.getUTCFullYear() + 1 : now.getUTCFullYear());
    const day = (x: { m: number; d: number } | undefined) => (x ? `${yearFor(x.m)}-${pad(x.m + 1)}-${pad(x.d)}` : null);

    out.push({
      id: `ethglobal:${slug}`,
      source: 'ethglobal',
      name,
      organizer: 'ETHGlobal',
      url: `https://ethglobal.com/events/${slug}`,
      format: /irl|in[- ]person/i.test(type) ? 'IN_PERSON' : /hybrid/i.test(type) ? 'HYBRID' : 'ONLINE',
      location: /irl|in[- ]person|hybrid/i.test(type) ? location : null,
      startDate: day(days[0]),
      endDate: day(days[days.length - 1]),
      registrationDeadline: null,
      submissionDeadline: null,
      prize: null,
      tags: ['Ethereum'],
      // Banner links are signed and expire after an hour, longer than a cached result may live.
      imageUrl: null,
    });
  }
  return out;
}

export async function fetchEthGlobal(): Promise<RawListing[]> {
  const res = await get('https://ethglobal.com/events', { headers: { Accept: 'text/html' } });
  return parseEthGlobal(await res.text());
}

// ---------- Taikai ----------

type Ref = { __ref: string };
type TaikaiChallenge = {
  name: string;
  slug: string;
  isClosed?: boolean;
  isPublic?: boolean;
  shortDescription?: string | null;
  prize?: number | null;
  prizeDecimals?: number | null;
  prizeCurrency?: Ref | null;
  organization?: Ref | null;
  steps?: Ref[];
  industries?: Ref[];
  cardImageFile?: Ref | null;
  logoImageFile?: Ref | null;
};

/** Taikai pages carry their Apollo GraphQL cache, which holds the hackathon list. */
export function parseTaikai(html: string): RawListing[] {
  const cache = nextData<{ props?: { apolloState?: Record<string, Record<string, unknown>> } }>(html)?.props?.apolloState;
  if (!cache) throw new Error('Taikai page has no data');
  const deref = <T,>(r: Ref | null | undefined) => (r ? (cache[r.__ref] as T | undefined) : undefined);
  const out: RawListing[] = [];
  for (const [key, value] of Object.entries(cache)) {
    if (!key.startsWith('Challenge:')) continue;
    const c = value as unknown as TaikaiChallenge;
    if (c.isClosed || c.isPublic === false || !c.name || !c.slug) continue;
    const org = deref<{ name?: string; slug?: string }>(c.organization);
    if (!org?.slug) continue;
    const steps = (c.steps ?? [])
      .map((r) => deref<{ startDate?: string }>(r)?.startDate)
      .filter((d): d is string => Boolean(d))
      .sort();
    const decimals = c.prizeDecimals ?? 0;
    const amount = c.prize ? c.prize / 10 ** decimals : 0;
    out.push({
      id: `taikai:${org.slug}/${c.slug}`,
      source: 'taikai',
      name: c.name.trim(),
      organizer: clean(org.name),
      url: `https://taikai.network/${org.slug}/hackathons/${c.slug}`,
      format: 'ONLINE',
      location: null,
      startDate: dateOnly(steps[0]),
      endDate: dateOnly(steps[steps.length - 1]),
      registrationDeadline: null,
      submissionDeadline: null,
      prize: prizeText([{ amount, currency: deref<{ name?: string }>(c.prizeCurrency)?.name }]),
      tags: (c.industries ?? []).map((r) => deref<{ title?: string }>(r)?.title).filter((t): t is string => Boolean(t)).slice(0, 8),
      imageUrl: https(deref<{ url?: string }>(c.cardImageFile ?? c.logoImageFile)?.url),
      inlineDescription: c.shortDescription ?? null,
    });
  }
  return out;
}

export async function fetchTaikai(): Promise<RawListing[]> {
  const res = await get('https://taikai.network/hackathons', { headers: { Accept: 'text/html' } });
  return parseTaikai(await res.text());
}

// ---------- Unstop ----------

type UnstopItem = {
  id: number;
  title: string;
  seo_url?: string | null;
  end_date?: string | null;
  region?: string | null;
  details?: string | null;
  logoUrl2?: string | null;
  organisation?: { name?: string } | null;
  address_with_country_logo?: { city?: string | null; state?: string | null; country?: { name?: string } | null } | null;
  regnRequirements?: { end_regn_dt?: string | null } | null;
  prizes?: { cash?: number | null; currencyCode?: string | null }[] | null;
  workfunction?: { name?: string }[] | null;
};

export async function fetchUnstop(): Promise<RawListing[]> {
  const out: RawListing[] = [];
  for (let page = 1; page <= 3; page++) {
    const res = await get(`https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&oppstatus=open&per_page=100&page=${page}`);
    const data = ((await res.json()) as { data?: { data?: UnstopItem[]; last_page?: number } }).data;
    for (const h of data?.data ?? []) {
      if (!h.title || !h.seo_url) continue;
      const place = h.address_with_country_logo;
      out.push({
        id: `unstop:${h.id}`,
        source: 'unstop',
        name: h.title.trim(),
        organizer: clean(h.organisation?.name),
        url: h.seo_url,
        format: h.region === 'online' ? 'ONLINE' : h.region === 'hybrid' ? 'HYBRID' : 'IN_PERSON',
        location: h.region === 'online' ? null : clean([place?.city, place?.state, place?.country?.name].filter(Boolean).join(', ')),
        startDate: null,
        // Unstop gives times in India time.
        endDate: dateOnly(h.end_date, 'Asia/Kolkata'),
        registrationDeadline: iso(h.regnRequirements?.end_regn_dt),
        submissionDeadline: null,
        prize: prizeText((h.prizes ?? []).map((p) => ({ amount: p.cash, currency: p.currencyCode }))),
        tags: (h.workfunction ?? []).map((w) => w.name).filter((t): t is string => Boolean(t)).slice(0, 8),
        imageUrl: https(h.logoUrl2),
        inlineDescription: h.details ?? null,
      });
    }
    if (!data?.last_page || page >= data.last_page) break;
  }
  return out;
}

// ---------- HackerEarth ----------

type HackerEarthItem = {
  title: string;
  url: string;
  description?: string | null;
  status?: string;
  start_utc_tz?: string | null;
  end_utc_tz?: string | null;
  thumbnail?: string | null;
};

/** HackerEarth's browser extension feed. It mixes hackathons with coding contests, told apart by URL. */
export async function fetchHackerEarth(): Promise<RawListing[]> {
  const res = await get('https://www.hackerearth.com/chrome-extension/events/');
  const data = (await res.json()) as { response?: HackerEarthItem[] };
  const utc = (v: string | null | undefined) => (v ? iso(v.replace(' ', 'T')) : null);
  return (data.response ?? [])
    .filter((h) => h.url?.includes('/hackathon/') && h.title)
    .map((h) => {
      const end = utc(h.end_utc_tz);
      return {
        id: `hackerearth:${h.url}`,
        source: 'hackerearth' as const,
        name: h.title.trim(),
        organizer: null,
        url: h.url,
        format: 'ONLINE' as const,
        location: null,
        startDate: dateOnly(utc(h.start_utc_tz), 'Asia/Kolkata'),
        endDate: dateOnly(end, 'Asia/Kolkata'),
        registrationDeadline: null,
        submissionDeadline: end,
        prize: null,
        tags: [],
        imageUrl: https(h.thumbnail),
        inlineDescription: h.description?.replace(/\s*\.\.$/, '…') ?? null,
      };
    });
}

// ---------- Hack Club ----------

type HackClubItem = {
  id: string;
  name: string;
  website: string;
  start?: string | null;
  end?: string | null;
  logo?: string | null;
  banner?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  virtual?: boolean;
  hybrid?: boolean;
  mlhAssociated?: boolean;
};

/** Hack Club's directory of high school hackathons. MLH events are skipped, the MLH source has them. */
export async function fetchHackClub(): Promise<RawListing[]> {
  const res = await get('https://hackathons.hackclub.com/api/events/upcoming/');
  const data = (await res.json()) as HackClubItem[];
  return (Array.isArray(data) ? data : [])
    .filter((h) => h.name && https(h.website) && !h.mlhAssociated)
    .map((h) => ({
      id: `hackclub:${h.id}`,
      source: 'hackclub' as const,
      name: h.name.trim(),
      organizer: 'High school hackathon',
      url: https(h.website)!,
      format: h.virtual ? ('ONLINE' as const) : h.hybrid ? ('HYBRID' as const) : ('IN_PERSON' as const),
      location: h.virtual ? null : clean([h.city, h.state, h.country].filter(Boolean).join(', ')),
      startDate: dateOnly(h.start),
      endDate: dateOnly(h.end),
      registrationDeadline: null,
      submissionDeadline: null,
      prize: null,
      tags: ['High school'],
      imageUrl: https(h.banner) ?? https(h.logo),
    }));
}

export const SOURCES: Record<Source, { label: string; fetch: () => Promise<RawListing[]> }> = {
  devpost: { label: 'Devpost', fetch: fetchDevpost },
  dorahacks: { label: 'DoraHacks', fetch: fetchDoraHacks },
  devfolio: { label: 'Devfolio', fetch: fetchDevfolio },
  mlh: { label: 'MLH', fetch: fetchMlh },
  superteam: { label: 'Superteam Earn', fetch: fetchSuperteam },
  ethglobal: { label: 'ETHGlobal', fetch: fetchEthGlobal },
  taikai: { label: 'Taikai', fetch: fetchTaikai },
  unstop: { label: 'Unstop', fetch: fetchUnstop },
  hackerearth: { label: 'HackerEarth', fetch: fetchHackerEarth },
  hackclub: { label: 'Hack Club', fetch: fetchHackClub },
};
