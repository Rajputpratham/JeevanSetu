/**
 * Short-lived server cache for Google Routes results.
 *
 * Google bills per request, so we dedupe identical origin→destination queries
 * for a short window while keeping traffic data fresh (60 s) and we collapse
 * concurrent identical requests into one in-flight promise.
 *
 * Nothing here is persisted and nothing is user-identifiable: keys are rounded
 * coordinates + travel mode only.
 *
 * The implementation is the shared TTL cache in `lib/server-cache.ts`; this
 * module owns the Routes-specific key format and the app-wide travel store.
 */

import { createTtlCache } from './server-cache';

const cache = createTtlCache({ maxEntries: 400 });

export function travelCacheKey(parts: (string | number | null | undefined)[]): string {
  return parts
    .map((p) => (typeof p === 'number' ? p.toFixed(4) : String(p ?? '')))
    .join('|');
}

export function readCache<T>(key: string): T | null {
  return cache.read<T>(key);
}

export function writeCache<T>(key: string, value: T, ttlMs: number): void {
  cache.write(key, value, ttlMs);
}

/** Runs `fn` once per key for concurrent callers, then caches the result. */
export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  return cache.cached(key, ttlMs, fn);
}

export function cacheStats(): { entries: number; inFlight: number } {
  return cache.stats();
}

/** Test helper. */
export function clearTravelCache(): void {
  cache.clear();
}
