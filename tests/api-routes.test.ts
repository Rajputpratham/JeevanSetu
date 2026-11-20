// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as postAssistant } from '@/app/api/assistant/route';
import { GET as getReviews, POST as postReview } from '@/app/api/reviews/route';
import { GET as getTravel } from '@/app/api/travel/route';
import { GET as getGeocode } from '@/app/api/geocode/route';
import { GET as getGoogleRatings } from '@/app/api/google-ratings/route';
import { clearGoogleRatingsCache } from '@/lib/google-ratings-cache';
import { clearTravelCache } from '@/lib/travel-cache';
import { RATE_LIMITS, resetRateLimits } from '@/lib/rate-limit';
import { HOSPITALS } from '@/data/hospitals';

/**
 * API ROUTE HANDLER CONTRACT TESTS.
 *
 * These drive the real exported handlers (no HTTP server, no network) and pin
 * the behaviour the UI and the honesty policy depend on:
 *
 *   • input validation → 400 / 404 / 422 with a machine-readable `code`,
 *   • per-caller rate limiting → 429 + `Retry-After`,
 *   • degraded but honest responses when API keys are absent,
 *   • clean failure when an upstream API returns a non-2xx response,
 *   • no duplicate billed Google Places call on a repeated page load.
 *
 * Every upstream fetch is stubbed, so the suite is deterministic offline.
 */

const IP_A = '203.0.113.10';
const IP_B = '203.0.113.20';

function getRequest(path: string, ip = IP_A): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { 'x-forwarded-for': ip },
  });
}

