/**
 * Reads one hackathon from a link someone pasted, to fill the Add hackathon form.
 * Known sites are read through the same endpoints Discover uses. Any other page is read
 * from its schema.org Event data, its meta tags, and finally the page text. Luma,
 * Eventbrite and Meetup pages carry full Event data, so they need no site-specific code.
 * Rules only, no AI: what is found is a draft the person checks before saving.
 */
import { classify, formatFromText, formatInText } from './classify';
import { decodeEntities, plain } from './enrich';
import { fetchPage, publicUrl, ScanError } from './page-fetch';
import {
  clean, dayIn, devfolioListing, devpostListing, doraListing, fetchHackerEarth, get, https, iso, nextData, prizeText, SOURCES, unstopListing,
  type DevfolioItem, type DevpostItem, type DoraItem, type Listing, type ListingFormat, type RawListing, type Source, type UnstopItem,
} from './sources';

export type ScanResult = {
  name: string;
  organizer: string | null;
  url: string;
  format: ListingFormat | null;
  location: string | null;
  /** Event days as "YYYY-MM-DD". */
  startDate: string | null;
  endDate: string | null;
  /** An ISO moment when the site gives one, or a "YYYY-MM-DD" day read from page text. */
  registrationDeadline: string | null;
  submissionDeadline: string | null;
  /** Prize pool as text, such as "$10,000 in prizes". */
  prize: string | null;
  stack: string[];
  /** Where the details came from: a site name such as "Devpost", or the page's host. */
  site: string;
};

const CLASSIFY_CHARS = 6000;
const TEXT_CHARS = 60_000;

/** Same link with or without scheme, www, query or trailing slash. */
export const linkKey = (url: string) =>
  url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');

/** A Discover listing as a scan result. Raw listings from a site API get tagged here the way enrich() tags them. */
function fromListing(h: RawListing | Listing, site: string, description = ''): ScanResult {
  const text = [h.name, ...h.tags, description.slice(0, CLASSIFY_CHARS)].join(' . ');
  const tagged = 'stack' in h;
  return {
    name: h.name,
    organizer: h.organizer,
    url: h.url,
    format: tagged ? h.format : formatFromText(text, h.format),
    location: h.location,
    startDate: h.startDate,
    endDate: h.endDate,
    registrationDeadline: h.registrationDeadline,
    submissionDeadline: h.submissionDeadline,
    prize: h.prize,
    stack: tagged ? h.stack : classify(text).stack,
    site,
  };
}

// ---------- Known sites ----------

const SUBDOMAIN_SKIP = new Set(['www', 'api', 'help', 'info', 'secure', 'blog', 'org', 'assets', 'docs']);

/** Devpost refuses page requests from bots, but its search finds a hackathon by its subdomain. */
async function devpost(url: URL): Promise<ScanResult | null> {
  const slug = url.hostname.match(/^([a-z0-9-]+)\.devpost\.com$/)?.[1];
  if (!slug || SUBDOMAIN_SKIP.has(slug)) return null;
  for (const query of [slug.replace(/-/g, ' '), slug]) {
    const res = await get(`https://devpost.com/api/hackathons?search=${encodeURIComponent(query)}`);
    const data = (await res.json()) as { hackathons?: DevpostItem[] };
    const hit = data.hackathons?.find((h) => {
      try {
        return new URL(h.url).hostname === url.hostname;
      } catch {
        return false;
      }
    });
    if (hit) return fromListing(devpostListing(hit), 'Devpost');
  }
  throw new ScanError('Devpost did not return that hackathon. Check the link, or fill the form in yourself.');
}

async function dorahacks(url: URL): Promise<ScanResult | null> {
  if (url.hostname !== 'dorahacks.io') return null;
  const uname = url.pathname.match(/^\/hackathon\/([^/]+)/)?.[1];
  if (!uname) return null;
  const res = await get(`https://dorahacks.io/api/v1/hub/hackathons/${encodeURIComponent(decodeURIComponent(uname))}`);
  const d = (await res.json()) as DoraItem & { summary?: string; description?: string };
  if (!d?.title) return null;
  return fromListing(doraListing(d), 'DoraHacks', plain([d.summary, d.description].filter(Boolean).join('. ')));
}

async function devfolio(url: URL): Promise<ScanResult | null> {
  const slug = url.hostname.match(/^([a-z0-9-]+)\.devfolio\.co$/)?.[1];
  if (!slug || SUBDOMAIN_SKIP.has(slug)) return null;
  const res = await get(`https://api.devfolio.co/api/hackathons/${encodeURIComponent(slug)}`);
  const d = (await res.json()) as DevfolioItem;
  if (!d?.name) return null;
  const raw = devfolioListing(d);
  return fromListing(raw, 'Devfolio', plain(raw.inlineDescription));
}

