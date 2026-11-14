/**
 * @deprecated Legacy routing module — kept ONLY so older imports do not break.
 *
 * It used to return a modelled "road distance" (straight-line × tortuosity) and a
 * synthetic corridor polyline, plus an OSRM fallback. That is precisely the
 * source of the conflicting 1 km / 32 km numbers this project set out to remove,
 * so nothing in the product calls it any more:
 *
 *   • driving distance + ETA + geometry → `lib/travel.ts` (Google Routes API)
 *   • the route API served to clients     → `app/api/route/route.ts`
 *
 * `calculateRoute` therefore does the only honest thing left: it reports the
 * route as unavailable instead of inventing one.
 */

import { haversineKm } from './geo';

/** Google's own traffic bands, kept only for type compatibility. */
export type TrafficLevel = 'low' | 'moderate' | 'heavy';

export interface RouteResult {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  /** Always null: a modelled value must never be presented as a road distance. */
  roadKm: null;
  /** Straight-line distance, clearly a different measurement. */
  straightKm: number;
  baseMinutes: null;
  trafficMinutes: null;
  trafficLevel: TrafficLevel | null;
  geometry: [number, number][];
  source: 'unavailable';
  trafficDisclosure: string;
}

export async function calculateRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<RouteResult> {
  return {
    origin: { lat: fromLat, lng: fromLng },
    destination: { lat: toLat, lng: toLng },
    roadKm: null,
    straightKm: Number(haversineKm(fromLat, fromLng, toLat, toLng).toFixed(2)),
    baseMinutes: null,
    trafficMinutes: null,
    trafficLevel: null,
    geometry: [],
    source: 'unavailable',
    trafficDisclosure:
      'Legacy routing module retired: driving distance and ETA come only from the Google Routes API (lib/travel.ts). No estimate is produced here.',
  };
}
