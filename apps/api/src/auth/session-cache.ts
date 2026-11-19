/**
 * Token versions read by AuthGuard, kept for a short time so most requests skip a database
 * round trip. This process updates or drops an entry when it changes a version, so a password
 * change, "sign out other devices" or account deletion applies at once here. Another API
 * instance would see the change within TTL_MS.
 */
const TTL_MS = 60_000;
const MAX_ENTRIES = 10_000;
const versions = new Map<string, { tv: number; at: number }>();

export function cachedTokenVersion(userId: string): number | undefined {
  const hit = versions.get(userId);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) {
    versions.delete(userId);
    return undefined;
  }
  return hit.tv;
}

export function rememberTokenVersion(userId: string, tv: number) {
  if (versions.size >= MAX_ENTRIES) versions.clear();
  versions.set(userId, { tv, at: Date.now() });
}

export function forgetTokenVersion(userId: string) {
  versions.delete(userId);
}
