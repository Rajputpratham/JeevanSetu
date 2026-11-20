/**
 * Server-side TTL cache for Google Places rating lookups.
 *
 * Google Places is billed per request and a hospital's public rating barely
 * moves minute-to-minute, so `/api/google-ratings` keeps successful answers for
 * 10 minutes per `hospitalId`. That makes the "hospital detail → back → hospital
 * detail" path free instead of re-billing Find Place + Place Details every time.
 *
 * Failures are never written here (the route only caches resolved lookups), so a
 * transient Google outage retries on the next page load. The store is the shared
 * implementation in `lib/server-cache.ts` and is separate from the travel cache.
 */

import { createTtlCache } from './server-cache';

/** How long a resolved (connected / not-found) Google rating stays cached. */
export const GOOGLE_RATINGS_TTL_MS = 10 * 60_000;

const cache = createTtlCache({ maxEntries: 200 });

export function googleRatingCacheKey(hospitalId: string): string {
  return `google-rating|${hospitalId}`;
}

export function readCachedRating<T>(hospitalId: string): T | null {
  return cache.read<T>(googleRatingCacheKey(hospitalId));
}

/** Runs `fn` once per hospital for concurrent callers, then caches the result. */
export function cachedRating<T>(hospitalId: string, fn: () => Promise<T>): Promise<T> {
  return cache.cached(googleRatingCacheKey(hospitalId), GOOGLE_RATINGS_TTL_MS, fn);
}

export function googleRatingsCacheStats(): { entries: number; inFlight: number } {
  return cache.stats();
}

/** Test helper — drops every cached rating. */
export function clearGoogleRatingsCache(): void {
  cache.clear();
}
