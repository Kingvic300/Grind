import { BadRequestException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { enrich } from './enrich';
import { ScanError } from './page-fetch';
import { linkKey, scanLink, type ScanResult } from './scan';
import { type Listing, type RawListing, SOURCES, type Source } from './sources';

const CACHE_MS = 30 * 60 * 1000;

export type SourceStatus = { source: Source; label: string; ok: boolean; count: number; error?: string };
export type DiscoverResult = { fetchedAt: string; sources: SourceStatus[]; hackathons: Listing[] };

/**
 * Collects open and upcoming hackathons from public sites. Refreshes every 30 minutes in
 * the background and serves the last good result meanwhile, because reading every event
 * page for descriptions takes several seconds.
 */
@Injectable()
export class DiscoverService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DiscoverService.name);
  private cache: { at: number; result: DiscoverResult } | null = null;
  private pending: Promise<DiscoverResult> | null = null;
  /** Descriptions by listing id, so each event page is fetched only once. */
  private readonly descriptions = new Map<string, string>();

  onApplicationBootstrap() {
    void this.refresh().catch(() => undefined);
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  scheduled() {
    void this.refresh().catch(() => undefined);
  }

  async list(): Promise<DiscoverResult> {
    if (this.cache) {
      if (Date.now() - this.cache.at > CACHE_MS) void this.refresh().catch(() => undefined);
      return this.cache.result;
    }
    return this.refresh();
  }

  /** Reads one hackathon from a pasted link, to fill the Add hackathon form. */
  async scan(url: string): Promise<ScanResult> {
    try {
      return await scanLink(url, (key) => this.cache?.result.hackathons.find((h) => linkKey(h.url) === key) ?? null);
    } catch (error) {
      if (error instanceof ScanError) throw new BadRequestException(error.message);
      this.logger.warn(`Scan of ${url} failed: ${(error as Error).message}`);
      throw new BadRequestException('Grind could not read that page. Try again, or fill the form in yourself.');
    }
  }

  /** Many callers at once share one fetch. */
  private refresh(): Promise<DiscoverResult> {
    this.pending ??= this.load().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async load(): Promise<DiscoverResult> {
    const entries = Object.entries(SOURCES) as [Source, (typeof SOURCES)[Source]][];
    const settled = await Promise.allSettled(entries.map(([, s]) => s.fetch()));
    const today = new Date().toISOString().slice(0, 10);
    const sources: SourceStatus[] = [];
    const raw: RawListing[] = [];

    settled.forEach((outcome, i) => {
      const [source, { label }] = entries[i];
      if (outcome.status === 'rejected') {
        const error = (outcome.reason as Error)?.message ?? 'Unknown error';
        this.logger.warn(`${label} fetch failed: ${error}`);
        sources.push({ source, label, ok: false, count: 0, error: `${label} did not respond. Try again later.` });
        return;
      }
      // Drop events that already ended.
      const live = outcome.value.filter((h) => !h.endDate || h.endDate >= today);
      sources.push({ source, label, ok: true, count: live.length });
      raw.push(...live);
    });

    // Directories overlap (Hack Club and MLH both list some events), so keep the first copy of each link.
    const seenLinks = new Set<string>();
    const unique = raw.filter((h) => {
      const link = h.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
      if (seenLinks.has(link)) return false;
      seenLinks.add(link);
      return true;
    });

    // Forget descriptions of events that dropped off, so the map does not grow forever.
    const ids = new Set(unique.map((h) => h.id));
    for (const id of this.descriptions.keys()) if (!ids.has(id)) this.descriptions.delete(id);

    const started = Date.now();
    const hackathons = await enrich(unique, this.descriptions);
    this.logger.log(`Discover refreshed: ${hackathons.length} hackathons in ${Date.now() - started} ms`);

    const far = '9999-12-31';
    hackathons.sort((a, b) => (a.startDate ?? far).localeCompare(b.startDate ?? far) || a.name.localeCompare(b.name));
    const result = { fetchedAt: new Date().toISOString(), sources, hackathons };
    // Keep the old result when every source failed, so the page still has something to show.
    if (sources.some((s) => s.ok) || !this.cache) this.cache = { at: Date.now(), result };
    return this.cache.result;
  }
}
