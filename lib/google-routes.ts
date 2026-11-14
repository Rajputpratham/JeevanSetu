/**
 * Google Routes API (v2) adapter — JeevanSetu's AUTHORITATIVE driving-distance source.
 *
 * Docs: https://developers.google.com/maps/documentation/routes
 *
 * Design rules (non-negotiable):
 *  1. Displayed "Driving distance" is derived ONLY from `routes[].distanceMeters`
 *     of a single, explicitly selected route returned by Google.
 *  2. `duration` / `staticDuration` are parsed exactly as documented ("123s").
 *  3. We never invent incident data and never imply a guaranteed travel time.
 *  4. Every failure mode is normalised into a typed error so the UI can disclose
 *     it honestly instead of fabricating a distance.
 *
 * This module is dependency-free and pure (except `fetchRoutes*` helpers) so it
 * can be unit-tested against stored API fixtures without a network.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export type TravelMode = 'DRIVE' | 'TWO_WHEELER';

/** Google enum values used by the Routes API `routingPreference` field. */
export type RoutingPreference = 'TRAFFIC_AWARE' | 'TRAFFIC_AWARE_OPTIMAL' | 'TRAFFIC_UNAWARE';

export interface GoogleRouteOption {
  /** `routes[].distanceMeters` — the ONLY value we use for displayed road distance. */
  distanceMeters: number;
  /** `routes[].duration` in seconds (traffic-aware when TRAFFIC_AWARE* is used). */
  durationSeconds: number;
  /** `routes[].staticDuration` in seconds (traffic-independent reference). */
  staticDurationSeconds: number;
  /** `routes[].polyline.encodedPolyline` (encoded polyline, 5 decimal precision). */
  encodedPolyline: string;
  /** `routes[].routeLabels`, e.g. DEFAULT_ROUTE / FUEL_EFFICIENT. */
  routeLabels: string[];
  /** `routes[].description` — human label for the alternative ("via Ring Road"). */
  description: string | null;
  /** True when Google flagged traffic conditions on this route. */
  trafficAware: boolean;
}

export interface GoogleRoutesParseResult {
  routes: GoogleRouteOption[];
  /** Google API error status (e.g. REQUEST_DENIED) when the request failed. */
  error: { status: string; message: string } | null;
  geocodedWaypoints: { origin?: LatLng; destination?: LatLng } | null;
}

/** Google durations arrive as strings such as "1234s". */
export function parseGoogleDurationSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = /^(-?\d+(?:\.\d+)?)s$/.exec(value.trim());
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/** Meter → kilometre, to one decimal place, exactly as displayed. */
export function metersToDisplayKm(distanceMeters: number): number {
  return Math.round((distanceMeters / 1000) * 10) / 10;
}

/** Seconds → whole minutes (never below 1 for a real route). */
export function secondsToMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

/** Field mask keeps billing/response size minimal while covering every field we read. */
export const ROUTES_FIELD_MASK = [
  'routes.distanceMeters',
  'routes.duration',
  'routes.staticDuration',
  'routes.polyline.encodedPolyline',
  'routes.routeLabels',
  'routes.description',
  'routes.viewport',
  'routes.travelAdvisory',
].join(',');

export const ROUTE_MATRIX_FIELD_MASK = [
  'originIndex',
  'destinationIndex',
  'status',
  'condition',
  'distanceMeters',
  'duration',
  'staticDuration',
].join(',');

export interface RoutesRequestBody {
  origin: { location: { latLng: { latitude: number; longitude: number } } };
  destination: { location: { latLng: { latitude: number; longitude: number } } };
  travelMode: TravelMode;
  routingPreference: RoutingPreference;
  computeAlternativeRoutes: boolean;
  languageCode: string;
  units: 'METRIC';
  polylineQuality: 'HIGH_QUALITY';
  routeModifiers: { avoidFerries: boolean; avoidTolls: boolean; avoidHighways: boolean };
}

export function buildRoutesRequestBody(params: {
  origin: LatLng;
  destination: LatLng;
  travelMode: TravelMode;
  routingPreference: RoutingPreference;
  alternatives: boolean;
  languageCode?: string;
}): RoutesRequestBody {
  return {
    origin: { location: { latLng: { latitude: params.origin.lat, longitude: params.origin.lng } } },
    destination: {
      location: { latLng: { latitude: params.destination.lat, longitude: params.destination.lng } },
    },
    travelMode: params.travelMode,
    routingPreference: params.routingPreference,
    computeAlternativeRoutes: params.alternatives,
    languageCode: params.languageCode ?? 'en-IN',
    units: 'METRIC',
    polylineQuality: 'HIGH_QUALITY',
    routeModifiers: { avoidFerries: true, avoidTolls: false, avoidHighways: false },
  };
}

