/**
 * Short-lived server cache for Google Routes results.
 *
 * Google bills per request, so we dedupe identical origin→destination queries
 * for a short window while keeping traffic data fresh (60 s) and we collapse
 * concurrent identical requests into one in-flight promise.
 *
 * Nothing here is persisted and nothing is user-identifiable: keys are rounded
 * coordinates + travel mode only.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

const MAX_ENTRIES = 400;

export function travelCacheKey(parts: (string | number | null | undefined)[]): string {
  return parts
    .map((p) => (typeof p === 'number' ? p.toFixed(4) : String(p ?? '')))
    .join('|');
}

export function readCache<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function writeCache<T>(key: string, value: T, ttlMs: number): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Runs `fn` once per key for concurrent callers, then caches the result. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = readCache<T>(key);
  if (hit !== null) return hit;

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn()
    .then((value) => {
      writeCache(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

export function cacheStats(): { entries: number; inFlight: number } {
  return { entries: store.size, inFlight: inFlight.size };
}

/** Test helper. */
export function clearTravelCache(): void {
  store.clear();
  inFlight.clear();
}
