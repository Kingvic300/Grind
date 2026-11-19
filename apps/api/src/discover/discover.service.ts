import { BadRequestException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { gzip } from 'zlib';
import { PrismaService } from '../prisma/prisma.service';
import { enrich } from './enrich';
import { ScanError } from './page-fetch';
import { linkKey, scanLink, type ScanResult } from './scan';
import { type Listing, type RawListing, SOURCES, type Source } from './sources';

const CACHE_MS = 30 * 60 * 1000;

export type SourceStatus = { source: Source; label: string; ok: boolean; count: number; error?: string };
export type DiscoverResult = { fetchedAt: string; sources: SourceStatus[]; hackathons: Listing[] };

/** The result as sent to browsers: JSON, its gzip copy, and an ETag. Built once per refresh. */
export type DiscoverPayload = { json: Buffer; gzip: Buffer; etag: string };

const gzipAsync = promisify(gzip);
const SNAPSHOT_ID = 'latest';

/**
 * Collects open and upcoming hackathons from public sites. Refreshes every 30 minutes in
 * the background and serves the last good result meanwhile, because reading every event
 * page for descriptions takes several seconds.
 */
@Injectable()
export class DiscoverService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DiscoverService.name);
  private cache: { at: number; result: DiscoverResult; payload: DiscoverPayload } | null = null;
  private pending: Promise<DiscoverResult> | null = null;
  private restoring: Promise<void> | null = null;
  /** Descriptions by listing id, so each event page is fetched only once. */
  private readonly descriptions = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    this.restoring = this.restore();
    void this.refresh().catch(() => undefined);
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  scheduled() {
    void this.refresh().catch(() => undefined);
  }

  async list(): Promise<DiscoverResult> {
    return (await this.current()).result;
  }

  /** The response body, ready to send. */
  async payload(): Promise<DiscoverPayload> {
    return (await this.current()).payload;
  }

  private async current() {
    // Right after a restart, the saved snapshot answers while the sources load.
    if (!this.cache && this.restoring) await this.restoring;
    if (!this.cache) await this.refresh();
    if (!this.cache) throw new Error('Discover has no result yet.');
    if (Date.now() - this.cache.at > CACHE_MS) void this.refresh().catch(() => undefined);
    return this.cache;
  }

  /** Loads the last saved result, and its descriptions so they are not fetched again. */
  private async restore() {
    try {
      const row = await this.prisma.discoverSnapshot.findUnique({ where: { id: SNAPSHOT_ID } });
      if (!row || this.cache) return;
      const result = row.data as unknown as DiscoverResult;
      for (const h of result.hackathons) if (h.description) this.descriptions.set(h.id, h.description);
      await this.setCache(result, row.fetchedAt.getTime());
    } catch (error) {
      this.logger.warn(`Could not read the saved Discover result: ${(error as Error).message}`);
    }
  }

  private async setCache(result: DiscoverResult, at: number) {
    const json = Buffer.from(JSON.stringify(result));
    const payload = { json, gzip: await gzipAsync(json), etag: `"${createHash('sha1').update(json).digest('base64url')}"` };
    // A fresher result may have landed while this one was compressing.
    if (this.cache && this.cache.at > at) return;
    this.cache = { at, result, payload };
  }

  private save(result: DiscoverResult) {
    const data = result as unknown as Prisma.InputJsonValue;
    const fetchedAt = new Date(result.fetchedAt);
    this.prisma.discoverSnapshot
      .upsert({ where: { id: SNAPSHOT_ID }, create: { id: SNAPSHOT_ID, data, fetchedAt }, update: { data, fetchedAt } })
      .catch((error: Error) => this.logger.warn(`Could not save the Discover result: ${error.message}`));
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
    const entries = (Object.entries(SOURCES) as [Source, (typeof SOURCES)[Source]][]).filter(([, s]) => s.enabled?.() ?? true);
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
    if (sources.some((s) => s.ok) || !this.cache) {
      await this.setCache(result, Date.now());
      if (sources.some((s) => s.ok)) this.save(result);
    }
    return this.cache!.result;
  }
}
