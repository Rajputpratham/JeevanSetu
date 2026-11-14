/**
 * JeevanSetu CENTRAL TRAVEL SERVICE — the single source of truth for every
 * driving distance, ETA and traffic figure shown anywhere on the site.
 *
 * Consumers that MUST go through this module (requirement 2.2):
 *   • homepage nearby/recommended sections
 *   • hospital search results & hospital cards
 *   • hospital detail pages
 *   • map markers & popups
 *   • hospital comparison
 *   • emergency results
 *   • rankings
 *   • JeevanSetu AI Assistant
 *
 * Source-of-truth ladder (strictly ordered, never mixed):
 *   1. google-routes-api        — Google Routes API v2 (TrafficAwareOptimal)
 *   2. google-route-matrix      — Google Routes API v2 computeRouteMatrix
 *   3. unavailable              — nothing is displayed as a driving distance
 *
 * We deliberately do NOT fall back to a straight-line approximation while the
 * label says "Driving distance": an unknown distance must read as unknown.
 */

import type { Hospital } from '@/data/types';
import { resolveHospitalGeo } from '@/data/hospital-locations';
import {
  fetchRouteMatrix,
  fetchRoutes,
  googleMapsNavigateUrl,
  metersToDisplayKm,
  decodePolyline,
  ROUTE_MATRIX_FIELD_MASK,
  ROUTES_FIELD_MASK,
  type LatLng,
  type RoutingPreference,
  type TravelMode,
} from './google-routes';
import { haversineKm } from './geo';

export type TravelSource = 'google-routes-api' | 'google-route-matrix' | 'unavailable';

/** Where a routing origin came from — drives the accuracy disclosure. */
export type OriginSource = 'geolocation' | 'manual' | 'preset' | 'map' | 'unknown';

export interface TrafficDisclosure {
  /** Human sentence rendered next to the numbers. */
  text: string;
  /** True only when Google itself supplied live/traffic-aware durations. */
  live: boolean;
}

export interface TravelLeg {
  hospitalId: string;
  /** Displayed driving distance in km, from `distanceMeters / 1000`. */
  distanceKm: number | null;
  /** Raw Google value, kept for verification & tests. */
  distanceMeters: number | null;
  /** Estimated driving duration in minutes (traffic-aware when available). */
  etaMinutes: number | null;
  /** Traffic-independent reference duration in minutes. */
  staticMinutes: number | null;
  /** ETA minus static duration — the "traffic impact" shown to the user. */
  trafficImpactMinutes: number | null;
  /** Approximate straight-line distance (null when the coordinate is invalid). */
  straightKm: number | null;
  source: TravelSource;
  /** ISO timestamp of when Google answered (route freshness). */
  computedAt: string | null;
  /** Failure reason when source === 'unavailable'. */
  error: string | null;
  disclosure: TrafficDisclosure;
}

export interface TravelSnapshot {
  origin: LatLng;
  /** Where the origin came from — drives the accuracy disclosure. */
  originSource: OriginSource;
  originLabel: string;
  originAccuracyM: number | null;
  travelMode: TravelMode;
  routingPreference: RoutingPreference;
  source: TravelSource;
  /** True when Google was actually reachable for at least one leg. */
  googleConnected: boolean;
  routesApiEnabled: boolean;
  requestId: string;
  computedAt: string;
  /** Per-hospital results, keyed by the stable hospital id. */
  legs: Record<string, TravelLeg>;
  disclosure: TrafficDisclosure;
  /** Honest blocker messages (missing key, quota, permission…). */
  blockers: string[];
}

export interface RouteDetail extends TravelLeg {
  geometry: [number, number][];
  alternatives: {
    distanceKm: number;
    etaMinutes: number;
    description: string | null;
    labels: string[];
  }[];
  selectedIndex: number;
  polylineSource: 'google-encoded-polyline' | 'unavailable';
  navigateUrl: string | null;
}

export const TRAVEL_DISCLOSURES = {
  live: {
    text: 'Driving distance and ETA from the Google Routes API for your selected origin, with live traffic where Google provides it.',
    live: true,
  } as TrafficDisclosure,
  liveNoTraffic: {
    text: 'Driving distance and ETA from the Google Routes API for your selected origin. Traffic-aware durations were not returned for this route, so the traffic figure is not shown.',
    live: true,
  } as TrafficDisclosure,
  unavailable: {
    text: 'Live Google route data is unavailable right now, so no driving distance is shown. Any figure marked “Approximate straight-line distance” is a direct-line measurement, not a road distance.',
    live: false,
  } as TrafficDisclosure,
};

export function getServerMapsKey(): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

/** Browser key for the Maps JavaScript API — must be referrer-restricted. */
export function getPublicMapsKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

export function hasServerMapsKey(): boolean {
  return getServerMapsKey() !== null;
}

