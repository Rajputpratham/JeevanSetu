/**
 * KEY-FREE ROAD ROUTING (OSRM) — server-side.
 *
 * WHY THIS EXISTS
 *   The hospital detail page used to depend exclusively on Google Routes. Without
 *   `GOOGLE_MAPS_API_KEY` it rendered "—" for the driving distance and a large
 *   orange "Live traffic not returned" panel. A missing Google key must not make
 *   road distance a dead feature.
 *
 * HONESTY CONTRACT
 *   • OSRM returns a routed road distance and a duration with NO live traffic.
 *     The duration is therefore always labelled "Estimated drive time".
 *   • `live: true` is NEVER produced here: OSRM does not supply traffic data, so
 *     the UI must not claim "Live traffic".
 *   • A straight-line measurement is returned separately and labelled as such.
 *     It is never converted into a drive time.
 *   • Failure yields `source: 'unavailable'` with no distance — never a guess.
 *
 * WHAT THIS IS / IS NOT
 *   The default endpoint is the public OSRM demo server
 *   (router.project-osrm.org), which is explicitly for development and light
 *   use. It has no production service guarantee. Deployments that expect real
 *   traffic must set `OSRM_BASE_URL` (server) or `NEXT_PUBLIC_OSRM_BASE_URL`
 *   (browser tables) to a self-hosted OSRM instance. We keep concurrency and
 *   request volume tiny (one table call per page, 15 min cache) so that the
 *   public demo is never hammered, and we surface the provider name + ODbL
 *   attribution in the UI.
 */

import type { Hospital } from '@/data/types';
import { resolveHospitalGeo } from '@/data/hospital-locations';
import { haversineKm } from './geo';

export type RoadSource = 'osrm' | 'google-routes-api' | 'unavailable';

export interface RoadLeg {
  hospitalId: string;
  /** Road distance in km (null when no route could be computed). */
  distanceKm: number | null;
  distanceMeters: number | null;
  /** Duration in minutes WITHOUT live traffic — label it "Estimated drive time". */
  minutes: number | null;
  /** Direct-line km, always labelled separately in the UI. */
  straightKm: number | null;
  source: RoadSource;
  /** True only when the provider supplied live traffic. OSRM never does. */
  liveTraffic: boolean;
  /** Human-readable provider + licence note rendered under the number. */
  provider: string;
  computedAt: string | null;
  error: string | null;
}

export interface RoadRouteDetail extends RoadLeg {
  /** Encoded OSRM geometry (precision 5), when requested. */
  geometry: [number, number][];
  navigateUrl: string | null;
}

const DEFAULT_BASE = 'https://router.project-osrm.org';
const REQUEST_TIMEOUT_MS = 6_000;
const OSRM_PROVIDER = 'OSRM road routing · © OpenStreetMap contributors (ODbL) · no live traffic';

export function osrmBaseUrl(): string {
  const raw = process.env.OSRM_BASE_URL || process.env.NEXT_PUBLIC_OSRM_BASE_URL || DEFAULT_BASE;
  return raw.replace(/\/+$/, '');
}

/** True when the operator configured their own OSRM instance. */
export function osrmIsSelfHosted(): boolean {
  return osrmBaseUrl() !== DEFAULT_BASE;
}

export function isRoutable(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180
  );
}

function coords(lat: number, lng: number): string {
  return `${lng},${lat}`;
}

function accessToken(): string | null {
  return process.env.OSRM_ACCESS_TOKEN?.trim() || null;
}

