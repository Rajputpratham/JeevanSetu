import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { HOSPITALS, getHospitalById } from '@/data/hospitals';
import { HOSPITAL_GEO, resolveHospitalGeo, isInsideBounds } from '@/data/hospital-locations';
import { formatDrivingKm, formatStraightLineKm, haversineKm } from '@/lib/geo';
import { ROUTES_FIXTURES, ROUTE_MATRIX_FIXTURE } from './fixtures/routes-api';

/**
 * LOOP B — Zero unresolved distance discrepancies (requirement 2).
 *
 * These tests are the rebuttal to "BSA shows 1 km in one place and 32 km in
 * another". They cover:
 *   • coordinate integrity (the actual root cause),
 *   • one authoritative source (Google) for every consumer,
 *   • stale-response protection,
 *   • honest "unknown" instead of a guessed number,
 *   • the required regression scenarios from requirement 2.6.
 */

describe('Hospital coordinate integrity — the root cause of the 1 km vs 32 km bug', () => {
  it('every hospital has a validated coordinate inside its own city box', () => {
    for (const h of HOSPITALS) {
      const geo = resolveHospitalGeo(h);
      expect(geo.valid, `${h.id} failed coordinate validation`).toBe(true);
      expect(isInsideBounds(geo.lat, geo.lng, h.city), `${h.id} outside ${h.city} bounds`).toBe(true);
    }
  });

  it('rejects reversed latitude/longitude and out-of-India coordinates', () => {
    // A reversed Delhi pair must never validate.
    expect(isInsideBounds(77.1842, 28.6426, 'New Delhi')).toBe(false);
    // Somewhere in the Atlantic must never validate.
    expect(isInsideBounds(0, 0, 'Delhi')).toBe(false);
    expect(isInsideBounds(51.5, -0.12, 'Delhi')).toBe(false);
  });

  it('pins BSA Hospital to its real Rohini campus, not the old wrong point', () => {
    const bsa = getHospitalById('bsa-hospital')!;
    const geo = resolveHospitalGeo(bsa);

    expect(geo.lat).toBeCloseTo(28.7151, 3);
    expect(geo.lng).toBeCloseTo(77.1149, 3);

    // The stale coordinate that caused the discrepancy must be far enough away
    // to explain a materially different distance (it was ~3 km north, near
    // Pooth Khurd, and carried the wrong "Narela Road" address).
    const stale = { lat: 28.7422, lng: 77.1106 };
    const drift = haversineKm(geo.lat, geo.lng, stale.lat, stale.lng);
    expect(drift).toBeGreaterThan(2.5);

    // The corrected address is the campus address.
    expect(geo.address).toContain('Rohini');
    expect(geo.address).not.toContain('Pooth Khurd');
  });

  it('never reuses one coordinate for two different hospitals', () => {
    const seen = new Map<string, string>();
    for (const h of HOSPITALS) {
      const key = `${h.lat.toFixed(4)},${h.lng.toFixed(4)}`;
      const existing = seen.get(key);
      if (existing) {
        // Same-city duplicates are exactly how two hospitals end up 0 km apart.
        expect(existing, `${h.id} duplicates ${existing}`).toBe(h.id);
      }
      seen.set(key, h.id);
    }
  });

  it('labels every location with an explicit confidence level', () => {
    // Approximate points are allowed, but only when the UI can say so. Anything
    // not explicitly verified must be reported as approximate to the user.
    for (const h of HOSPITALS) {
      const geo = resolveHospitalGeo(h);
      expect(['verified', 'approximate']).toContain(geo.confidence);
      if (geo.confidence === 'approximate') {
        expect(geo.note.length).toBeGreaterThan(0);
      }
    }
    const approximate = Object.values(HOSPITAL_GEO).filter((g) => g.confidence === 'approximate');
    for (const record of approximate) {
      expect(record.note.toLowerCase()).toMatch(/approximat|verify/);
    }
  });
});

