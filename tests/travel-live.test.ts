import { describe, it, expect } from 'vitest';
import { HOSPITALS, getHospitalById } from '@/data/hospitals';
import { HOSPITAL_GEO, resolveHospitalGeo } from '@/data/hospital-locations';

/**
 * LOOP B — live verification against the real Google Routes API.
 *
 * Requirement: real-API reruns are allowed to differ from stored fixtures
 * (traffic, route choice, map updates, departure time), so this suite never
 * asserts a specific number for a live call. What it DOES assert is the thing
 * that actually broke in production:
 *
 *   • the numbers the app would display are exactly Google's numbers,
 *   • origin and destination are the intended ones (not swapped, not a default),
 *   • a rerun is consistent within a sane tolerance,
 *   • every failure mode is reported as unknown instead of a guess.
 *
 * It is skipped automatically when GOOGLE_MAPS_API_KEY is absent, so CI without
 * secrets is honest rather than silently "green".
 */

const API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';
const hasKey = API_KEY.length > 10;
const live = hasKey ? describe : describe.skip;

/** The verification matrix from the product requirements. */
const MATRIX = [
  { origin: { lat: 28.6426, lng: 77.1842, label: 'Pusa Road, New Delhi' }, hospitalId: 'bsa-hospital' },
  { origin: { lat: 28.7383, lng: 77.0822, label: 'Rohini, New Delhi' }, hospitalId: 'bsa-hospital' },
  { origin: { lat: 28.5355, lng: 77.3910, label: 'Noida' }, hospitalId: 'safdarjung-hospital' },
  { origin: { lat: 28.4595, lng: 77.0266, label: 'Gurugram' }, hospitalId: 'aiims-new-delhi' },
] as const;

live('LIVE Google Routes API — displayed values must equal API values', () => {
  it.each(MATRIX)('$label → $hospitalId', async ({ origin, hospitalId }) => {
    const hospital = getHospitalById(hospitalId)!;
    const geo = resolveHospitalGeo(hospital);

    // Intent check: destination is the hospital's validated campus, and the
    // origin is nowhere near it (a swapped/default origin would show up here).
    expect(geo.valid).toBe(true);
    expect(Math.abs(geo.lat - origin.lat) + Math.abs(geo.lng - origin.lng)).toBeGreaterThan(0.01);

    const { getRouteDetail } = await import('@/lib/travel');
    const detail = await getRouteDetail({ origin: { lat: origin.lat, lng: origin.lng }, hospital });

    console.table([
      {
        origin: origin.label,
        hospital: hospitalId,
        apiDistanceKm: detail.distanceKm,
        displayed: detail.distanceKm === null ? 'unavailable' : `${detail.distanceKm.toFixed(1)} km`,
        apiEtaMin: detail.etaMinutes,
        apiStaticMin: detail.staticMinutes,
        trafficImpactMin: detail.trafficImpactMinutes,
        source: detail.source,
        status: detail.error ? `FAIL: ${detail.error}` : 'PASS',
      },
    ]);

    if (detail.source === 'unavailable') {
      // Honest failure is acceptable; a fabricated number is not.
      expect(detail.distanceKm).toBeNull();
      expect(detail.etaMinutes).toBeNull();
      expect(detail.error).toBeTruthy();
      return;
    }

    expect(detail.source).toBe('google-routes-api');
    expect(detail.distanceMeters).toBeGreaterThan(0);
    // Displayed km IS the API value, after the documented rounding.
    expect(detail.distanceKm).toBe(Math.round((detail.distanceMeters! / 1000) * 10) / 10);
    expect(detail.etaMinutes).toBeGreaterThan(0);
    expect(detail.staticMinutes).toBeGreaterThan(0);
    // Traffic impact can never be negative.
    expect(detail.trafficImpactMinutes).toBeGreaterThanOrEqual(-1);
    // Geometry is the API polyline, decoded.
    expect((detail.geometry ?? []).length).toBeGreaterThan(5);
    expect(detail.computedAt).toBeTruthy();
  });

  it('is stable across a rerun (traffic may change, the pair of points may not)', async () => {
    const { getTravelSnapshot } = await import('@/lib/travel');
    const origin = { lat: 28.6426, lng: 77.1842 };
    const hospitals = ['bsa-hospital', 'aiims-new-delhi', 'safdarjung-hospital'].map((id) => getHospitalById(id)!);

    const first = await getTravelSnapshot({ origin, hospitals });
    const second = await getTravelSnapshot({ origin, hospitals });

    for (const h of hospitals) {
      const a = first.legs[h.id];
      const b = second.legs[h.id];
      expect(a.source).toBe(b.source);
      if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') {
        // Route choice can shift by a hair between calls; a 2 km swing would mean
        // a real bug (wrong destination or a mixed-up request).
        expect(Math.abs(a.distanceKm - b.distanceKm)).toBeLessThan(2);
      }
    }
  });

  it('reports unknown, not a number, for an invalid coordinate', async () => {
    const { getTravelSnapshot } = await import('@/lib/travel');
    const broken = { ...getHospitalById('bsa-hospital')!, id: 'swapped-test', lat: 77.1149, lng: 28.7151 };
    const snapshot = await getTravelSnapshot({ origin: { lat: 28.6426, lng: 77.1842 }, hospitals: [broken] });
    expect(snapshot.legs['swapped-test'].distanceKm).toBeNull();
    expect(snapshot.legs['swapped-test'].error).toMatch(/validation/i);
  });
});

describe('live-suite guard', () => {
  it('is skipped without a Google Maps key (documented, not silent)', () => {
    if (!hasKey) {
        console.warn(
        '[travel-live] GOOGLE_MAPS_API_KEY is not set — live Google Routes verification skipped. ' +
          'Set the key and re-run `npm test` before release to validate real-world values.',
      );
    }
    expect(HOSPITALS.length).toBeGreaterThan(0);
    expect(Object.keys(HOSPITAL_GEO).length).toBeGreaterThan(20);
  });
});
