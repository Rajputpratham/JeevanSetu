/** Haversine distance in kilometres between two coordinates. */
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

export function formatDistance(km: number | null, lang: 'en' | 'hi' = 'en'): string {
  if (km === null || Number.isNaN(km)) return lang === 'hi' ? 'दूरी अज्ञात' : 'Distance unknown';
  if (km < 1) return `${Math.round(km * 1000)} ${lang === 'hi' ? 'मी' : 'm'}`;
  if (km < 100) return `${km.toFixed(1)} ${lang === 'hi' ? 'किमी' : 'km'}`;
  return `${Math.round(km)} ${lang === 'hi' ? 'किमी' : 'km'}`;
}

/** Google Maps directions link — opens in the user's own maps app/browser. */
export function directionsUrl(lat: number, lng: number, name?: string): string {
  const q = name ? `${lat},${lng} (${name})` : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Directions from one place to another. */
export function directionsFromToUrl(fromLat: number, fromLng: number, toLat: number, toLng: number, name?: string): string {
  const dest = name ? `${toLat},${toLng} (${name})` : `${toLat},${toLng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${encodeURIComponent(dest)}`;
}
