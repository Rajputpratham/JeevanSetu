import { estimateTravelMetrics, TrafficLevel } from './geo';

export interface RouteResult {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  roadKm: number;
  straightKm: number;
  baseMinutes: number;
  trafficMinutes: number;
  trafficLevel: TrafficLevel;
  geometry: [number, number][]; // [lat, lng] polyline points
  source: 'google-routes-live' | 'osrm-road-geometry' | 'estimated-urban-model';
  trafficDisclosure: string;
}

/**
 * Generates a realistic intermediate curved corridor line when external road
 * geometry is offline, clearly disclosed as an indicative corridor.
 */
function buildIndicativeCorridor(aLat: number, aLng: number, bLat: number, bLng: number): [number, number][] {
  const dLat = bLat - aLat;
  const dLng = bLng - aLng;
  // Slight deterministic mid-way bend along grid axes
  const mid1Lat = aLat + dLat * 0.35 + dLng * 0.04;
  const mid1Lng = aLng + dLng * 0.35 - dLat * 0.04;
  const mid2Lat = aLat + dLat * 0.72 - dLng * 0.03;
  const mid2Lng = aLng + dLng * 0.72 + dLat * 0.03;
  return [
    [aLat, aLng],
    [mid1Lat, mid1Lng],
    [mid2Lat, mid2Lng],
    [bLat, bLng],
  ];
}

export async function calculateRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<RouteResult> {
  const est = estimateTravelMetrics(fromLat, fromLng, toLat, toLng);
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;

  // 1. Live Google Directions API with departure_time=now (only if GOOGLE_MAPS_API_KEY is configured)
  if (googleKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&departure_time=now&key=${encodeURIComponent(googleKey)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const leg = data?.routes?.[0]?.legs?.[0];
        if (leg?.distance?.value && leg?.duration?.value) {
          const roadKm = Number((leg.distance.value / 1000).toFixed(2));
          const baseMinutes = Math.max(1, Math.round(leg.duration.value / 60));
          const trafficMinutes = leg.duration_in_traffic?.value
            ? Math.max(1, Math.round(leg.duration_in_traffic.value / 60))
            : baseMinutes;
          const ratio = trafficMinutes / Math.max(1, baseMinutes);
          const trafficLevel: TrafficLevel = ratio >= 1.3 ? 'heavy' : ratio >= 1.1 ? 'moderate' : 'low';
          const steps: [number, number][] = [[fromLat, fromLng]];
          for (const st of leg.steps ?? []) {
            if (st?.end_location) {
              steps.push([st.end_location.lat, st.end_location.lng]);
            }
          }
          return {
            origin: { lat: fromLat, lng: fromLng },
            destination: { lat: toLat, lng: toLng },
            roadKm,
            straightKm: est.straightKm,
            baseMinutes,
            trafficMinutes,
            trafficLevel,
            geometry: steps.length >= 2 ? steps : [[fromLat, fromLng], [toLat, toLng]],
            source: 'google-routes-live',
            trafficDisclosure: 'Live driving route & traffic ETA via Google Maps Platform.',
          };
        }
      }
    } catch {
      // Fall through cleanly
    }
  }

  // 2. Try OSRM public road router if reachable (provides actual OSM road geometry)
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      const route = data?.routes?.[0];
      if (route?.distance && route?.geometry?.coordinates) {
        const roadKm = Number((route.distance / 1000).toFixed(2));
        const baseMinutes = Math.max(2, Math.round(route.duration / 60));
        const mult = est.trafficLevel === 'heavy' ? 1.4 : est.trafficLevel === 'moderate' ? 1.2 : 1.0;
        const trafficMinutes = Math.max(baseMinutes, Math.round(baseMinutes * mult));
        const geometry: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
        return {
          origin: { lat: fromLat, lng: fromLng },
          destination: { lat: toLat, lng: toLng },
          roadKm,
          straightKm: est.straightKm,
          baseMinutes,
          trafficMinutes,
          trafficLevel: est.trafficLevel,
          geometry,
          source: 'osrm-road-geometry',
          trafficDisclosure:
            'Road distance via OpenStreetMap/OSRM. ETA includes time-of-day urban congestion modelling (no live Google traffic key configured).',
        };
      }
    }
  } catch {
    // Offline or sandboxed — use deterministic urban road & time-of-day model
  }

  // 3. Deterministic urban road & congestion model (honestly disclosed)
  return {
    origin: { lat: fromLat, lng: fromLng },
    destination: { lat: toLat, lng: toLng },
    roadKm: est.roadKm,
    straightKm: est.straightKm,
    baseMinutes: est.baseMinutes,
    trafficMinutes: est.trafficMinutes,
    trafficLevel: est.trafficLevel,
    geometry: buildIndicativeCorridor(fromLat, fromLng, toLat, toLng),
    source: 'estimated-urban-model',
    trafficDisclosure:
      'Estimated road distance & time-of-day urban traffic model (IST peak/off-peak). Connect GOOGLE_MAPS_API_KEY for live Google traffic & confirmed road incidents.',
  };
}