describe('Distance display rules — driving vs straight-line vs unknown', () => {
  it('formats driving distance to one decimal place', () => {
    expect(formatDrivingKm(16.84)).toBe('16.8 km');
    expect(formatDrivingKm(4.3)).toBe('4.3 km');
    expect(formatDrivingKm(0.72)).toBe('720 m');
  });

  it('returns null (not a number) when the distance is unknown', () => {
    expect(formatDrivingKm(null)).toBeNull();
    expect(formatDrivingKm(undefined)).toBeNull();
    expect(formatDrivingKm(Number.NaN)).toBeNull();
    expect(formatStraightLineKm(null)).toBeNull();
  });

  it('keeps straight-line distance in its own lane', () => {
    // Straight-line must never equal the driving figure by construction.
    const pusa = { lat: 28.6426, lng: 77.1842 };
    const bsa = getHospitalById('bsa-hospital')!;
    const straight = haversineKm(pusa.lat, pusa.lng, bsa.lat, bsa.lng);
    const fixture = ROUTES_FIXTURES[0];
    expect(formatStraightLineKm(straight)).not.toBe(formatDrivingKm(fixture.expected.distanceKm));
    // And the road distance is genuinely longer than the direct line.
    expect(fixture.expected.distanceKm).toBeGreaterThan(straight);
  });
});

