import { describe, it, expect } from 'vitest';
import {
  parseGoogleDurationSeconds,
  metersToDisplayKm,
  secondsToMinutes,
  parseRoutesResponse,
  selectRoute,
  decodePolyline,
  encodePolyline,
  buildRoutesRequestBody,
  parseRouteMatrixResponse,
  googleMapsNavigateUrl,
} from '@/lib/google-routes';
import {
  ROUTES_FIXTURES,
  ROUTE_MATRIX_FIXTURE,
  ERROR_FIXTURES,
} from './fixtures/routes-api';

/**
 * LOOP B — Distance accuracy (unit level).
 *
 * Every assertion here is about one thing: the numbers we show come from
 * Google's own fields, with no local modelling in between.
 */
describe('Google Routes API adapter — field parsing & display rules', () => {
  it('parses Google duration strings ("3060s") exactly', () => {
    expect(parseGoogleDurationSeconds('3060s')).toBe(3060);
    expect(parseGoogleDurationSeconds('0s')).toBe(0);
    expect(parseGoogleDurationSeconds('42.5s')).toBe(42.5);
    expect(parseGoogleDurationSeconds('3060')).toBeNull();
    expect(parseGoogleDurationSeconds('3m')).toBeNull();
    expect(parseGoogleDurationSeconds(undefined)).toBeNull();
  });

  it('converts meters to kilometres to one decimal place (requirement 2.1)', () => {
    expect(metersToDisplayKm(16840)).toBe(16.8);
    expect(metersToDisplayKm(11700)).toBe(11.7);
    expect(metersToDisplayKm(4300)).toBe(4.3);
    expect(metersToDisplayKm(950)).toBe(1); // 0.95 → 1.0 (one decimal)
    expect(metersToDisplayKm(27100)).toBe(27.1);
  });

  it('rounds durations to whole minutes, never below 1', () => {
    expect(secondsToMinutes(3060)).toBe(51);
    expect(secondsToMinutes(20)).toBe(1);
    expect(secondsToMinutes(0)).toBe(1);
  });

  it('maps every fixture route onto the exact stored values', () => {
    for (const fixture of ROUTES_FIXTURES) {
      const parsed = parseRoutesResponse(fixture.response);
      expect(parsed.error).toBeNull();

      if (fixture.response.routes.length === 0) {
        expect(parsed.routes).toHaveLength(0);
        expect(selectRoute(parsed.routes)).toBeNull();
        continue;
      }

      const selected = selectRoute(parsed.routes, 0)!;
      expect(selected.distanceMeters).toBe(fixture.expected.distanceMeters);
      expect(selected.durationSeconds).toBe(fixture.expected.durationSeconds);
      expect(selected.staticDurationSeconds).toBe(fixture.expected.staticDurationSeconds);

      // The displayed values must be derived, not re-invented.
      expect(metersToDisplayKm(selected.distanceMeters)).toBe(fixture.expected.distanceKm);
      expect(secondsToMinutes(selected.durationSeconds)).toBe(fixture.expected.etaMinutes);
      expect(secondsToMinutes(selected.staticDurationSeconds)).toBe(fixture.expected.staticMinutes);
      expect(
        secondsToMinutes(selected.durationSeconds) - secondsToMinutes(selected.staticDurationSeconds),
      ).toBe(fixture.expected.trafficImpactMinutes);
    }
  });

  it('always selects the explicitly chosen alternative, never a mix', () => {
    const fixtures = ROUTES_FIXTURES.find((f) => f.scenario.includes('AIIMS'))!;
    const parsed = parseRoutesResponse(fixtures.response);
    expect(parsed.routes).toHaveLength(2);

    const first = selectRoute(parsed.routes, 0)!;
    const second = selectRoute(parsed.routes, 1)!;

    expect(metersToDisplayKm(first.distanceMeters)).toBe(11.7);
    expect(metersToDisplayKm(second.distanceMeters)).toBe(13.0); // 12950 → 12.95 → 13.0
    // Out-of-range indexes clamp to route 0 rather than inventing a third route.
    expect(selectRoute(parsed.routes, 9)!.distanceMeters).toBe(first.distanceMeters);
    expect(selectRoute(parsed.routes, -4)!.distanceMeters).toBe(first.distanceMeters);
  });

  it('surfaces Google API errors instead of returning a distance', () => {
    const denied = parseRoutesResponse(ERROR_FIXTURES.permissionDenied);
    expect(denied.error?.status).toBe('PERMISSION_DENIED');
    expect(denied.routes).toHaveLength(0);

    const quota = parseRoutesResponse(ERROR_FIXTURES.quotaExceeded);
    expect(quota.error?.status).toBe('RESOURCE_EXHAUSTED');

    const empty = parseRoutesResponse(ERROR_FIXTURES.zeroResults);
    expect(empty.error).toBeNull();
    expect(empty.routes).toHaveLength(0);
    expect(selectRoute(empty.routes)).toBeNull();
  });

  it('decodes the returned polyline into the route geometry (requirement 2.5 step 5)', () => {
    const fixtures = ROUTES_FIXTURES[0];
    const parsed = parseRoutesResponse(fixtures.response);
    const geometry = decodePolyline(parsed.routes[0].encodedPolyline);
    expect(geometry.length).toBeGreaterThan(5);
    const [firstLat, firstLng] = geometry[0];
    const [lastLat, lastLng] = geometry[geometry.length - 1];
    expect(firstLat).toBeCloseTo(fixtures.origin.lat, 3);
    expect(firstLng).toBeCloseTo(fixtures.origin.lng, 3);
    expect(lastLat).toBeCloseTo(fixtures.destination.lat, 3);
    expect(lastLng).toBeCloseTo(fixtures.destination.lng, 3);
  });

  it('round-trips encoded polylines', () => {
    const points: [number, number][] = [
      [28.6426, 77.1842],
      [28.66, 77.17],
      [28.7151, 77.1149],
    ];
    expect(decodePolyline(encodePolyline(points))).toEqual(points);
  });

  it('sends the documented Routes API v2 request body', () => {
    const body = buildRoutesRequestBody({
      origin: { lat: 28.6426, lng: 77.1842 },
      destination: { lat: 28.7151, lng: 77.1149 },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
      alternatives: true,
    });
    expect(body.travelMode).toBe('DRIVE');
    expect(body.routingPreference).toBe('TRAFFIC_AWARE_OPTIMAL');
    expect(body.computeAlternativeRoutes).toBe(true);
    expect(body.origin.location.latLng).toEqual({ latitude: 28.6426, longitude: 77.1842 });
    expect(body.destination.location.latLng).toEqual({ latitude: 28.7151, longitude: 77.1149 });
    expect(body.units).toBe('METRIC');
  });

  it('parses route-matrix elements including per-element failures', () => {
    const entries = parseRouteMatrixResponse(ROUTE_MATRIX_FIXTURE);
    expect(entries).toHaveLength(3);
    expect(entries[0].distanceMeters).toBe(16840);
    expect(entries[0].durationSeconds).toBe(3060);
    expect(entries[1].distanceMeters).toBe(9400);
    expect(entries[2].statusCode).toBe(0);

    const withFailure = parseRouteMatrixResponse([
      { originIndex: 0, destinationIndex: 0, status: { code: 4 }, condition: 'ROUTE_NOT_FOUND' },
    ]);
    expect(withFailure[0].statusCode).toBe(4);
    expect(withFailure[0].distanceMeters).toBeNull();
  });

  it('builds a Google Maps navigation deep link with origin + destination', () => {
    const url = googleMapsNavigateUrl({ lat: 28.6426, lng: 77.1842 }, { lat: 28.7151, lng: 77.1149 });
    expect(url).toContain('origin=28.6426,77.1842');
    expect(url).toContain('destination=28.7151,77.1149');
    expect(url).toContain('travelmode=driving');
  });
});
