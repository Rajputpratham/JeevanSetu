/** Key-free driving estimates for the hospital finder; no live traffic. */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface Hospital {
  id: string;
  lat?: number | null;
  lng?: number | null;
}

export type DistanceResult = { id: string } & (
  | { km: number; minutes: number; source: 'road' }
  | { km: number; minutes: null; source: 'straight-line' }
  | { km: null; minutes: null; source: 'none' }
);

export function isLatLng(value: unknown): value is LatLng {
  if (typeof value !== 'object' || value === null) return false;
  const { lat, lng } = value as Partial<LatLng>;
  return typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function formatDistance(result?: DistanceResult): string {
  if (!result || result.source === 'none') return 'Distance unavailable';
  const km = `${result.km.toFixed(1)} km`;
  return result.source === 'road'
    ? `${km} · ${Math.round(result.minutes)} min drive`
    : `approx. ${km} (straight line)`;
}

const TTL = 15 * 60_000;
const REUSE_KM = 0.5;
const BATCH_SIZE = 99; // 100 total coordinates including the origin.
const BASE_URL = (process.env.NEXT_PUBLIC_OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/+$/, '');

type Destination = Hospital & LatLng;
type AtOrigin = { origin: LatLng; destination: LatLng };
type Entry = AtOrigin & { result: DistanceResult; expires: number };
type Pending = AtOrigin & { result: Promise<DistanceResult> };
const cache = new Map<string, Entry[]>();
const inFlight = new Map<string, Pending[]>();

function matches(entry: AtOrigin, origin: LatLng, destination: LatLng): boolean {
  return entry.destination.lat === destination.lat && entry.destination.lng === destination.lng &&
    haversineKm(entry.origin, origin) <= REUSE_KM;
}

function pruneExpired() {
  const now = Date.now();
  for (const [id, entries] of cache) {
    const fresh = entries.filter((entry) => entry.expires > now);
    if (fresh.length) cache.set(id, fresh);
    else cache.delete(id);
  }
}

/** Explicit retry bypasses a cached fallback, not a good route or an in-flight request. */
export function forgetDistanceFallback(origin: LatLng, hospital: Hospital) {
  if (!isLatLng(origin) || !isLatLng(hospital)) return;
  const entries = cache.get(hospital.id);
  if (entries) cache.set(hospital.id, entries.filter((entry) =>
    entry.result.source !== 'straight-line' || !matches(entry, origin, hospital)));
}

function nonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

async function fetchBatch(origin: LatLng, destinations: Destination[]): Promise<DistanceResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const coordinates = [origin, ...destinations].map(({ lng, lat }) => `${lng},${lat}`).join(';');
    const response = await fetch(`${BASE_URL}/table/v1/driving/${coordinates}?sources=0&annotations=distance,duration`, {
      signal: controller.signal,
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error('OSRM request failed');
    const body = await response.json();
    const row = (table: unknown): unknown[] | undefined => Array.isArray(table) && table.length === 1 &&
      Array.isArray(table[0]) && table[0].length === destinations.length + 1 ? table[0] : undefined;
    const distances = body?.code === 'Ok' ? row(body.distances) : undefined;
    const durations = body?.code === 'Ok' ? row(body.durations) : undefined;
    return destinations.map((hospital, i) => {
      // No destinations filter: column zero is the origin, not the first hospital.
      const meters = distances?.[i + 1];
      const seconds = durations?.[i + 1];
      return nonNegative(meters) && nonNegative(seconds)
        ? { id: hospital.id, km: meters / 1000, minutes: seconds / 60, source: 'road' }
        : straightLine(origin, hospital);
    });
  } catch {
    return destinations.map((hospital) => straightLine(origin, hospital));
  } finally {
    clearTimeout(timeout);
  }
}

function straightLine(origin: LatLng, hospital: Destination): DistanceResult {
  return { id: hospital.id, km: haversineKm(origin, hospital), minutes: null, source: 'straight-line' };
}

/** Returns one result per input, in input order, even across partial failures. */
export async function getDrivingDistances(origin: LatLng | null, hospitals: readonly Hospital[]): Promise<DistanceResult[]> {
  if (!isLatLng(origin)) return hospitals.map(({ id }) => ({ id, km: null, minutes: null, source: 'none' }));
  pruneExpired();
  const from = { lat: origin.lat, lng: origin.lng };
  const work = new Map<string, Destination>();
  const keyFor = ({ id, lat, lng }: Destination) => JSON.stringify([id, lat, lng]);
  const existing = (hospital: Destination) => inFlight.get(hospital.id)?.find((entry) => matches(entry, from, hospital));
  const cached = (hospital: Destination) => cache.get(hospital.id)?.find((entry) => matches(entry, from, hospital));
  for (const hospital of hospitals) {
    if (isLatLng(hospital) && !existing(hospital) && !cached(hospital)) {
      work.set(keyFor(hospital), { id: hospital.id, lat: hospital.lat, lng: hospital.lng });
    }
  }

  const needed = [...work.values()];
  for (let i = 0; i < needed.length; i += BATCH_SIZE) {
    const batch = needed.slice(i, i + BATCH_SIZE);
    const response = fetchBatch(from, batch);
    batch.forEach((hospital, index) => {
      const entry: Pending = {
        origin: from,
        destination: hospital,
        result: response.then((results) => {
          const result = results[index];
          const entries = cache.get(hospital.id) ?? [];
          cache.set(hospital.id, [{ ...entry, result, expires: Date.now() + TTL }, ...entries].slice(0, 4));
          return result;
        }).finally(() => {
          const remaining = inFlight.get(hospital.id)?.filter((other) => other !== entry);
          if (remaining?.length) inFlight.set(hospital.id, remaining);
          else inFlight.delete(hospital.id);
        }),
      };
      inFlight.set(hospital.id, [...(inFlight.get(hospital.id) ?? []), entry]);
    });
  }

  return Promise.all(hospitals.map((hospital): DistanceResult | Promise<DistanceResult> => {
    if (!isLatLng(hospital)) return { id: hospital.id, km: null, minutes: null, source: 'none' };
    return existing(hospital)?.result ?? cached(hospital)!.result;
  }));
}
