/**
 * LinkedIn events, found through the Brave Search API. LinkedIn itself needs a login and does
 * not allow scraping, so Grind never fetches linkedin.com: it reads only the title, link and
 * snippet the search engine returns. Snippets are short, so many events have no prize or deadline.
 *
 * Off until BRAVE_SEARCH_API_KEY is set. Results are kept for 6 hours, so 3 searches per
 * refresh cost about 360 searches a month.
 */
import { formatInText } from './classify';
import { findDay, findRange } from './dates';
import { decodeEntities } from './enrich';
import { clean, type RawListing } from './sources';

const SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';
const CACHE_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 12_000;
/** Brave's free plan allows one request a second. */
const GAP_MS = 1100;

type BraveResult = { title?: string; url?: string; description?: string; extra_snippets?: string[] };

let cache: { at: number; items: RawListing[] } | null = null;

export const linkedInEnabled = () => Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim());

const text = (v: string | undefined) => clean(decodeEntities(v ?? '')) ?? '';

/** "Global AI Hackathon 2027 | LinkedIn" to "Global AI Hackathon 2027". */
const tidyTitle = (title: string) => title.replace(/\s*[|·–—-]\s*LinkedIn\s*$/i, '').trim();

/** One search result as a listing, or null when it is not a dated hackathon event page. */
export function linkedInListing(r: BraveResult): RawListing | null {
  const match = r.url?.match(/^https:\/\/(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/events\/([a-z0-9-]*?)(\d{10,})/i);
  if (!match) return null;
  const name = tidyTitle(text(r.title));
  if (!name || !/hack|buildathon|build-a-thon|ideathon|codefest|game jam/i.test(name)) return null;

  const snippet = [r.description, ...(r.extra_snippets ?? [])].map(text).filter(Boolean).join(' . ');
  const range = findRange(snippet);
  const start = range?.start ?? findDay(snippet);
  // Undated results are often old events the search engine still has, so they are left out.
  if (!start) return null;

  // "Event by Lablab.ai · Online event": the name runs to a separator, a sentence end, or the format words.
  const organizer = snippet.match(/\b(?:event by|hosted by|organi[sz]ed by)\s+(.{2,80}?)(?=\s*[·|•]|\.\s|\s+(?:online|in[- ]person|on[- ]site)\b|$)/i)?.[1] ?? null;
  return {
    id: `linkedin:${match[2]}`,
    source: 'linkedin',
    name: name.slice(0, 120),
    organizer: clean(organizer),
    url: `https://www.linkedin.com/events/${match[1]}${match[2]}/`,
    // Most LinkedIn events are online; venues only show in the text when there is one.
    format: formatInText(`${name} . ${snippet}`) ?? 'ONLINE',
    location: null,
    startDate: start,
    endDate: range?.end ?? start,
    registrationDeadline: null,
    submissionDeadline: null,
    prize: null,
    tags: ['LinkedIn event'],
    imageUrl: null,
    inlineDescription: snippet,
  };
}

async function search(query: string, key: string): Promise<BraveResult[]> {
  const url = `${SEARCH_URL}?${new URLSearchParams({ q: query, count: '20', safesearch: 'strict', text_decorations: 'false' })}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Brave Search HTTP ${res.status}`);
  const data = (await res.json()) as { web?: { results?: BraveResult[] } };
  return data.web?.results ?? [];
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchLinkedIn(now = new Date()): Promise<RawListing[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!key) return [];
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;

  const year = now.getUTCFullYear();
  const queries = ['site:linkedin.com/events hackathon', `site:linkedin.com/events hackathon ${year}`, `site:linkedin.com/events hackathon ${year + 1}`];
  const seen = new Set<string>();
  const items: RawListing[] = [];
  let failure: unknown = null;
  let answered = 0;
  for (const [i, query] of queries.entries()) {
    if (i) await wait(GAP_MS);
    try {
      for (const r of await search(query, key)) {
        const listing = linkedInListing(r);
        if (listing && !seen.has(listing.id)) {
          seen.add(listing.id);
          items.push(listing);
        }
      }
      answered++;
    } catch (error) {
      failure = error;
    }
  }
  if (!answered) {
    // Keep showing the last good result rather than nothing.
    if (cache) return cache.items;
    throw failure;
  }
  cache = { at: Date.now(), items };
  return items;
}
