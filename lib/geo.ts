import { DISTANCE_UNITS, Lang } from './lang-meta';

/** Haversine straight-line distance in kilometres between two coordinates. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Deterministic road-network tortuosity approximation when an external routing
 * engine (Google Routes / OSRM) is not queried or unavailable.
 * Indian urban road networks average ~1.34x straight-line distance for short hops
 * and ~1.24x for inter-city highway corridors.
 */
export function estimateRoadDistanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const straight = haversineKm(aLat, aLng, bLat, bLng);
  if (straight < 0.05) return 0;
  const factor = straight <= 3 ? 1.38 : straight <= 15 ? 1.34 : straight <= 50 ? 1.29 : 1.24;
  return Number((straight * factor).toFixed(2));
}

export type TrafficLevel = 'low' | 'moderate' | 'heavy';

export interface EtaEstimate {
  straightKm: number;
  roadKm: number;
  baseMinutes: number;
  trafficMinutes: number;
  trafficLevel: TrafficLevel;
  source: 'live-api' | 'estimated-urban-model';
}

/**
 * Computes consistent driving distance and traffic-adjusted ETA.
 * Explicitly labels `source: 'estimated-urban-model'` so we NEVER fabricate
 * live Google traffic when an external routing API is not connected.
 * Accepts optional `istHour` (0–23) for deterministic testing.
 */
export function estimateTravelMetrics(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
  istHour?: number,
): EtaEstimate {
  const straightKm = Number(haversineKm(aLat, aLng, bLat, bLng).toFixed(2));
  const roadKm = estimateRoadDistanceKm(aLat, aLng, bLat, bLng);
  if (roadKm === 0) {
    return {
      straightKm: 0,
      roadKm: 0,
      baseMinutes: 1,
      trafficMinutes: 1,
      trafficLevel: 'low',
      source: 'estimated-urban-model',
    };
  }

  // Base free-flow speed in km/h depending on trip length (urban arterial vs highway)
  const freeFlowKmh = roadKm <= 5 ? 24 : roadKm <= 20 ? 30 : roadKm <= 60 ? 40 : 55;
  const baseMinutes = Math.max(2, Math.round((roadKm / freeFlowKmh) * 60 + 2));

  // Determine current IST hour if not passed
  const hour =
    typeof istHour === 'number'
      ? istHour
      : Math.floor(((Date.now() / 60000 + 330) % 1440) / 60);

  let multiplier = 1.15;
  let trafficLevel: TrafficLevel = 'moderate';
  if ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21)) {
    multiplier = roadKm <= 40 ? 1.45 : 1.28;
    trafficLevel = 'heavy';
  } else if (hour >= 22 || hour <= 6) {
    multiplier = 1.0;
    trafficLevel = 'low';
  } else {
    multiplier = 1.2;
    trafficLevel = 'moderate';
  }

  const trafficMinutes = Math.max(baseMinutes, Math.round(baseMinutes * multiplier));

  return {
    straightKm,
    roadKm,
    baseMinutes,
    trafficMinutes,
    trafficLevel,
    source: 'estimated-urban-model',
  };
}

export function formatDistance(km: number | null | undefined, lang: Lang = 'en'): string {
  const u = DISTANCE_UNITS[lang] ?? DISTANCE_UNITS.en;
  if (km === null || km === undefined || Number.isNaN(km)) return u.unknown;
  if (km < 1) return `${Math.max(50, Math.round(km * 1000))} ${u.m}`;
  if (km < 100) return `${km.toFixed(1)} ${u.km}`;
  return `${Math.round(km)} ${u.km}`;
}

export function formatDuration(minutes: number | null | undefined, lang: Lang = 'en'): string {
  const u = DISTANCE_UNITS[lang] ?? DISTANCE_UNITS.en;
  if (minutes === null || minutes === undefined || Number.isNaN(minutes) || minutes <= 0) return '–';
  if (minutes < 60) return `${Math.round(minutes)} ${u.min}`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hrs} ${u.hr} ${mins} ${u.min}` : `${hrs} ${u.hr}`;
}

/** Google Maps place search link — fallback when origin is unknown. */
export function directionsUrl(lat: number, lng: number, name?: string, origin?: { lat: number; lng: number } | null): string {
  if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
    return directionsFromToUrl(origin.lat, origin.lng, lat, lng, name);
  }
  const q = name ? `${lat},${lng} (${name})` : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Google Maps turn-by-turn directions from user's selected origin to destination. */
export function directionsFromToUrl(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  name?: string,
): string {
  void name;
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=driving`;
}
