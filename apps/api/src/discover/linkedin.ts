/**
 * LinkedIn events, found through the Tavily search API. LinkedIn itself needs a login and does
 * not allow scraping, so Grind never fetches linkedin.com: it reads only the title, link and
 * snippet the search engine returns. Snippets are short, so many events have no prize or deadline.
 *
 * Off until TAVILY_API_KEY is set. Results are kept for 6 hours, so 3 basic searches per
 * refresh cost about 360 credits a month, inside Tavily's free 1,000 a month.
 */
import { formatInText } from './classify';
import { findDay, findRange } from './dates';
import { decodeEntities } from './enrich';
import { clean, type RawListing } from './sources';

const SEARCH_URL = 'https://api.tavily.com/search';
const CACHE_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 20_000;

export type SearchResult = { title?: string; url?: string; content?: string };

let cache: { at: number; items: RawListing[] } | null = null;

export const linkedInEnabled = () => Boolean(process.env.TAVILY_API_KEY?.trim());

const text = (v: string | undefined) => clean(decodeEntities(v ?? '')) ?? '';

/** "Global AI Hackathon 2027 | LinkedIn" to "Global AI Hackathon 2027". */
const tidyTitle = (title: string) => title.replace(/\s*[|·–—-]\s*LinkedIn\s*$/i, '').trim();

/** One search result as a listing, or null when it is not a dated hackathon event page. */
export function linkedInListing(r: SearchResult): RawListing | null {
  const match = r.url?.match(/^https:\/\/(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/events\/([a-z0-9-]*?)(\d{10,})/i);
  if (!match) return null;
  const name = tidyTitle(text(r.title));
  if (!name || !/hack|buildathon|build-a-thon|ideathon|codefest|game jam/i.test(name)) return null;

  const snippet = text(r.content);
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

/** One basic search (1 credit), limited to linkedin.com. */
async function search(query: string, key: string): Promise<SearchResult[]> {
  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      search_depth: 'basic',
      max_results: 20,
      include_domains: ['linkedin.com'],
      include_answer: false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  const data = (await res.json()) as { results?: SearchResult[] };
  return data.results ?? [];
}

export async function fetchLinkedIn(now = new Date()): Promise<RawListing[]> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return [];
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;

  const year = now.getUTCFullYear();
  const queries = ['LinkedIn events hackathon', `LinkedIn event hackathon ${year}`, `LinkedIn event hackathon ${year + 1}`];
  const seen = new Set<string>();
  const items: RawListing[] = [];
  let failure: unknown = null;
  let answered = 0;
  for (const query of queries) {
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
