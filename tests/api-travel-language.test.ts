// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { TravelSnapshot } from '@/lib/travel';

/**
 * LOOP E — locale propagation to Google Routes.
 *
 * Regression guard for a dead ternary in `app/api/travel/route.ts`:
 *   language: lang === 'en' ? 'en-IN' : 'en-IN'
 * which silently sent `en-IN` for every language, so road names, toll labels and
 * traffic phrases came back in English even in the Hindi/Tamil UI.
 *
 * The snapshot is mocked so the assertion is about the request we build, not
 * about Google being reachable.
 */

const { getTravelSnapshotMock, calls } = vi.hoisted(() => {
  const calls: { language?: string; origin: { lat: number; lng: number } }[] = [];
  const snapshot = {
    origin: { lat: 28.6426, lng: 77.1842 },
    originSource: 'manual',
    originLabel: 'Pusa Road',
    originAccuracyM: null,
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
    source: 'unavailable',
    googleConnected: false,
    routesApiEnabled: false,
    requestId: 'test-request',
    computedAt: '2026-01-01T00:00:00.000Z',
    legs: {},
    disclosure: { text: 'test disclosure', live: false },
    blockers: [],
  };
  const getTravelSnapshotMock = vi.fn(
    async (params: { language?: string; origin: { lat: number; lng: number } }) => {
      calls.push({ language: params.language, origin: params.origin });
      return snapshot;
    },
  );
  return { getTravelSnapshotMock, calls };
});

vi.mock('@/lib/travel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/travel')>();
  return {
    ...actual,
    getTravelSnapshot: getTravelSnapshotMock,
    hasServerMapsKey: () => false,
  };
});

const { GET: getTravel } = await import('@/app/api/travel/route');
const { clearTravelCache } = await import('@/lib/travel-cache');
const { resetRateLimits } = await import('@/lib/rate-limit');

function request(lang: string | null, ip = '203.0.113.90'): NextRequest {
  const suffix = lang === null ? '' : `&lang=${encodeURIComponent(lang)}`;
  return new NextRequest(
    `http://localhost:3000/api/travel?lat=28.6426&lng=77.1842&source=manual${suffix}`,
    { headers: { 'x-forwarded-for': ip } },
  );
}

beforeEach(() => {
  calls.length = 0;
  getTravelSnapshotMock.mockClear();
  resetRateLimits();
  clearTravelCache();
});

describe('travel route language propagation', () => {
  it('maps every supported language to its Indian BCP-47 locale', async () => {
    const expected: [string, string][] = [
      ['en', 'en-IN'],
      ['hi', 'hi-IN'],
      ['bn', 'bn-IN'],
      ['te', 'te-IN'],
      ['mr', 'mr-IN'],
      ['ta', 'ta-IN'],
      ['gu', 'gu-IN'],
      ['ur', 'ur-IN'],
      ['kn', 'kn-IN'],
      ['or', 'or-IN'],
      ['ml', 'ml-IN'],
    ];

    for (const [lang, locale] of expected) {
      clearTravelCache();
      const res = await getTravel(request(lang));
      expect(res.status).toBe(200);
      expect(getTravelSnapshotMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ language: locale }),
      );
    }
  });

  it('keeps language out of the numeric data and defaults to en-IN for unknown codes', async () => {
    const res = await getTravel(request('xx'));
    expect(res.status).toBe(200);
    expect(getTravelSnapshotMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ language: 'en-IN' }),
    );

    // No explicit lang → English locale, and no language-driven numbers.
    clearTravelCache();
    const noLang = await getTravel(request(null));
    expect(noLang.status).toBe(200);
    const body = (await noLang.json()) as TravelSnapshot & { hospitals: { distanceKm: number | null }[] };
    expect(body.hospitals.every((h) => h.distanceKm === null)).toBe(true);
  });

  it('caches per language, so switching locale does not reuse the wrong answer', async () => {
    await getTravel(request('en'));
    await getTravel(request('hi'));
    expect(getTravelSnapshotMock).toHaveBeenCalledTimes(2);

    // Same language + same origin + same hospitals is a cache hit.
    await getTravel(request('hi'));
    expect(getTravelSnapshotMock).toHaveBeenCalledTimes(2);
  });
});
