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

export function formatDrivingKm(km: number | null | undefined, lang: Lang = 'en'): string | null {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  const u = DISTANCE_UNITS[lang] ?? DISTANCE_UNITS.en;
  if (km < 1) return `${Math.max(50, Math.round(km * 1000))} ${u.m}`;
  return `${km.toFixed(1)} ${u.km}`;
}

/**
 * Explicit label for direct-line measurements. NEVER used for road distance —
 * the "(straight line)" suffix makes the two numbers impossible to confuse.
 */
export function formatStraightLineKm(km: number | null | undefined, lang: Lang = 'en'): string | null {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  const u = DISTANCE_UNITS[lang] ?? DISTANCE_UNITS.en;
  const value =
    km < 1 ? `${Math.max(50, Math.round(km * 1000))} ${u.m}` : `${km.toFixed(1)} ${u.km}`;
  return `${value} (straight line)`;
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
  // No origin: search the destination pin rather than pretending we know where
  // the user is (the old behaviour silently assumed Delhi).
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
  // Google Maps accepts "lat,lng" or a place query as destination; including the
  // hospital name makes the drop-off pin unambiguous at large campuses.
  const destination = name ? `${toLat},${toLng} (${name})` : `${toLat},${toLng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${encodeURIComponent(
    destination,
  )}&travelmode=driving`;
}
