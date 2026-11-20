/**
 * Shared, IP-based sliding-window rate limiting for public API routes.
 *
 * Every route that can spend money on a third-party API (Gemini, Google Places,
 * Google Geocoding, Google Routes, OpenStreetMap Nominatim) or that accepts
 * user-generated content (community reviews) must be limited per caller. The
 * original implementation lived in `lib/moderation.ts` for reviews only; this
 * module generalises it so each endpoint gets its own independent bucket and a
 * consistent `429` JSON contract.
 *
 * Design notes:
 *  • Keys are the caller IP plus a bucket name, so exhausting the reviews limit
 *    never blocks the travel API.
 *  • The window is sliding (requests are timestamped), not a fixed bucket, so a
 *    caller cannot burst 2× the limit across a window boundary.
 *  • No IP is persisted, logged or sent anywhere — state is in-process memory and
 *    the platform's normal memory limits bound it. `resetRateLimits()` exists for
 *    tests and must never be called from production code.
 */

import { NextResponse } from 'next/server';

export interface RateLimitPolicy {
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /** Maximum accepted requests per caller inside the window. */
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the caller may retry (0 when allowed). */
  retryAfterSeconds: number;
}

/**
 * Per-endpoint policies. Expensive or generative endpoints get tight limits;
 * read-only lookups that a page may fire a handful of times get generous ones.
 */
export const RATE_LIMITS = {
  /** User-generated content: 4 review submissions per minute. */
  reviews: { windowMs: 60_000, max: 4 },
  /** Gemini-backed assistant turns: 20 per minute. */
  assistant: { windowMs: 60_000, max: 20 },
  /** Address search fires while typing (debounced): 60 per minute. */
  geocode: { windowMs: 60_000, max: 60 },
  /** Travel snapshots are refetched on origin/selection changes: 60 per minute. */
  travel: { windowMs: 60_000, max: 60 },
  /** Google Places lookups (billed per call): 30 per minute. */
  googleRatings: { windowMs: 60_000, max: 30 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

const hits = new Map<string, number[]>();

/** Hard cap so a flood of distinct IPs cannot grow the map without bound. */
const MAX_TRACKED_KEYS = 5_000;

function pruneExpired(now: number, windowMs: number): void {
  for (const [key, stamps] of hits) {
    const live = stamps.filter((ts) => now - ts < windowMs);
    if (live.length === 0) hits.delete(key);
    else hits.set(key, live);
  }
}

/**
 * Records one request for `clientKey` inside `bucket` and reports whether it is
 * allowed. Call this once per incoming request.
 */
export function checkRateLimit(
  bucket: RateLimitBucket | string,
  clientKey: string,
  policy: RateLimitPolicy,
  now = Date.now(),
): RateLimitResult {
  const storeKey = `${bucket}|${clientKey || 'anonymous-client'}`;

  if (hits.size >= MAX_TRACKED_KEYS) pruneExpired(now, Math.max(policy.windowMs, 60_000));

  const history = (hits.get(storeKey) ?? []).filter((ts) => now - ts < policy.windowMs);

  if (history.length >= policy.max) {
    // The window frees up when its oldest request ages out.
    const oldest = history[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((policy.windowMs - (now - oldest)) / 1000));
    hits.set(storeKey, history);
    return { allowed: false, limit: policy.max, remaining: 0, retryAfterSeconds };
  }

  history.push(now);
  hits.set(storeKey, history);
  return {
    allowed: true,
    limit: policy.max,
    remaining: Math.max(0, policy.max - history.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Stable caller identity for rate limiting. Uses the proxy-provided forwarding
 * headers; without them every anonymous caller shares one bucket (the same
 * behaviour the reviews endpoint has always had).
 */
export function getClientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = headers.get('x-real-ip')?.trim();
  return forwarded || realIp || 'anonymous-client';
}

/**
 * Enforces a bucket for an incoming request.
 *
 * Returns a ready-to-send `429` response when the caller is over budget, or
 * `null` when the request may proceed:
 *
 * ```ts
 * const limited = enforceRateLimit(request, 'assistant', 'Slow down…');
 * if (limited) return limited;
 * ```
 */
export function enforceRateLimit(
  request: { headers: Headers },
  bucket: RateLimitBucket,
  message?: string,
): NextResponse | null {
  const policy = RATE_LIMITS[bucket];
  const result = checkRateLimit(bucket, getClientKey(request.headers), policy);
  if (result.allowed) return null;

  return NextResponse.json(
    {
      error:
        message ??
        'Too many requests from this device. Please wait a moment before trying again.',
      code: 'RATE_LIMITED',
      limit: result.limit,
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}

/** Test helper only — clears every bucket. */
export function resetRateLimits(): void {
  hits.clear();
}