export function googleMapsDirectionsUrl(
  origin: { lat: number; lng: number } | null,
  destination: { lat: number; lng: number },
  name?: string,
): string {
  const dest = name ? `${destination.lat},${destination.lng} (${name})` : `${destination.lat},${destination.lng}`;
  if (origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${encodeURIComponent(dest)}&travelmode=driving`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`;
}

interface OsrmTableRow {
  code?: string;
  distances?: (number | null)[][];
  durations?: (number | null)[][];
}

/** One OSRM Table request for origin → many hospitals (batched, small). */
async function fetchTable(
  origin: { lat: number; lng: number },
  destinations: { id: string; lat: number; lng: number }[],
): Promise<{ distances: (number | null)[]; durations: (number | null)[] } | null> {
  if (!destinations.length) return { distances: [], durations: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const token = accessToken();
  const url =
    `${osrmBaseUrl()}/table/v1/driving/${[coords(origin.lat, origin.lng), ...destinations.map((d) => coords(d.lat, d.lng))].join(';')}` +
    `?sources=0&annotations=distance,duration${token ? `&access_token=${encodeURIComponent(token)}` : ''}`;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as OsrmTableRow;
    if (body?.code !== 'Ok' || !Array.isArray(body.distances) || !Array.isArray(body.durations)) return null;
    const row = body.distances[0];
    const drow = body.durations[0];
    if (!Array.isArray(row) || !Array.isArray(drow)) return null;
    if (row.length !== destinations.length + 1 || drow.length !== destinations.length + 1) return null;
    // Drop the origin column, which is always index 0.
    return { distances: row.slice(1), durations: drow.slice(1) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sanitize(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function unavailableLeg(hospital: Hospital, origin: { lat: number; lng: number } | null, error: string): RoadLeg {
  const geo = resolveHospitalGeo(hospital);
  const straightKm =
    origin && isRoutable(geo.lat, geo.lng)
      ? Number(haversineKm(origin.lat, origin.lng, geo.lat, geo.lng).toFixed(2))
      : null;
  return {
    hospitalId: hospital.id,
    distanceKm: null,
    distanceMeters: null,
    minutes: null,
    straightKm,
    source: 'unavailable',
    liveTraffic: false,
    provider: 'OSRM road routing',
    computedAt: null,
    error,
  };
}

/**
 * Road distance + estimated drive time for many hospitals in ONE request.
 * Order is preserved; every hospital gets a leg (never a partial array).
 */
export async function getRoadLegs(
  origin: { lat: number; lng: number },
  hospitals: Hospital[],
): Promise<RoadLeg[]> {
  if (!isRoutable(origin.lat, origin.lng)) {
    return hospitals.map((h) => unavailableLeg(h, null, 'Invalid origin coordinates.'));
  }
  const destinations = hospitals
    .map((h) => {
      const geo = resolveHospitalGeo(h);
      return { id: h.id, lat: geo.lat, lng: geo.lng, valid: isRoutable(geo.lat, geo.lng) };
    })
    .filter((d) => d.valid);

  const table = await fetchTable(origin, destinations);
  const computedAt = new Date().toISOString();
  const byId = new Map<string, RoadLeg>();

  destinations.forEach((d, index) => {
    const meters = sanitize(table?.distances[index]);
    const seconds = sanitize(table?.durations[index]);
    const straightKm = Number(haversineKm(origin.lat, origin.lng, d.lat, d.lng).toFixed(2));
    if (meters === null || seconds === null) {
      byId.set(d.id, {
        hospitalId: d.id,
        distanceKm: null,
        distanceMeters: null,
        minutes: null,
        straightKm,
        source: 'unavailable',
        liveTraffic: false,
        provider: OSRM_PROVIDER,
        computedAt: null,
        error: 'No road route was returned for this hospital.',
      });
      return;
    }
    byId.set(d.id, {
      hospitalId: d.id,
      distanceKm: Math.round(meters / 100) / 10,
      distanceMeters: Math.round(meters),
      minutes: Math.max(1, Math.round(seconds / 60)),
      straightKm,
      source: 'osrm',
      liveTraffic: false,
      provider: OSRM_PROVIDER,
      computedAt,
      error: null,
    });
  });

  return hospitals.map(
    (h) =>
      byId.get(h.id) ??
      unavailableLeg(h, origin, 'This hospital has no validated coordinate, so no road route was requested.'),
  );
}

/** Full detail for ONE hospital: routed geometry + Google Maps deep link. */
export async function getRoadRouteDetail(
  origin: { lat: number; lng: number },
  hospital: Hospital,
): Promise<RoadRouteDetail> {
  const geo = resolveHospitalGeo(hospital);
  const navigateUrl = googleMapsDirectionsUrl(
    isRoutable(origin.lat, origin.lng) ? origin : null,
    { lat: geo.lat, lng: geo.lng },
    hospital.name,
  );
  if (!isRoutable(origin.lat, origin.lng)) {
    return { ...unavailableLeg(hospital, null, 'Invalid origin coordinates.'), geometry: [], navigateUrl };
  }
  if (!isRoutable(geo.lat, geo.lng)) {
    return {
      hospitalId: hospital.id,
      distanceKm: null,
      distanceMeters: null,
      minutes: null,
      straightKm: null,
      source: 'unavailable',
      liveTraffic: false,
      provider: OSRM_PROVIDER,
      computedAt: null,
      error: 'Hospital coordinate failed validation — refusing to route.',
      geometry: [],
      navigateUrl,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const token = accessToken();
  const url =
    `${osrmBaseUrl()}/route/v1/driving/${coords(origin.lat, origin.lng)};${coords(geo.lat, geo.lng)}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false${token ? `&access_token=${encodeURIComponent(token)}` : ''}`;
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store', headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);
    const body = (await response.json()) as {
      code?: string;
      routes?: { distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] } }[];
    };
    const route = body?.code === 'Ok' ? body.routes?.[0] : undefined;
    const meters = sanitize(route?.distance);
    const seconds = sanitize(route?.duration);
    const straightKm = Number(haversineKm(origin.lat, origin.lng, geo.lat, geo.lng).toFixed(2));
    if (meters === null || seconds === null) throw new Error('OSRM returned no usable route.');
    // OSRM GeoJSON is [lng, lat]; the map component expects [lat, lng].
    const geometry = (route?.geometry?.coordinates ?? [])
      .filter((pair): pair is [number, number] => Array.isArray(pair) && pair.length === 2)
      .map(([lng, lat]) => [lat, lng] as [number, number])
      .filter(([lat, lng]) => isRoutable(lat, lng));
    return {
      hospitalId: hospital.id,
      distanceKm: Math.round(meters / 100) / 10,
      distanceMeters: Math.round(meters),
      minutes: Math.max(1, Math.round(seconds / 60)),
      straightKm,
      source: 'osrm',
      liveTraffic: false,
      provider: OSRM_PROVIDER,
      computedAt: new Date().toISOString(),
      error: null,
      geometry,
      navigateUrl,
    };
  } catch (err) {
    return {
      ...unavailableLeg(hospital, origin, err instanceof Error ? err.message : 'OSRM routing failed.'),
      provider: OSRM_PROVIDER,
      geometry: [],
      navigateUrl,
    };
  } finally {
    clearTimeout(timer);
  }
}

export const OSRM_ATTRIBUTION = {
  provider: 'OSRM / OpenStreetMap',
  licence: '© OpenStreetMap contributors, ODbL 1.0',
  liveTraffic: false,
};