type TaikaiStep = { name?: string | null; startDate?: string | null };
type TaikaiPage = {
  name?: string;
  slug?: string;
  shortDescription?: string | null;
  prize?: number | null;
  prizeDecimals?: number | null;
  prizeCurrency?: { name?: string } | null;
  organization?: { name?: string; slug?: string } | null;
  endParticipantRegistrationDate?: string | null;
  steps?: TaikaiStep[] | null;
  industries?: { title?: string }[] | null;
  categories?: { name?: string }[] | null;
  logoImageFile?: { url?: string } | null;
};

/**
 * Taikai event pages carry the challenge in their Next.js data. Its timeline is a list of
 * named steps with start times only, so the event and submission dates are read from names:
 * the kick-off or hacking step opens the event, and a "Submission deadline" or the start of
 * judging closes submissions.
 */
async function taikai(url: URL): Promise<ScanResult | null> {
  if (url.hostname !== 'taikai.network') return null;
  const [, org, slug] = url.pathname.match(/^\/([^/]+)\/hackathons\/([^/]+)/) ?? [];
  if (!org || !slug) return null;
  const page = `https://taikai.network/${org}/hackathons/${slug}`;
  const html = await (await get(page, { headers: { Accept: 'text/html' } })).text();
  const c = nextData<{ props?: { pageProps?: { challengeProps?: { challengeBySlug?: TaikaiPage } } } }>(html)?.props?.pageProps?.challengeProps?.challengeBySlug;
  if (!c?.name) return null;

  const steps = (c.steps ?? []).filter((x): x is { name: string; startDate: string } => Boolean(x?.name && x.startDate));
  const at = (re: RegExp) => steps.find((x) => re.test(x.name))?.startDate ?? null;
  const start = at(/kick-?off|hackathon.*start|start.*hackathon|hacking|develop|building/i) ?? steps[0]?.startDate ?? null;
  const end = steps[steps.length - 1]?.startDate ?? null;
  const amount = c.prize ? c.prize / 10 ** (c.prizeDecimals ?? 0) : 0;
  return fromListing(
    {
      id: `taikai:${org}/${slug}`,
      source: 'taikai',
      name: c.name.trim(),
      organizer: clean(c.organization?.name),
      url: page,
      format: 'ONLINE',
      location: null,
      startDate: start ? dayIn(start) : null,
      endDate: end ? dayIn(end) : null,
      registrationDeadline: iso(c.endParticipantRegistrationDate) ?? at(/registration (deadline|close)|last call/i),
      submissionDeadline: at(/submission(s)? (deadline|close|end)/i) ?? at(/^\s*(evaluation|judging|voting)/i),
      prize: prizeText([{ amount, currency: c.prizeCurrency?.name }]),
      tags: [...(c.industries ?? []).map((i) => i.title), ...(c.categories ?? []).map((i) => i.name)].filter((t): t is string => Boolean(t)),
      imageUrl: https(c.logoImageFile?.url),
    },
    'Taikai',
    plain(c.shortDescription),
  );
}

/** Unstop pages are an empty app shell, but the number at the end of the link opens its competition API. */
async function unstop(url: URL): Promise<ScanResult | null> {
  if (url.hostname !== 'unstop.com') return null;
  const id = url.pathname.match(/-(\d{5,})\/?$/)?.[1];
  if (!id) return null;
  const res = await get(`https://unstop.com/api/public/competition/${id}`);
  const c = ((await res.json()) as { data?: { competition?: UnstopItem } }).data?.competition;
  if (!c?.title) return null;
  const raw = unstopListing(c);
  return fromListing(raw, 'Unstop', plain(raw.inlineDescription));
}

/**
 * HackerEarth hackathon links redirect to the organiser's own site, often with no dates on it.
 * HackerEarth's event feed has the dates for open and upcoming ones, so look the link up there.
 */
async function hackerearth(url: URL): Promise<ScanResult | null> {
  if (!/(^|\.)hackerearth\.com$/.test(url.hostname) || !url.pathname.includes('/hackathon/')) return null;
  const key = linkKey(url.toString());
  const hit = (await fetchHackerEarth()).find((h) => linkKey(h.url) === key);
  return hit ? fromListing(hit, 'HackerEarth', plain(hit.inlineDescription)) : null;
}

// ---------- Any page ----------

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? clean(plain(v)) : null);
/** Entities decoded and tags dropped, but symbols such as "|" kept, so titles can still be split. */
const text1 = (v: unknown): string | null => (typeof v === 'string' ? clean(decodeEntities(v)) : null);