export function hasPublicMapsKey(): boolean {
  return getPublicMapsKey() !== null;
}

/** Distance a batch matrix request may cover (Google allows 25 destinations). */
const MAX_MATRIX_DESTINATIONS = 25;

function makeRequestId(): string {
  return `js-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyLeg(h: Hospital, error: string, straightKm: number | null = null): TravelLeg {
  return {
    hospitalId: h.id,
    distanceKm: null,
    distanceMeters: null,
    etaMinutes: null,
    staticMinutes: null,
    trafficImpactMinutes: null,
    straightKm,
    source: 'unavailable',
    computedAt: null,
    error,
    disclosure: TRAVEL_DISCLOSURES.unavailable,
  };
}

/**
 * Builds travel legs for many hospitals from one origin.
 *
 * Uses Google's route matrix (one request, up to 25 hospitals) so the sort order,
 * the cards, the map popups and the assistant cannot drift apart. When a batch
 * fails we fall back to individual `computeRoutes` calls for the first handful of
 * hospitals, still authoritative, just chattier.
 */
export async function getTravelSnapshot(params: {
  origin: LatLng;
  originSource?: OriginSource;
  originLabel?: string;
  originAccuracyM?: number | null;
  hospitals: Hospital[];
  travelMode?: TravelMode;
  routingPreference?: RoutingPreference;
  language?: string;
}): Promise<TravelSnapshot> {
  const travelMode = params.travelMode ?? 'DRIVE';
  const routingPreference = params.routingPreference ?? 'TRAFFIC_AWARE_OPTIMAL';
  const apiKey = getServerMapsKey();
  const computedAt = new Date().toISOString();
  const requestId = makeRequestId();

  const base = {
    origin: params.origin,
    originSource: params.originSource ?? 'unknown',
    originLabel: params.originLabel ?? 'Selected location',
    originAccuracyM: params.originAccuracyM ?? null,
    travelMode,
    routingPreference,
    requestId,
    computedAt,
  };

  const routable: { hospital: Hospital; lat: number; lng: number }[] = [];
  const rejected: Record<string, string> = {};

  for (const h of params.hospitals) {
    const geo = resolveHospitalGeo(h);
    if (!geo.valid) {
      rejected[h.id] = `Coordinate failed validation for ${h.city} — no route requested.`;
      continue;
    }
    routable.push({ hospital: h, lat: geo.lat, lng: geo.lng });
  }

  if (!apiKey) {
    const legs: Record<string, TravelLeg> = {};
    for (const h of params.hospitals) {
      const rejection = rejected[h.id];
      // A hospital that failed coordinate validation gets NO geometry-derived
      // numbers — a straight line from a reversed pair is still a lie.
      legs[h.id] = emptyLeg(
        h,
        rejection ?? 'GOOGLE_MAPS_API_KEY is not configured on the server.',
        rejection
          ? null
          : Number(haversineKm(params.origin.lat, params.origin.lng, h.lat, h.lng).toFixed(2)),
      );
    }
    return {
      ...base,
      source: 'unavailable',
      googleConnected: false,
      routesApiEnabled: false,
      legs,
      disclosure: TRAVEL_DISCLOSURES.unavailable,
      blockers: [
        'GOOGLE_MAPS_API_KEY is not configured — Google Routes API calls are disabled and no driving distances are displayed.',
      ],
    };
  }

  const legs: Record<string, TravelLeg> = {};
  const blockers: string[] = [];
  let googleConnected = false;
  let routesApiEnabled = true;

  // ── Batch (route matrix) path ───────────────────────────────────────────────
  const batches: typeof routable[] = [];
  for (let i = 0; i < routable.length; i += MAX_MATRIX_DESTINATIONS) {
    batches.push(routable.slice(i, i + MAX_MATRIX_DESTINATIONS));
  }

  for (const batch of batches) {
    if (batch.length === 0) continue;
    const result = await fetchRouteMatrix({
      apiKey,
      origin: params.origin,
      destinations: batch.map((b) => ({ lat: b.lat, lng: b.lng })),
      travelMode,
      routingPreference,
      languageCode: params.language ?? 'en-IN',
    });

    if (result.httpStatus === 403 || /PERMISSION_DENIED|API_NOT_ACTIVATED|SERVICE_DISABLED/i.test(result.errorStatus ?? '')) {
      routesApiEnabled = false;
      blockers.push(
        `Google Routes API is not enabled/authorised for this key (${result.errorStatus}). Enable “Routes API” in Google Cloud Console and allow it on the key’s API restrictions.`,
      );
      break;
    }

    if (!result.ok) {
      if (result.errorStatus) {
        blockers.push(`Google Route Matrix error: ${result.errorStatus}${result.errorMessage ? ` — ${result.errorMessage}` : ''}`);
      }
      continue;
    }

    googleConnected = true;
    for (const entry of result.entries) {
      const target = batch[entry.destinationIndex];
      if (!target) continue;
      const hospital = target.hospital;

      if (entry.statusCode !== 0 || entry.distanceMeters === null) {
        legs[hospital.id] = emptyLeg(
          hospital,
          `Google could not calculate a driving route (status ${entry.statusCode}).`,
          Number(haversineKm(params.origin.lat, params.origin.lng, hospital.lat, hospital.lng).toFixed(2)),
        );
        continue;
      }

      const staticSeconds = entry.staticDurationSeconds ?? entry.durationSeconds ?? 0;
      const durationSeconds = entry.durationSeconds ?? staticSeconds;
      const etaMinutes = Math.max(1, Math.round(durationSeconds / 60));
      const staticMinutes = Math.max(1, Math.round(staticSeconds / 60));
      const hasTraffic = staticSeconds > 0 && durationSeconds >= staticSeconds;

      legs[hospital.id] = {
        hospitalId: hospital.id,
        distanceKm: metersToDisplayKm(entry.distanceMeters),
        distanceMeters: entry.distanceMeters,
        etaMinutes,
        staticMinutes,
        trafficImpactMinutes: hasTraffic ? Math.max(0, etaMinutes - staticMinutes) : null,
        straightKm: Number(
          haversineKm(params.origin.lat, params.origin.lng, hospital.lat, hospital.lng).toFixed(2),
        ),
        source: 'google-route-matrix',
        computedAt,
        error: null,
        disclosure: hasTraffic ? TRAVEL_DISCLOSURES.live : TRAVEL_DISCLOSURES.liveNoTraffic,
      };
    }
  }

  // ── Per-hospital fallback for anything the matrix could not answer ──────────
  const missing = routable.filter((r) => !legs[r.hospital.id]);
  for (const item of missing) {
    const result = await fetchRoutes({
      apiKey,
      origin: params.origin,
      destination: { lat: item.lat, lng: item.lng },
      travelMode,
      routingPreference,
      alternatives: false,
      languageCode: params.language ?? 'en-IN',
    });

    if (result.httpStatus === 403) {
      routesApiEnabled = false;
      blockers.push(
        `Google Routes API rejected the request (${result.errorStatus}). Enable “Routes API” and check the key’s API restrictions.`,
      );
      break;
    }

    const route = result.routes[0];
    if (!result.ok || !route) {
      legs[item.hospital.id] = emptyLeg(
        item.hospital,
        result.errorStatus ?? 'NO_ROUTE',
        Number(
          haversineKm(params.origin.lat, params.origin.lng, item.hospital.lat, item.hospital.lng).toFixed(2),
        ),
      );
      continue;
    }

    googleConnected = true;
    const etaMinutes = Math.max(1, Math.round(route.durationSeconds / 60));
    const staticMinutes = Math.max(1, Math.round(route.staticDurationSeconds / 60));
    legs[item.hospital.id] = {
      hospitalId: item.hospital.id,
      distanceKm: metersToDisplayKm(route.distanceMeters),
      distanceMeters: route.distanceMeters,
      etaMinutes,
      staticMinutes,
      trafficImpactMinutes: Math.max(0, etaMinutes - staticMinutes),
      straightKm: Number(
        haversineKm(params.origin.lat, params.origin.lng, item.hospital.lat, item.hospital.lng).toFixed(2),
      ),
      source: 'google-routes-api',
      computedAt,
      error: null,
      disclosure: TRAVEL_DISCLOSURES.live,
    };
  }

  // Anything still missing (no key path handled above, unreachable Google, etc.)
  for (const h of params.hospitals) {
    if (!legs[h.id]) {
      legs[h.id] = emptyLeg(
        h,
        rejected[h.id] ?? 'No driving route available.',
        Number(haversineKm(params.origin.lat, params.origin.lng, h.lat, h.lng).toFixed(2)),
      );
    }
  }

  const source: TravelSource = googleConnected
    ? Object.values(legs).some((l) => l.source === 'google-route-matrix')
      ? 'google-route-matrix'
      : 'google-routes-api'
    : 'unavailable';

  if (!googleConnected) {
    blockers.push(
      'Google Routes API could not be reached from this server (network, quota or key restriction). No driving distance is displayed.',
    );
  }

  return {
    ...base,
    source,
    googleConnected,
    routesApiEnabled,
    legs,
    disclosure: googleConnected ? TRAVEL_DISCLOSURES.live : TRAVEL_DISCLOSURES.unavailable,
    blockers: [...new Set(blockers)],
  };
}

/**
 * Full detail for ONE hospital: alternatives, decoded polyline, deep link.
 * Used by the detail page, the map route preview and the assistant.
 */
export async function getRouteDetail(params: {
  origin: LatLng;
  hospital: Hospital;
  travelMode?: TravelMode;
  routingPreference?: RoutingPreference;
  selectedIndex?: number;
  language?: string;
  originSource?: OriginSource;
}): Promise<RouteDetail> {
  const travelMode = params.travelMode ?? 'DRIVE';
  const routingPreference = params.routingPreference ?? 'TRAFFIC_AWARE_OPTIMAL';
  const apiKey = getServerMapsKey();
  const geo = resolveHospitalGeo(params.hospital);
  const straightKm = Number(
    haversineKm(params.origin.lat, params.origin.lng, geo.lat, geo.lng).toFixed(2),
  );

  const unavailable = (error: string): RouteDetail => ({
    hospitalId: params.hospital.id,
    distanceKm: null,
    distanceMeters: null,
    etaMinutes: null,
    staticMinutes: null,
    trafficImpactMinutes: null,
    straightKm,
    source: 'unavailable',
    computedAt: null,
    error,
    disclosure: TRAVEL_DISCLOSURES.unavailable,
    geometry: [],
    alternatives: [],
    selectedIndex: 0,
    polylineSource: 'unavailable',
    navigateUrl: googleMapsNavigateUrl(params.origin, { lat: geo.lat, lng: geo.lng }, {
      travelMode: travelMode === 'TWO_WHEELER' ? 'two-wheeler' : 'driving',
      placeId: geo.placeId,
      destinationName: params.hospital.name,
    }),
  });

  if (!geo.valid) return unavailable('Hospital coordinate failed validation — refusing to route.');
  if (!apiKey) return unavailable('GOOGLE_MAPS_API_KEY is not configured on the server.');

  const result = await fetchRoutes({
    apiKey,
    origin: params.origin,
    destination: { lat: geo.lat, lng: geo.lng },
    travelMode,
    routingPreference,
    alternatives: true,
    languageCode: params.language ?? 'en-IN',
  });

  const selectedIndex = Math.max(0, Math.min(params.selectedIndex ?? 0, Math.max(0, result.routes.length - 1)));
  const selected = result.routes[selectedIndex];
  if (!result.ok || !selected) return unavailable(result.errorStatus ?? 'NO_ROUTE');

  const etaMinutes = Math.max(1, Math.round(selected.durationSeconds / 60));
  const staticMinutes = Math.max(1, Math.round(selected.staticDurationSeconds / 60));

  return {
    hospitalId: params.hospital.id,
    distanceKm: metersToDisplayKm(selected.distanceMeters),
    distanceMeters: selected.distanceMeters,
    etaMinutes,
    staticMinutes,
    trafficImpactMinutes: Math.max(0, etaMinutes - staticMinutes),
    straightKm,
    source: 'google-routes-api',
    computedAt: new Date().toISOString(),
    error: null,
    disclosure: TRAVEL_DISCLOSURES.live,
    geometry: decodePolyline(selected.encodedPolyline),
    alternatives: result.routes.map((r) => ({
      distanceKm: metersToDisplayKm(r.distanceMeters),
      etaMinutes: Math.max(1, Math.round(r.durationSeconds / 60)),
      description: r.description,
      labels: r.routeLabels,
    })),
    selectedIndex,
    polylineSource: selected.encodedPolyline ? 'google-encoded-polyline' : 'unavailable',
    navigateUrl: googleMapsNavigateUrl(params.origin, { lat: geo.lat, lng: geo.lng }, {
      travelMode: travelMode === 'TWO_WHEELER' ? 'two-wheeler' : 'driving',
      placeId: geo.placeId,
      destinationName: params.hospital.name,
    }),
  };
}

/** Attaches a travel leg onto a hospital record for UI components. */
export type WithTravel<T> = T & {
  distanceKm: number | null;
  roadKm: number | null;
  straightKm: number | null;
  etaMinutes: number | null;
  trafficImpactMinutes: number | null;
  travelSource: TravelSource;
  distanceKnown: boolean;
};

export function withTravel<T extends Hospital>(hospital: T, leg: TravelLeg | undefined): WithTravel<T> {
  return {
    ...hospital,
    distanceKm: leg?.distanceKm ?? null,
    roadKm: leg?.distanceKm ?? null,
    straightKm: leg?.straightKm ?? null,
    etaMinutes: leg?.etaMinutes ?? null,
    trafficImpactMinutes: leg?.trafficImpactMinutes ?? null,
    travelSource: leg?.source ?? 'unavailable',
    distanceKnown: typeof leg?.distanceKm === 'number',
  };
}

/** Diagnostic surface for /api/health and the developer status page. */
export const TRAVEL_API_SURFACE = {
  routesEndpoint: 'https://routes.googleapis.com/directions/v2:computeRoutes',
  matrixEndpoint: 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
  routesFieldMask: ROUTES_FIELD_MASK,
  matrixFieldMask: ROUTE_MATRIX_FIELD_MASK,
};
