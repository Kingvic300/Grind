import { classify, formatFromText } from './classify';
import { clean, get, type Listing, type RawListing } from './sources';

const DESCRIPTION_CHARS = 600;
const CLASSIFY_CHARS = 6000;
const CONCURRENCY = 6;
const MAX_PAGE_BYTES = 3_000_000;

/** Turns HTML entities such as "&amp;" and "&#x27;" back into characters. */
export const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

/** Markdown or HTML to one line of plain text. */
export function plain(text: string | null | undefined): string {
  if (!text) return '';
  const noTags = text
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  // Decode entities before stripping markdown symbols, or "&#39;" loses its "#".
  return decodeEntities(noTags)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(^|\s)[#*_`>|~]+/g, '$1')
    .replace(/[*_`~]+(\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Only fetch public https pages by name. MLH event links point at organisers' own sites,
 * so this keeps the server from being pointed at internal addresses.
 */
function isPublicHttps(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return false;
    if (/^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) return false;
    return host.includes('.');
  } catch {
    return false;
  }
}

async function pageText(url: string): Promise<string> {
  if (!isPublicHttps(url)) return '';
  const res = await get(url, { redirect: 'follow', headers: { Accept: 'text/html' } });
  if (!isPublicHttps(res.url || url)) return '';
  if (Number(res.headers.get('content-length') ?? 0) > MAX_PAGE_BYTES) return '';
  return (await res.text()).slice(0, MAX_PAGE_BYTES);
}

const metaDescription = (html: string) =>
  html.match(/<meta[^>]+(?:name|property)="(?:og:)?description"[^>]+content="([^"]*)"/i)?.[1] ??
  html.match(/<meta[^>]+content="([^"]*)"[^>]+(?:name|property)="(?:og:)?description"/i)?.[1] ??
  '';

/** Fetches the long description for one listing from its own page or API. */
async function describe(h: RawListing): Promise<string> {
  if (h.inlineDescription) return plain(h.inlineDescription);
  switch (h.source) {
    case 'dorahacks': {
      const uname = h.url.split('/hackathon/')[1];
      if (!uname) return '';
      const res = await get(`https://dorahacks.io/api/v1/hub/hackathons/${uname}`);
      const d = (await res.json()) as { summary?: string; description?: string };
      return plain([d.summary, d.description].filter(Boolean).join('. '));
    }
    // Devpost refuses page requests from bots, so its listings are tagged from name and themes.
    case 'devpost':
      return '';
    // These link to an event page with a usable meta description.
    case 'mlh':
    case 'hackclub':
    case 'ethglobal':
    case 'superteam':
      return plain(metaDescription(await pageText(h.url)));
    default:
      return '';
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Adds a description, categories and tech stack to each listing. Descriptions are kept in
 * `known` between refreshes, so each event page is fetched once, not every 30 minutes.
 */
export async function enrich(raw: RawListing[], known: Map<string, string>): Promise<Listing[]> {
  return mapLimit(raw, CONCURRENCY, async (h) => {
    let text = known.get(h.id);
    if (text === undefined) {
      text = await describe(h).catch(() => '');
      known.set(h.id, text);
    }
    const { inlineDescription: _inline, ...rest } = h;
    const haystack = [h.name, h.organizer, ...h.tags, text.slice(0, CLASSIFY_CHARS)].filter(Boolean).join(' . ');
    const { categories, stack } = classify(haystack);
    const short = text.length > DESCRIPTION_CHARS ? `${text.slice(0, DESCRIPTION_CHARS).replace(/\s+\S*$/, '')}…` : text;
    const format = formatFromText([h.name, ...h.tags, text.slice(0, CLASSIFY_CHARS)].join(' . '), h.format);
    return { ...rest, kind: h.kind ?? 'hackathon', format, description: clean(short), categories, stack };
  });
}