/** Every object in the page's JSON-LD blocks, including those inside @graph. */
function jsonLd(html: string): Json[] {
  const out: Json[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 4) return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    if (!isObject(v)) return;
    out.push(v);
    if (v['@graph']) walk(v['@graph'], depth + 1);
  };
  for (const m of html.matchAll(/<script[^>]+type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1].trim()), 0);
    } catch {
      // A broken block on someone else's page is not our problem; skip it.
    }
  }
  return out;
}

const types = (o: Json) => ([] as unknown[]).concat(o['@type'] ?? []).filter((t): t is string => typeof t === 'string');

function nameOf(v: unknown): string | null {
  if (typeof v === 'string') return text1(v);
  if (Array.isArray(v)) return v.map(nameOf).find(Boolean) ?? null;
  return isObject(v) ? text1(v.name) : null;
}

function placeOf(v: unknown): string | null {
  if (typeof v === 'string') return str(v);
  if (Array.isArray(v)) return v.map(placeOf).find(Boolean) ?? null;
  if (!isObject(v) || types(v).includes('VirtualLocation')) return null;
  const a = v.address;
  const address = typeof a === 'string' ? [a]
    : isObject(a) ? [a.addressLocality, a.addressRegion, nameOf(a.addressCountry)]
    : [];
  const parts = [v.name, ...address].map((p) => (typeof p === 'string' ? clean(p) : null)).filter((p): p is string => Boolean(p));
  return clean([...new Set(parts)].join(', '))?.slice(0, 120) ?? null;
}

/** "2026-11-20T09:00:00-05:00" to the event's own calendar day. */
const dayOf = (v: unknown): string | null => (typeof v === 'string' ? (v.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null) : null);

/**
 * When ticket sales close, from schema.org offers. Eventbrite stops sign-ups then, so it is
 * the registration deadline. The latest close wins when there are several ticket types.
 */
function salesEnd(offers: unknown): string | null {
  const ends = ([] as unknown[]).concat(offers ?? [])
    .map((o) => (isObject(o) && typeof o.availabilityEnds === 'string' ? Date.parse(o.availabilityEnds) : NaN))
    .filter((t) => !Number.isNaN(t));
  return ends.length ? new Date(Math.max(...ends)).toISOString() : null;
}

/** Event platforms whose pages do not name themselves in og:site_name. */
const PLATFORMS: [RegExp, string][] = [
  [/(^|\.)(lu\.ma|luma\.com)$/, 'Luma'],
  [/(^|\.)eventbrite\.[a-z.]+$/, 'Eventbrite'],
  [/(^|\.)meetup\.com$/, 'Meetup'],
  [/(^|\.)taikai\.network$/, 'Taikai'],
  [/(^|\.)unstop\.com$/, 'Unstop'],
];
const platformOf = (host: string) => PLATFORMS.find(([re]) => re.test(host))?.[1] ?? null;

function meta(html: string, key: string): string | null {
  const k = key.replace(/[.:]/g, '\\$&');
  const value =
    html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${k}["'][^>]*content=["']([^"']*)["']`, 'i'))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${k}["']`, 'i'))?.[1];
  return text1(value);
}

const itemprop = (html: string, prop: string) =>
  html.match(new RegExp(`itemprop=["']${prop}["'][^>]*(?:content|datetime)=["']([^"']+)["']`, 'i'))?.[1] ?? null;

/**
 * "Kiroween 2026 | Devpost" to "Kiroween 2026", "Hack Western | Canada's Premier..." to "Hack Western".
 * Event sites put their own name first and platforms put theirs last, so the first part wins.
 */
function tidyTitle(title: string | null): string | null {
  if (!title) return null;
  const parts = title.split(/\s+[|·•–—-]\s+|\s+::\s+/).map((p) => p.trim()).filter(Boolean);
  const best = parts.find((p) => !/^(home|home page|welcome)$/i.test(p)) ?? parts[0];
  return clean(best ?? '')?.slice(0, 120) ?? null;
}

// ---------- Dates, deadlines and prizes in page text ----------

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

const CLOSE_WORDS = '(?:close[sd]?|closing|ends?|deadline|due|by|until|before)';
const REGISTRATION_KEY = new RegExp(`\\b(?:registrations?|applications?|apply|sign[- ]?ups?|rsvps?)\\b[^.]{0,30}?\\b${CLOSE_WORDS}\\b`, 'gi');
const SUBMISSION_KEY = new RegExp(`\\b(?:submissions?|projects?)\\b[^.]{0,30}?\\b${CLOSE_WORDS}\\b|\\bsubmission deadline\\b`, 'gi');

/** A date shortly after a phrase such as "Registration closes" or "Submission deadline". */
export function findDeadline(text: string, key: RegExp): string | null {
  for (const m of text.matchAll(key)) {
    const day = findDay(text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 60));
    if (day) return day;
  }
  return null;
}