function postRequest(path: string, body: unknown, ip = IP_A): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Minimal stand-in for a `fetch` response — routes only use ok/status/json. */
function jsonResponse(payload: unknown, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

beforeEach(() => {
  resetRateLimits();
  clearGoogleRatingsCache();
  clearTravelCache();
  // No credentials in tests: every endpoint must work (or degrade honestly).
  for (const key of [
    'GOOGLE_MAPS_API_KEY',
    'GOOGLE_PLACES_API_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_GEMINI_API_KEY',
    'GOOGLE_AI_API_KEY',
    'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
    'NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY',
  ]) {
    vi.stubEnv(key, '');
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/assistant
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/assistant', () => {
  it('rejects a malformed JSON body with 400 BAD_BODY', async () => {
    const res = await postAssistant(postRequest('/api/assistant', '{not json'));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('BAD_BODY');
  });

  it('rejects an empty and an oversized message', async () => {
    const empty = await postAssistant(postRequest('/api/assistant', { message: '   ', lang: 'en' }));
    expect(empty.status).toBe(400);
    expect((await empty.json()).code).toBe('EMPTY_MESSAGE');

    const huge = await postAssistant(
      postRequest('/api/assistant', { message: 'x'.repeat(1001), lang: 'en' }),
    );
    expect(huge.status).toBe(400);
    expect((await huge.json()).code).toBe('MESSAGE_TOO_LONG');
  });

  it('degrades to the deterministic engine (never an error page) when GEMINI_API_KEY is absent', async () => {
    const res = await postAssistant(
      postRequest('/api/assistant', { message: 'Hello there', lang: 'en', istHour: 10 }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.groundingMode).toBe('deterministic-grounded');
    expect(data.reply.length).toBeGreaterThan(0);
    expect(data.hospitals).toHaveLength(0);
    // The absence of Gemini is disclosed, not hidden.
    expect(data.blockers.join(' ')).toMatch(/GEMINI/);
  });

  it('rate limits a single IP with 429 and Retry-After, while other callers keep working', async () => {
    const { max } = RATE_LIMITS.assistant;
    for (let i = 0; i < max; i++) {
      const res = await postAssistant(
        postRequest('/api/assistant', { message: 'Hello', lang: 'en', istHour: 10 }, IP_A),
      );
      expect(res.status).toBe(200);
    }

    const blocked = await postAssistant(
      postRequest('/api/assistant', { message: 'Hello', lang: 'en', istHour: 10 }, IP_A),
    );
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    const body = await blocked.json();
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.limit).toBe(max);

    // Independent buckets per caller: a different IP is unaffected.
    const other = await postAssistant(
      postRequest('/api/assistant', { message: 'Hello', lang: 'en', istHour: 10 }, IP_B),
    );
    expect(other.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/reviews
// ─────────────────────────────────────────────────────────────────────────────
describe('/api/reviews', () => {
  const validReview = {
    hospitalId: 'aiims-new-delhi',
    authorAlias: 'Attendant from Gurugram',
    visitType: 'OPD',
    visitMonth: '2026-10',
    overall: 5,
    doctorCare: 5,
    cleanliness: 4,
    waitTime: 3,
    billingTransparency: 4,
    comment: 'OPD registration was quick and the pharmacy counter was clearly signposted.',
  };

  it('serves a community-score summary and 404s an unknown hospital', async () => {
    const summary = await getReviews(getRequest('/api/reviews'));
    expect(summary.status).toBe(200);
    expect(typeof (await summary.json()).totalReviews).toBe('number');

    const unknown = await getReviews(getRequest('/api/reviews?hospitalId=not-a-hospital'));
    expect(unknown.status).toBe(404);

    const known = await getReviews(getRequest('/api/reviews?hospitalId=aiims-new-delhi'));
    expect(known.status).toBe(200);
    const data = await known.json();
    expect(data.hospitalId).toBe('aiims-new-delhi');
    expect(data.summary.formulaNote.length).toBeGreaterThan(10);
    expect(data.disclosure).toMatch(/Bayesian/);
  });

  it('400s a malformed payload, an unknown hospital and out-of-range ratings', async () => {
    const malformed = await postReview(postRequest('/api/reviews', 'not-json'));
    expect(malformed.status).toBe(400);

    const unknown = await postReview(
      postRequest('/api/reviews', { ...validReview, hospitalId: 'not-a-hospital' }, IP_B),
    );
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).error).toMatch(/Unknown hospital/);

    const badRating = await postReview(
      postRequest('/api/reviews', { ...validReview, overall: 7 }, '203.0.113.31'),
    );
    expect(badRating.status).toBe(400);
    expect((await badRating.json()).error).toMatch(/1 to 5/);
  });

  it('422s content blocked by moderation instead of storing it', async () => {
    const res = await postReview(
      postRequest(
        '/api/reviews',
        { ...validReview, comment: 'Best visit https://spam-clinic.example.com' },
        '203.0.113.32',
      ),
    );
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.moderationStatus).toBe('rejected');
    expect(data.error).toMatch(/moderation|URL/i);
  });

  it('201s a moderated review, returns the updated score, and redacts phone numbers', async () => {
    const res = await postReview(
      postRequest(
        '/api/reviews',
        { ...validReview, comment: `${validReview.comment} Attendant number 9876543210.` },
        '203.0.113.33',
      ),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.review.verificationStatus).toBe('community-unverified');
    expect(data.review.moderationStatus).toBe('approved');
    expect(data.review.comment).toContain('[phone redacted]');
    expect(data.review.comment).not.toContain('9876543210');
    expect(data.summary.eligibleCount).toBeGreaterThan(0);

    // The stored review is visible on the next GET for that hospital.
    const list = await (await getReviews(getRequest('/api/reviews?hospitalId=aiims-new-delhi'))).json();
    expect(list.reviews.some((r: { id: string }) => r.id === data.review.id)).toBe(true);
  });

  it('rate limits review submissions at 4/min with 429', async () => {
    const { max } = RATE_LIMITS.reviews;
    for (let i = 0; i < max; i++) {
      const res = await postReview(postRequest('/api/reviews', {}, '203.0.113.40'));
      expect(res.status).toBe(400); // invalid payload, but counted
    }
    const blocked = await postReview(postRequest('/api/reviews', {}, '203.0.113.40'));
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/travel
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/travel', () => {
  it('400s a missing and an out-of-range origin', async () => {
    const missing = await getTravel(getRequest('/api/travel?lang=en'));
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe('ORIGIN_REQUIRED');

    const outOfRange = await getTravel(getRequest('/api/travel?lat=999&lng=77.1'));
    expect(outOfRange.status).toBe(400);
    expect((await outOfRange.json()).code).toBe('BAD_ORIGIN');
  });

  it('404s when none of the requested hospital ids exist', async () => {
    const res = await getTravel(getRequest('/api/travel?lat=28.64&lng=77.18&ids=ghost-hospital'));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('UNKNOWN_IDS');
  });

  it('reports unavailable distances (never a guessed number) without a Maps key', async () => {
    const res = await getTravel(
      getRequest('/api/travel?lat=28.6426&lng=77.1842&source=manual&ids=bsa-hospital,aiims-new-delhi&lang=hi'),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.apiStatus.serverKeyConfigured).toBe(false);
    expect(data.hospitals).toHaveLength(2);
    for (const h of data.hospitals) {
      expect(h.distanceKm).toBeNull();
      expect(h.etaMinutes).toBeNull();
      expect(h.source).toBe('unavailable');
      expect(h.error).toMatch(/GOOGLE_MAPS_API_KEY/);
      // Validated coordinates are still returned so the UI can place a marker.
      expect(typeof h.lat).toBe('number');
    }
  });

  it('rate limits distance lookups with 429', async () => {
    const { max } = RATE_LIMITS.travel;
    for (let i = 0; i < max; i++) {
      const res = await getTravel(
        getRequest('/api/travel?lat=28.6426&lng=77.1842&ids=bsa-hospital', '203.0.113.50'),
      );
      expect(res.status).toBe(200);
    }
    const blocked = await getTravel(
      getRequest('/api/travel?lat=28.6426&lng=77.1842&ids=bsa-hospital', '203.0.113.50'),
    );
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).code).toBe('RATE_LIMITED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/geocode
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/geocode', () => {
  it('400s a query shorter than 2 characters', async () => {
    const res = await getGeocode(getRequest('/api/geocode?q=a'));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.results).toEqual([]);
  });

  it('falls back to the offline gazetteer when Google is absent and Nominatim is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));

    const res = await getGeocode(getRequest('/api/geocode?q=Pusa%20Road&lang=en'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe('indian-gazetteer');
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0].label).toContain('Pusa');
  });

  it('returns Google results when the Geocoding API answers OK', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-maps-key');
    const fetchMock = vi.fn(async (url: string) => {
      // The route must ask Google for the requested locale.
      expect(url).toContain('language=hi');
      return jsonResponse({
        status: 'OK',
        results: [
          {
            formatted_address: 'Pusa Road, New Delhi, Delhi, India',
            place_id: 'place-1',
            geometry: { location: { lat: 28.6426, lng: 77.1842 }, location_type: 'ROOFTOP' },
            types: ['route'],
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await getGeocode(getRequest('/api/geocode?q=28.6426,77.1842&lang=hi'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe('google');
    expect(data.results[0]).toMatchObject({
      lat: 28.6426,
      lng: 77.1842,
      source: 'google',
      placeId: 'place-1',
      approximate: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back when Google answers with a non-2xx response instead of throwing', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-maps-key');
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'boom' }, false, 503));
    vi.stubGlobal('fetch', fetchMock);

    const res = await getGeocode(getRequest('/api/geocode?q=Pusa%20Road&lang=en'));
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe('indian-gazetteer');
    // Google + Nominatim were both attempted, both failed, nothing was invented.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rate limits address lookups with 429', async () => {
    const { max } = RATE_LIMITS.geocode;
    for (let i = 0; i < max; i++) {
      const res = await getGeocode(getRequest('/api/geocode?q=a', '203.0.113.60'));
      expect(res.status).toBe(400);
    }
    const blocked = await getGeocode(getRequest('/api/geocode?q=a', '203.0.113.60'));
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).code).toBe('RATE_LIMITED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/google-ratings
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/google-ratings', () => {
  const FIND_OK = {
    status: 'OK',
    candidates: [{ place_id: 'place-xyz' }],
  };
  const DETAILS_OK = {
    status: 'OK',
    result: {
      rating: 4.4,
      user_ratings_total: 210,
      url: 'https://maps.google.com/?cid=123',
      reviews: [
        { author_name: 'Asha', rating: 5, relative_time_description: '2 weeks ago', text: 'Kind staff' },
        { author_name: 'Ravi', rating: 4, relative_time_description: 'a month ago', text: 'Long queue' },
      ],
    },
  };

  it('404s an unknown hospital', async () => {
    const res = await getGoogleRatings(getRequest('/api/google-ratings?hospitalId=not-a-hospital'));
    expect(res.status).toBe(404);
  });

  it('reports awaiting-api-key (never a fabricated rating) without a Places key', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await getGoogleRatings(
      getRequest('/api/google-ratings?hospitalId=aiims-new-delhi'),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('awaiting-api-key');
    expect(data.rating).toBeNull();
    expect(data.userRatingsTotal).toBeNull();
    expect(data.googleMapsUrl).toContain('google.com/maps/search');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('connects to Google Places and maps rating, total and review excerpts', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-places-key');
    const fetchMock = vi.fn(async (url: string) =>
      jsonResponse(url.includes('findplacefromtext') ? FIND_OK : DETAILS_OK),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await getGoogleRatings(
      getRequest('/api/google-ratings?hospitalId=aiims-new-delhi'),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('connected');
    expect(data.rating).toBe(4.4);
    expect(data.userRatingsTotal).toBe(210);
    expect(data.googleMapsUrl).toBe('https://maps.google.com/?cid=123');
    expect(data.reviews).toHaveLength(2);
    expect(data.reviews[0]).toMatchObject({ authorName: 'Asha', rating: 5 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serves a repeat request from the TTL cache instead of calling Google again', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-places-key');
    const fetchMock = vi.fn(async (url: string) =>
      jsonResponse(url.includes('findplacefromtext') ? FIND_OK : DETAILS_OK),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await getGoogleRatings(
      getRequest('/api/google-ratings?hospitalId=safdarjung-hospital'),
    );
    expect(first.headers.get('X-Cache')).toBe('MISS');
    const second = await getGoogleRatings(
      getRequest('/api/google-ratings?hospitalId=safdarjung-hospital'),
    );
    expect(second.headers.get('X-Cache')).toBe('HIT');
    expect(fetchMock).toHaveBeenCalledTimes(2); // one Find Place + one Details, total

    const body = await second.json();
    expect(body.status).toBe('connected');
    expect(body.rating).toBe(4.4);
  });

  it('reports api-error without parsing a non-2xx Find Place response', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-places-key');
    const jsonSpy = vi.fn(async () => {
      throw new Error('json() must not be called on an error response');
    });
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, json: jsonSpy }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await getGoogleRatings(
      getRequest('/api/google-ratings?hospitalId=rml-hospital'),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('api-error');
    expect(data.rating).toBeNull();
    expect(data.googleMapsUrl).toContain('google.com/maps/search');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('reports api-error when Place Details answers non-2xx, and does not cache the failure', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-places-key');
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('findplacefromtext')
        ? jsonResponse(FIND_OK)
        : jsonResponse({ error: 'backend down' }, false, 502),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await getGoogleRatings(
      getRequest('/api/google-ratings?hospitalId=gtb-hospital'),
    );
    expect((await first.json()).status).toBe('api-error');

    // A transient failure must retry Google on the next load (no stale error cache).
    const second = await getGoogleRatings(
      getRequest('/api/google-ratings?hospitalId=gtb-hospital'),
    );
    expect(second.headers.get('X-Cache')).not.toBe('HIT');
    expect(fetchMock).toHaveBeenCalledTimes(4); // 2 attempts × (find + details)
  });

  it('reports api-error when Google returns 200 with a rejected status', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-places-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ status: 'REQUEST_DENIED', error_message: 'bad key' })),
    );

    const res = await getGoogleRatings(
      getRequest('/api/google-ratings?hospitalId=bsa-hospital'),
    );
    expect((await res.json()).status).toBe('api-error');
  });

  it('reports not-found (and caches it) when Google has no place candidate', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-places-key');
    const fetchMock = vi.fn(async () => jsonResponse({ status: 'ZERO_RESULTS', candidates: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await getGoogleRatings(
      getRequest('/api/google-ratings?hospitalId=bjrm-hospital'),
    );
    const data = await first.json();
    expect(data.status).toBe('not-found');
    expect(data.rating).toBeNull();

    await getGoogleRatings(getRequest('/api/google-ratings?hospitalId=bjrm-hospital'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rate limits rating lookups with 429', async () => {
    const { max } = RATE_LIMITS.googleRatings;
    for (let i = 0; i < max; i++) {
      const res = await getGoogleRatings(
        getRequest('/api/google-ratings?hospitalId=aiims-new-delhi', '203.0.113.70'),
      );
      expect(res.status).toBe(200);
    }
    const blocked = await getGoogleRatings(
      getRequest('/api/google-ratings?hospitalId=aiims-new-delhi', '203.0.113.70'),
    );
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).code).toBe('RATE_LIMITED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate-limit primitive
// ─────────────────────────────────────────────────────────────────────────────
describe('rate-limit primitive', () => {
  it('uses a sliding window and separates buckets', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    resetRateLimits();
    const policy = { windowMs: 60_000, max: 2 };
    const t0 = 1_000_000;

    expect(checkRateLimit('assistant', 'ip-1', policy, t0).allowed).toBe(true);
    expect(checkRateLimit('assistant', 'ip-1', policy, t0 + 1).allowed).toBe(true);
    const blocked = checkRateLimit('assistant', 'ip-1', policy, t0 + 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // Another bucket for the same caller is untouched.
    expect(checkRateLimit('travel', 'ip-1', policy, t0 + 2).allowed).toBe(true);
    // The window frees up once the oldest request ages out.
    expect(checkRateLimit('assistant', 'ip-1', policy, t0 + 60_001).allowed).toBe(true);
  });

  it('assigns stable anonymous keys when proxy headers are missing', async () => {
    const { getClientKey } = await import('@/lib/rate-limit');
    expect(getClientKey(new Headers())).toBe('anonymous-client');
    expect(getClientKey(new Headers({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
    expect(
      getClientKey(new Headers({ 'x-forwarded-for': '198.51.100.5, 10.0.0.1' })),
    ).toBe('198.51.100.5');
  });

  it('defines a limit for every public proxy endpoint', () => {
    for (const bucket of ['assistant', 'reviews', 'travel', 'geocode', 'googleRatings'] as const) {
      expect(RATE_LIMITS[bucket].max).toBeGreaterThan(0);
      expect(RATE_LIMITS[bucket].windowMs).toBeGreaterThan(0);
    }
    // Sanity: the dataset the travel route returns ids from exists.
    expect(HOSPITALS.length).toBeGreaterThan(0);
  });
});