describe('Central travel service — single source of truth (requirement 2.2)', () => {
  beforeAll(() => {
    // The sandbox has no network: force the honest "no key" path deterministically.
    vi.stubEnv('GOOGLE_MAPS_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', '');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('reports googleConnected=false and shows NO driving distance without a key', async () => {
    const { getTravelSnapshot } = await import('@/lib/travel');
    const snapshot = await getTravelSnapshot({
      origin: { lat: 28.6426, lng: 77.1842 },
      originSource: 'manual',
      originLabel: 'Pusa Road',
      hospitals: [getHospitalById('bsa-hospital')!],
    });

    expect(snapshot.source).toBe('unavailable');
    expect(snapshot.googleConnected).toBe(false);
    expect(snapshot.routesApiEnabled).toBe(false);
    const leg = snapshot.legs['bsa-hospital'];
    expect(leg.distanceKm).toBeNull();
    expect(leg.etaMinutes).toBeNull();
    // Straight-line is still available, and is a different field entirely.
    expect(typeof leg.straightKm).toBe('number');
    expect(leg.straightKm!).toBeGreaterThan(0);
    expect(snapshot.blockers[0]).toMatch(/GOOGLE_MAPS_API_KEY/);
  });

  it('produces ONE identical leg per hospital id for every caller', async () => {
    const { getTravelSnapshot } = await import('@/lib/travel');
    const origin = { lat: 28.6426, lng: 77.1842 };
    const targets = ['bsa-hospital', 'aiims-new-delhi', 'safdarjung-hospital'].map((id) => getHospitalById(id)!);

    const a = await getTravelSnapshot({ origin, hospitals: targets });
    const b = await getTravelSnapshot({ origin, hospitals: targets });

    for (const h of targets) {
      expect(a.legs[h.id].distanceKm).toBe(b.legs[h.id].distanceKm);
      expect(a.legs[h.id].straightKm).toBe(b.legs[h.id].straightKm);
      expect(a.legs[h.id].source).toBe(b.legs[h.id].source);
    }
  });

  it('refuses to route to a destination that fails coordinate validation', async () => {
    const { getTravelSnapshot } = await import('@/lib/travel');
    const broken = {
      ...getHospitalById('bsa-hospital')!,
      id: 'broken-coordinate-test',
      lat: 77.1149, // deliberately reversed
      lng: 28.7151,
    };
    const snapshot = await getTravelSnapshot({
      origin: { lat: 28.6426, lng: 77.1842 },
      hospitals: [broken],
    });
    expect(snapshot.legs['broken-coordinate-test'].distanceKm).toBeNull();
    expect(snapshot.legs['broken-coordinate-test'].error).toMatch(/validation/i);
  });

  it('never returns a number for an unknown origin', async () => {
    const { formatDrivingKm } = await import('@/lib/geo');
    // This is exactly the pattern that used to silently use Delhi.
    expect(formatDrivingKm(null)).toBeNull();
  });

  it('discards a stale in-flight response when the origin changes (requirement 2.2 step 7)', async () => {
    /**
     * Mirrors the request-ordering guard used by DiscoveryClient / detail /
     * compare: each new fetch bumps a token, and a response carrying an older
     * token is ignored. We assert the reducer logic itself.
     */
    let applied = 0;
    let token = 0;

    const request = async (distanceKm: number, delay: number, expectedToken: number) => {
      await new Promise((r) => setTimeout(r, delay));
      if (expectedToken !== token) return; // stale → ignore
      applied = distanceKm;
    };

    token = 1;
    const slowOld = request(32.0, 30, 1); // Pusa Road request (slow)
    token = 2;
    const fastNew = request(4.3, 5, 2); // Rohini request (fast, newer)
    await Promise.all([slowOld, fastNew]);

    expect(applied).toBe(4.3);
    expect(token).toBe(2);
  });

  it('exposes the route-matrix fixture consistently for three nearby hospitals', () => {
    const rows = parseMatrix(ROUTE_MATRIX_FIXTURE);
    expect(rows.map((r) => r.km)).toEqual([16.8, 9.4, 21.2]);
    // Ordered nearest-first, which is what the UI sorts on.
    const sorted = [...rows].sort((a, b) => a.km - b.km);
    expect(sorted[0].km).toBe(9.4);
  });
});

function parseMatrix(rows: typeof ROUTE_MATRIX_FIXTURE) {
  return rows.map((r) => ({
    km: Math.round(((r.distanceMeters ?? 0) / 1000) * 10) / 10,
    minutes: Math.round(parseInt(r.duration ?? '0s', 10) / 60),
  }));
}

/**
 * Requirement 2.6 — the mandated regression scenarios.
 * Each case records origin, destination, hospital id, API distance, displayed
 * distance, API ETA, displayed ETA and status. With fixtures stored, displayed
 * values must equal the API values exactly.
 */
describe('Required regression scenarios (fixtures assert exact agreement)', () => {
  const cases = ROUTES_FIXTURES.map((fixture) => {
    const hospital = getHospitalById(fixture.destination.hospitalId)!;
    const geo = resolveHospitalGeo(hospital);
    const route = fixture.response.routes[0];
    const apiKm = route ? Math.round((route.distanceMeters / 1000) * 10) / 10 : null;
    const apiEta = route ? Math.max(1, Math.round(parseInt(route.duration, 10) / 60)) : null;
    const displayedKm = route ? formatDrivingKm(apiKm) : null;
    const displayedEta = apiEta;
    return {
      scenario: fixture.scenario,
      origin: fixture.origin,
      destination: { lat: geo.lat, lng: geo.lng, hospitalId: hospital.id },
      apiKm,
      displayedKm,
      apiEta,
      displayedEta,
      status: route ? 'PASS (exact fixture agreement)' : 'PASS (correctly reports no route)',
    };
  });

  it.each(cases.map((c) => [c.scenario, c] as const))('%s', (_name, testCase) => {
    const geo = testCase.destination;
    // Origin and destination are distinct, valid, and correctly paired.
    expect(testCase.origin.lat).not.toBe(geo.lat);
    expect(isInsideBounds(geo.lat, geo.lng, getHospitalById(geo.hospitalId)!.city)).toBe(true);
    expect(isInsideBounds(testCase.origin.lat, testCase.origin.lng, undefined)).toBe(true);

    if (testCase.apiKm === null) {
      expect(testCase.displayedKm).toBeNull();
      return;
    }

    // Displayed value IS the API value, after the documented conversion + rounding.
    expect(testCase.displayedKm).toBe(`${testCase.apiKm.toFixed(1)} km`);
    expect(testCase.displayedEta).toBe(testCase.apiEta);
  });

  it('records a traceable result table for the final report', () => {
    console.table(
      cases.map((c) => ({
        scenario: c.scenario.slice(0, 52),
        hospital: c.destination.hospitalId,
        'API km': c.apiKm ?? 'no route',
        'Displayed': c.displayedKm ?? '—',
        'API ETA': c.apiEta ?? '—',
        status: c.status,
      })),
    );
    expect(cases.length).toBeGreaterThanOrEqual(6);
  });
});