interface RawGoogleRoute {
  distanceMeters?: number;
  duration?: unknown;
  staticDuration?: unknown;
  polyline?: { encodedPolyline?: string };
  routeLabels?: string[];
  description?: string;
  travelAdvisory?: { speedReadingIntervals?: unknown[] };
}

/** Pure parser — used by production code AND by fixture-based regression tests. */
export function parseRoutesResponse(json: unknown): GoogleRoutesParseResult {
  const root = (json ?? {}) as {
    routes?: RawGoogleRoute[];
    error?: { status?: string; message?: string; code?: number };
  };

  if (root.error) {
    return {
      routes: [],
      error: {
        status: root.error.status ?? 'UNKNOWN_ERROR',
        message: root.error.message ?? 'Google Routes API returned an error.',
      },
      geocodedWaypoints: null,
    };
  }

  const parsed: GoogleRouteOption[] = [];
  for (const raw of root.routes ?? []) {
    const distanceMeters = typeof raw.distanceMeters === 'number' ? raw.distanceMeters : null;
    const durationSeconds = parseGoogleDurationSeconds(raw.duration);
    if (distanceMeters === null || durationSeconds === null) continue;

    const staticSeconds = parseGoogleDurationSeconds(raw.staticDuration) ?? durationSeconds;
    parsed.push({
      distanceMeters,
      durationSeconds,
      staticDurationSeconds: staticSeconds,
      encodedPolyline: raw.polyline?.encodedPolyline ?? '',
      routeLabels: Array.isArray(raw.routeLabels) ? raw.routeLabels : [],
      description: raw.description ?? null,
      trafficAware:
        staticSeconds > 0 && Math.abs(durationSeconds - staticSeconds) >= 1 ? true : staticSeconds > 0,
    });
  }

  return { routes: parsed, error: null, geocodedWaypoints: null };
}

/**
 * Picks the route we will display. Requirement 2.4: when alternatives exist we
 * always show the distance/ETA of one *explicitly selected* route so that a
 * card, a map popup and the assistant can never disagree.
 */
export function selectRoute(routes: GoogleRouteOption[], preferredIndex = 0): GoogleRouteOption | null {
  if (routes.length === 0) return null;
  const index = Number.isInteger(preferredIndex) && preferredIndex >= 0 && preferredIndex < routes.length
    ? preferredIndex
    : 0;
  return routes[index];
}

/** Decoded geometry so the Google Map draws exactly the polyline Google returned. */
export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded) return [];
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

export function encodePolyline(points: [number, number][]): string {
  let lastLat = 0;
  let lastLng = 0;
  let out = '';
  for (const [lat, lng] of points) {
    const iLat = Math.round(lat * 1e5);
    const iLng = Math.round(lng * 1e5);
    out += encodeValue(iLat - lastLat);
    out += encodeValue(iLng - lastLng);
    lastLat = iLat;
    lastLng = iLng;
  }
  return out;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}

export const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
export const ROUTE_MATRIX_ENDPOINT = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';

export interface RoutesFetchResult {
  ok: boolean;
  routes: GoogleRouteOption[];
  httpStatus: number;
  errorStatus: string | null;
  errorMessage: string | null;
}

/** Thin fetch wrapper with a hard timeout. Never throws. */
export async function fetchRoutes(params: {
  apiKey: string;
  origin: LatLng;
  destination: LatLng;
  travelMode: TravelMode;
  routingPreference: RoutingPreference;
  alternatives?: boolean;
  languageCode?: string;
  timeoutMs?: number;
}): Promise<RoutesFetchResult> {
  const body = buildRoutesRequestBody({
    origin: params.origin,
    destination: params.destination,
    travelMode: params.travelMode,
    routingPreference: params.routingPreference,
    alternatives: params.alternatives ?? false,
    languageCode: params.languageCode,
  });

  try {
    const res = await fetch(ROUTES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': params.apiKey,
        'X-Goog-FieldMask': ROUTES_FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(params.timeoutMs ?? 6000),
      cache: 'no-store',
    });

    const json = await res.json().catch(() => ({}));
    const parsed = parseRoutesResponse(json);

    if (!res.ok || parsed.error) {
      return {
        ok: false,
        routes: [],
        httpStatus: res.status,
        errorStatus: parsed.error?.status ?? `HTTP_${res.status}`,
        errorMessage: parsed.error?.message ?? 'Google Routes API request failed.',
      };
    }
    return {
      ok: parsed.routes.length > 0,
      routes: parsed.routes,
      httpStatus: res.status,
      errorStatus: parsed.routes.length === 0 ? 'ZERO_RESULTS' : null,
      errorMessage: parsed.routes.length === 0 ? 'Google returned no drivable route.' : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      ok: false,
      routes: [],
      httpStatus: 0,
      errorStatus: /timeout|abort/i.test(message) ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: message,
    };
  }
}

