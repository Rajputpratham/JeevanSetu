import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { searchIndianLocalities } from '@/data/localities';
import {
  haversineKm,
  formatDrivingKm,
  formatStraightLineKm,
  formatDuration,
  directionsUrl,
  directionsFromToUrl,
} from '@/lib/geo';
import { isInsideBounds } from '@/data/hospital-locations';

/**
 * Loop A — geocoding & distance formatting primitives.
 *
 * Everything that used to live here as a *model* (tortuosity factors, "urban
 * speed" assumptions, synthetic corridors) has been deleted from the product:
 * a driving distance now comes only from a real routing provider (Google Routes
 * when a key is configured, otherwise key-free OSRM), never from a local
 * estimate. What remains to test is the gazetteer and the display formatters.
 */

describe('Loop A — offline gazetteer geocoding', () => {
  it('geocodes Pusa Road, New Delhi accurately', () => {
    const matches = searchIndianLocalities('Pusa Road, New Delhi');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].id).toBe('pusa-road-delhi');
    expect(matches[0].lat).toBeCloseTo(28.6426, 2);
    expect(matches[0].lng).toBeCloseTo(77.1842, 2);
  });

  it('supports pincode and multilingual locality queries', () => {
    expect(searchIndianLocalities('110029')[0]?.id).toBe('ansari-nagar-delhi');
    expect(searchIndianLocalities('சென்னை')[0]?.city).toBe('Chennai');
    expect(searchIndianLocalities('কলকাতা')[0]?.city).toBe('Kolkata');
    expect(searchIndianLocalities('मुंबई')[0]?.city).toBe('Mumbai');
  });

  it('returns nothing rather than guessing for unknown input', () => {
    expect(searchIndianLocalities('zzzzqqq')).toHaveLength(0);
  });

  it('every gazetteer entry is inside India', () => {
    for (const locality of searchIndianLocalities('a')) {
      expect(isInsideBounds(locality.lat, locality.lng, locality.city)).toBe(true);
    }
  });
});

describe('Loop A — display formatters (the only place km are produced)', () => {
  it('formats driving km to one decimal', () => {
    expect(formatDrivingKm(16.84)).toBe('16.8 km');
    expect(formatDrivingKm(4.3)).toBe('4.3 km');
  });

  it('formats sub-kilometre distances in metres', () => {
    expect(formatDrivingKm(0.72)).toBe('720 m');
    expect(formatStraightLineKm(0.41)).toBe('410 m (straight line)');
  });

  it('never fabricates a value for unknown distances', () => {
    expect(formatDrivingKm(null)).toBeNull();
    expect(formatStraightLineKm(null)).toBeNull();
    expect(formatDrivingKm(Number.NaN)).toBeNull();
    expect(formatDrivingKm(Infinity)).toBeNull();
  });

  it('formats durations from minutes', () => {
    expect(formatDuration(51)).toBe('51 min');
    expect(formatDuration(75)).toMatch(/1 h|1 hr|1h/);
  });

  it('keeps straight-line and driving distance in separate formatters', () => {
    expect(formatStraightLineKm(16.84)).toBe('16.8 km (straight line)');
    expect(formatStraightLineKm(16.84)).not.toBe(formatDrivingKm(16.84));
  });

  it('computes haversine only for straight-line geometry', () => {
    const pusa = { lat: 28.6426, lng: 77.1842 };
    const bsa = { lat: 28.7151, lng: 77.1149 };
    const straight = haversineKm(pusa.lat, pusa.lng, bsa.lat, bsa.lng);
    // Sanity band only — this value is never displayed as a road distance.
    expect(straight).toBeGreaterThan(7);
    expect(straight).toBeLessThan(12);
  });
});

describe('Loop A — Google Maps links', () => {
  it('builds an origin→destination navigation URL', () => {
    const url = directionsFromToUrl(28.6426, 77.1842, 28.7151, 77.1149, 'BSA Hospital');
    expect(url).toContain('origin=28.6426,77.1842');
    expect(decodeURIComponent(url)).toContain('destination=28.7151,77.1149 (BSA Hospital)');
    expect(url).toContain('travelmode=driving');
  });

  it('omits the origin when no starting point is known (never defaults to Delhi)', () => {
    const url = directionsUrl(28.7151, 77.1149, 'BSA Hospital', null);
    expect(url).not.toContain('origin=');
    expect(url).toContain('/maps/search/');
    expect(decodeURIComponent(url)).toContain('28.7151,77.1149 (BSA Hospital)');
  });
});

describe('Legacy modelling code is gone, not merely unused', () => {
  beforeAll(() => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', '');
    vi.stubEnv('OSRM_BASE_URL', '');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    // Offline simulation: no routing provider may be reached from this suite.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lib/geo no longer exports an estimated-urban-model distance function', async () => {
    const geo = await import('@/lib/geo');
    expect('estimateRoadDistanceKm' in geo).toBe(false);
    expect('estimateTravelMetrics' in geo).toBe(false);
  });

  it('lib/routing no longer synthesizes corridors for the app', async () => {
    const routing = await import('@/lib/routing');
    expect(routing).toBeDefined();
    expect('buildSyntheticRoute' in routing).toBe(false);
  });

  it('never falls back to a synthesised distance when every provider fails', async () => {
    // Hermetic: this test must not depend on whether the machine running it can
    // reach the public OSRM demo host. A real provider outage is simulated by
    // making every outbound request fail.
    const apiRoute = await import('@/app/api/route/route');
    const res = await apiRoute.GET(
      new (await import('next/server')).NextRequest(
        'http://localhost:3000/api/route?fromLat=28.6426&fromLng=77.1842&hospitalId=bsa-hospital',
      ),
    );
    const data = await res.json();
    // No provider reachable: honest "unavailable", NO distance, NO geometry.
    expect(data.source).toBe('unavailable');
    expect(data.distanceKm).toBeNull();
    expect(data.minutes).toBeNull();
    expect(data.etaMinutes).toBeNull();
    expect(data.liveTraffic).toBe(false);
    expect(data.geometry ?? []).toHaveLength(0);
    expect(data.navigateUrl).toContain('google.com/maps');
  });
});
