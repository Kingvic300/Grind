import { Injectable, Logger } from '@nestjs/common';
import { type Listing, SOURCES, type Source } from './sources';

const CACHE_MS = 30 * 60 * 1000;

export type SourceStatus = { source: Source; label: string; ok: boolean; count: number; error?: string };
export type DiscoverResult = { fetchedAt: string; sources: SourceStatus[]; hackathons: Listing[] };

/** Collects open and upcoming hackathons from public sites. Cached for 30 minutes. */
@Injectable()
export class DiscoverService {
  private readonly logger = new Logger(DiscoverService.name);
  private cache: { at: number; result: DiscoverResult } | null = null;
  private pending: Promise<DiscoverResult> | null = null;

  async list(): Promise<DiscoverResult> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.result;
    // Many people opening the page at once share one fetch.
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
    const hackathons: Listing[] = [];

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
      hackathons.push(...live);
    });

    const far = '9999-12-31';
    hackathons.sort((a, b) => (a.startDate ?? far).localeCompare(b.startDate ?? far) || a.name.localeCompare(b.name));
    const result = { fetchedAt: new Date().toISOString(), sources, hackathons };
    // Do not keep a result where every source failed, so the next visit tries again.
    if (sources.some((s) => s.ok)) this.cache = { at: Date.now(), result };
    return result;
  }
}