export interface RouteMatrixEntry {
  originIndex: number;
  destinationIndex: number;
  /** Google element-level status code (0 = OK). */
  statusCode: number;
  condition: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  staticDurationSeconds: number | null;
}

export interface RouteMatrixFetchResult {
  ok: boolean;
  entries: RouteMatrixEntry[];
  httpStatus: number;
  errorStatus: string | null;
  errorMessage: string | null;
}

interface RawMatrixEntry {
  originIndex?: number;
  destinationIndex?: number;
  status?: { code?: number; message?: string };
  condition?: string;
  distanceMeters?: number;
  duration?: unknown;
  staticDuration?: unknown;
}

/** Pure parser for computeRouteMatrix responses (array OR wrapped object). */
export function parseRouteMatrixResponse(json: unknown): RouteMatrixEntry[] {
  const rows: RawMatrixEntry[] = Array.isArray(json)
    ? (json as RawMatrixEntry[])
    : Array.isArray((json as { rows?: RawMatrixEntry[] })?.rows)
      ? ((json as { rows: RawMatrixEntry[] }).rows as RawMatrixEntry[])
      : [];

  return rows.map((row) => ({
    originIndex: row.originIndex ?? 0,
    destinationIndex: row.destinationIndex ?? 0,
    statusCode: row.status?.code ?? 0,
    condition: row.condition ?? null,
    distanceMeters: typeof row.distanceMeters === 'number' ? row.distanceMeters : null,
    durationSeconds: parseGoogleDurationSeconds(row.duration),
    staticDurationSeconds: parseGoogleDurationSeconds(row.staticDuration),
  }));
}

/**
 * Batch driving distances: ONE request covers up to 25 destinations from a single
 * origin. This is what keeps hospital cards, search results, emergency results,
 * comparisons and the assistant reading the exact same numbers.
 */
export async function fetchRouteMatrix(params: {
  apiKey: string;
  origin: LatLng;
  destinations: LatLng[];
  travelMode: TravelMode;
  routingPreference: RoutingPreference;
  languageCode?: string;
  timeoutMs?: number;
}): Promise<RouteMatrixFetchResult> {
  const body = {
    origins: [
      {
        waypoint: {
          location: { latLng: { latitude: params.origin.lat, longitude: params.origin.lng } },
        },
      },
    ],
    destinations: params.destinations.map((d) => ({
      waypoint: { location: { latLng: { latitude: d.lat, longitude: d.lng } } },
    })),
    travelMode: params.travelMode,
    routingPreference: params.routingPreference,
    languageCode: params.languageCode ?? 'en-IN',
    units: 'METRIC',
  };

  try {
    const res = await fetch(ROUTE_MATRIX_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': params.apiKey,
        'X-Goog-FieldMask': ROUTE_MATRIX_FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(params.timeoutMs ?? 7000),
      cache: 'no-store',
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const errRoot = (json ?? {}) as { error?: { status?: string; message?: string } };
      return {
        ok: false,
        entries: [],
        httpStatus: res.status,
        errorStatus: errRoot.error?.status ?? `HTTP_${res.status}`,
        errorMessage: errRoot.error?.message ?? 'Google Route Matrix request failed.',
      };
    }

    const entries = parseRouteMatrixResponse(json);
    return {
      ok: entries.some((e) => e.statusCode === 0 && e.distanceMeters !== null),
      entries,
      httpStatus: res.status,
      errorStatus: entries.length === 0 ? 'ZERO_RESULTS' : null,
      errorMessage: entries.length === 0 ? 'No route matrix rows returned.' : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      ok: false,
      entries: [],
      httpStatus: 0,
      errorStatus: /timeout|abort/i.test(message) ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: message,
    };
  }
}

/** Google Maps deep link for turn-by-turn navigation (opens the real Maps app). */
export function googleMapsNavigateUrl(
  from: LatLng,
  to: LatLng,
  options: { travelMode?: 'driving' | 'two-wheeler'; placeId?: string | null; destinationName?: string } = {},
): string {
  const mode = options.travelMode ?? 'driving';
  const destination = options.placeId
    ? `destination_place_id=${encodeURIComponent(options.placeId)}&destination=${encodeURIComponent(
        options.destinationName ?? `${to.lat},${to.lng}`,
      )}`
    : `destination=${to.lat},${to.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&${destination}&travelmode=${mode}`;
}