const MONEY = '(?:[$€£₹]\\s?\\d[\\d,]*(?:\\.\\d+)?(?:\\s?(?:k|m|million|thousand)\\b)?(?:\\s?(?:usd|usdc|usdt)\\b)?|\\b\\d[\\d,]*(?:\\.\\d+)?\\s?(?:k\\s?)?(?:usd|usdc|usdt|eur|gbp|inr|ngn)\\b)';
const PRIZE_AFTER = new RegExp(`(${MONEY})\\+?\\s+(?:in\\s+|worth\\s+of\\s+)?(?:total\\s+)?(?:cash\\s+)?(?:prizes?|prize pool|bounties|rewards)\\b`, 'i');
const PRIZE_BEFORE = new RegExp(`\\b(?:prize pool|total prizes?|prizes? worth|prize money|reward pool|total rewards?)\\b\\s*(?:of|:|is|worth|up to)?\\s*(${MONEY})`, 'i');

export function findPrize(text: string): string | null {
  const money = (text.match(PRIZE_AFTER) ?? text.match(PRIZE_BEFORE))?.[1]?.replace(/\s+/g, ' ').trim();
  return money ? `${money} in prizes` : null;
}

/** Reads a hackathon from any page's HTML. Exported for tests. */
export function parsePage(html: string, url: URL): ScanResult | null {
  const event = jsonLd(html).find((o) => types(o).some((t) => /event$|hackathon/i.test(t)));
  const siteName = meta(html, 'og:site_name');
  const title =
    nameOf(event?.name) ??
    tidyTitle(meta(html, 'og:title') ?? meta(html, 'twitter:title') ?? text1(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])) ??
    text1(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])?.slice(0, 120) ?? null;
  if (!title) return null;

  const description = str(event?.description) ?? meta(html, 'og:description') ?? meta(html, 'description') ?? '';
  const body = html.search(/<body[\s>]/i);
  const text = plain(html.slice(body > 0 ? body : 0)).slice(0, TEXT_CHARS);
  const all = `${title} . ${description} . ${text}`;

  const mode = typeof event?.eventAttendanceMode === 'string' ? event.eventAttendanceMode : '';
  const format: ListingFormat | null = /mixed/i.test(mode) ? 'HYBRID' : /online/i.test(mode) ? 'ONLINE' : /offline/i.test(mode) ? 'IN_PERSON' : formatInText(all);

  const range = findRange(`${description} . ${text}`);
  const startDate = dayOf(event?.startDate) ?? dayOf(itemprop(html, 'startDate')) ?? range?.start ?? null;
  const endDate = dayOf(event?.endDate) ?? dayOf(itemprop(html, 'endDate')) ?? range?.end ?? null;

  return {
    name: title,
    organizer: nameOf(event?.organizer)?.slice(0, 120) ?? null,
    url: url.toString(),
    format,
    location: format === 'ONLINE' ? null : placeOf(event?.location),
    startDate,
    endDate: endDate && startDate && endDate < startDate ? null : endDate,
    registrationDeadline: findDeadline(text, REGISTRATION_KEY) ?? salesEnd(event?.offers),
    submissionDeadline: findDeadline(text, SUBMISSION_KEY),
    prize: findPrize(`${description} . ${text}`),
    stack: classify(`${title} . ${description} . ${text.slice(0, CLASSIFY_CHARS)}`).stack,
    site: platformOf(url.hostname) ?? (siteName && siteName.length <= 40 ? siteName : url.hostname.replace(/^www\./, '')),
  };
}

/**
 * Reads the hackathon behind a link. `cached` looks the link up in Discover's last result,
 * which already holds clean details for every listed event.
 */
const READ_FRESH = new Set<Source>(['taikai', 'unstop']);

export async function scanLink(input: string, cached: (key: string) => Listing | null): Promise<ScanResult> {
  const url = publicUrl(input);
  const listed = cached(linkKey(url.toString()));
  // Taikai and Unstop pages have dates their listings lack, so they are always read fresh.
  if (listed && !READ_FRESH.has(listed.source)) return fromListing(listed, SOURCES[listed.source].label);

  for (const site of [devpost, dorahacks, devfolio, taikai, unstop, hackerearth]) {
    try {
      const found = await site(url);
      if (found) return found;
    } catch (error) {
      if (error instanceof ScanError) throw error;
      // The site's API failed. Reading the page itself may still work.
      break;
    }
  }

  const page = await fetchPage(url);
  const found = parsePage(page.html, page.url);
  if (!found) throw new ScanError('Grind could not find a hackathon on that page. Fill the form in yourself.');
  return found;
}
