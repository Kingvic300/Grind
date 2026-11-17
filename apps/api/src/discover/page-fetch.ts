import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';
import type { Readable } from 'node:stream';
import zlib from 'node:zlib';

/** A problem worth showing to the person who pasted the link. */
export class ScanError extends Error {}

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 5;

/**
 * Private, loopback, link-local and reserved ranges. People paste any link they like, so the
 * server must never be used to reach its own network or the cloud metadata address.
 */
const BLOCKED = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) BLOCKED.addSubnet(net, prefix, 'ipv4');
// No ::ffff:0:0/96 rule: BlockList already checks IPv4-mapped addresses against the IPv4 rules,
// and that rule would match every IPv4 address.
for (const [net, prefix] of [
  ['::', 128], ['::1', 128], ['100::', 64], ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) BLOCKED.addSubnet(net, prefix, 'ipv6');

const isBlocked = (a: LookupAddress) => BLOCKED.check(a.address, a.family === 6 ? 'ipv6' : 'ipv4');

/**
 * DNS lookup that refuses private addresses. Checking inside the connection's own lookup,
 * not before the request, means a name cannot resolve to a public address for the check
 * and a private one for the connection.
 */
function safeLookup(hostname: string, options: object, callback: (...args: unknown[]) => void): void {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    const list = addresses as unknown as LookupAddress[];
    if (!list.length || list.some(isBlocked)) {
      return callback(Object.assign(new Error('Address not allowed'), { code: 'EBLOCKED' }));
    }
    if ((options as { all?: boolean }).all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

/** Turns what someone pasted into a URL Grind may fetch, or throws ScanError. */
export function publicUrl(input: string): URL {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new ScanError('That does not look like a link. Paste the full address of the hackathon page.');
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ScanError('Links must start with http:// or https://');
  if (url.username || url.password || url.port) throw new ScanError('Paste a plain web address, without a port or login in it.');
  if (isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.') || /\.(local|localhost|internal)$/.test(host) || host === 'localhost') {
    throw new ScanError('Paste the address of a public web page.');
  }
  url.hash = '';
  return url;
}

type Reply = { status: number; location: string | null; body: string };

function request(url: URL): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(
      url,
      {
        lookup: safeLookup as never,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GrindHackathonTracker/1.0)',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location ?? null, body: '' });
        }
        const type = String(res.headers['content-type'] ?? '');
        if (status >= 400 || (type && !/html|xml/i.test(type))) {
          res.resume();
          return resolve({ status: status >= 400 ? status : 415, location: null, body: '' });
        }
        const encoding = String(res.headers['content-encoding'] ?? '').toLowerCase();
        const stream: Readable =
          encoding === 'gzip' || encoding === 'x-gzip' ? res.pipe(zlib.createGunzip())
          : encoding === 'br' ? res.pipe(zlib.createBrotliDecompress())
          : encoding === 'deflate' ? res.pipe(zlib.createInflate())
          : res;
        const chunks: Buffer[] = [];
        let size = 0;
        const done = () => resolve({ status, location: null, body: Buffer.concat(chunks).toString('utf8') });
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length;
          chunks.push(chunk);
          // The head of a page holds the details Grind reads, so a huge page is cut, not refused.
          if (size >= MAX_BYTES) {
            done();
            req.destroy();
          }
        });
        stream.on('end', done);
        stream.on('error', reject);
      },
    );
    req.on('error', reject);
  });
}

/** Fetches a public web page and follows redirects, checking every hop. Returns the final address and HTML. */
export async function fetchPage(start: URL): Promise<{ url: URL; html: string }> {
  let url = start;
  let retried = false;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let reply: Reply;
    try {
      reply = await request(url);
    } catch (error) {
      const code = (error as { code?: string; name?: string }).code ?? (error as Error).name;
      if (code === 'EBLOCKED') throw new ScanError('Paste the address of a public web page.');
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') throw new ScanError(`Grind could not find ${url.hostname}. Check the link for typos.`);
      if (code === 'AbortError' || code === 'TimeoutError') throw new ScanError('That page took too long to answer. Try again, or fill the form in yourself.');
      // A dropped connection is often a one-off, so try the same address once more.
      if (!retried) {
        retried = true;
        hop--;
        continue;
      }
      throw new ScanError('Grind could not open that page. Check the link, or fill the form in yourself.');
    }
    if (reply.location) {
      url = publicUrl(new URL(reply.location, url).toString());
      continue;
    }
    if (reply.status === 415) throw new ScanError('That link is not a web page. Paste the hackathon page itself.');
    if (reply.status === 401 || reply.status === 403) throw new ScanError('That site does not let Grind read the page. Fill the form in yourself.');
    if (reply.status === 404 || reply.status === 410) throw new ScanError('That page does not exist. Check the link.');
    if (reply.status >= 400) throw new ScanError('That site did not answer properly. Try again later, or fill the form in yourself.');
    return { url, html: reply.body };
  }
  throw new ScanError('That link redirects too many times.');
}
