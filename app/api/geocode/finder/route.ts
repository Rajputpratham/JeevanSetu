import { NextRequest, NextResponse } from 'next/server';
import { isLatLng, type LatLng } from '@/lib/distance';

export const dynamic = 'force-dynamic';

type Candidate = LatLng & { label: string };
const cache = new Map<string, { results: Candidate[]; expires: number }>();
const active = new Map<string, Promise<Candidate[]>>();
const LOCALITY_TYPES = new Set(['city', 'town', 'village', 'municipality', 'suburb', 'borough', 'county', 'city_district']);
let nextAllowedAt = 0;

async function search(endpoint: string, query: string, pincode: boolean): Promise<Candidate[]> {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    format: 'jsonv2', countrycodes: 'in', limit: '5', addressdetails: '1',
    ...(pincode ? { postalcode: query } : { q: query }),
  }).toString();
  const response = await fetch(url, {
    headers: {
      'User-Agent': `JeevanSetu-Hospital-Finder/1.0 (${process.env.NOMINATIM_CONTACT || 'https://github.com/Rajputpratham/JeevanSetu'})`,
    },
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  });
  if (response.status === 429) nextAllowedAt = Math.max(nextAllowedAt, Date.now() + 60_000);
  if (!response.ok) throw new Error('Geocoder unavailable');
  const raw: unknown = await response.json();
  if (!Array.isArray(raw)) throw new Error('Invalid geocoder response');
  const results: Candidate[] = [];
  for (const item of raw) {
    if (typeof item?.lat !== 'string' || !item.lat.trim() || typeof item.lon !== 'string' || !item.lon.trim() ||
      typeof item.display_name !== 'string' || !item.display_name.trim()) continue;
    if (pincode ? item.address?.postcode !== query : !LOCALITY_TYPES.has(item.addresstype)) continue;
    const candidate = { lat: Number(item.lat), lng: Number(item.lon), label: item.display_name };
    if (isLatLng(candidate) && !results.some((other) => other.lat === candidate.lat && other.lng === candidate.lng)) results.push(candidate);
  }
  return results;
}

/** Explicit finder submissions only; no autocomplete. One worker may call at most once per 1.1 s. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const query = typeof body?.query === 'string' ? body.query.trim().replace(/\s+/g, ' ').toLowerCase() : '';
  const pincode = /^[1-9]\d{5}$/.test(query);
  if (query.length < 2 || query.length > 100 || (/^[\d\s]+$/.test(query) && !pincode)) {
    return NextResponse.json({ error: 'Enter a city name or a valid 6-digit Indian pincode.' }, { status: 400 });
  }
  const endpoint = process.env.NOMINATIM_SEARCH_URL || (process.env.NODE_ENV !== 'production' && 'https://nominatim.openstreetmap.org/search');
  if (!endpoint) {
    return NextResponse.json({ error: 'Manual location search is not enabled on this deployment. Use browser location instead.' }, { status: 503 });
  }
  const saved = cache.get(query);
  if (saved && saved.expires > Date.now()) return NextResponse.json({ results: saved.results });
  let pending = active.get(query);
  if (!pending) {
    if (active.size || Date.now() < nextAllowedAt) {
      return NextResponse.json({ error: 'Location search is busy. Wait a moment and try again.' }, { status: 429, headers: { 'Retry-After': '2' } });
    }
    nextAllowedAt = Date.now() + 1100;
    pending = search(endpoint, query, pincode).then((results) => {
      cache.delete(query);
      cache.set(query, { results, expires: Date.now() + 24 * 60 * 60_000 });
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
      return results;
    }).finally(() => active.delete(query));
    active.set(query, pending);
  }
  try {
    return NextResponse.json({ results: await pending });
  } catch {
    return NextResponse.json({ error: 'Location search is temporarily unavailable. Try again later.' }, { status: 503 });
  }
}
