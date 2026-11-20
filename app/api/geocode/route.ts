import { NextRequest, NextResponse } from 'next/server';
import { searchIndianLocalities } from '@/data/localities';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export interface GeocodeCandidate {
  label: string;
  lat: number;
  lng: number;
  source: 'google' | 'nominatim' | 'indian-gazetteer';
  /** Optional Google place id, when returned. */
  placeId?: string | null;
  /** Approximate match (neighbourhood/centroid) rather than a precise address. */
  approximate?: boolean;
  postalCode?: string | null;
}

/** Only Indian postal codes are accepted as a "PIN code search". */
function normalisePincode(raw: string): string | null {
  const digits = raw.replace(/\s+/g, '');
  return /^[1-9][0-9]{5}$/.test(digits) ? digits : null;
}

/**
 * GET /api/geocode?q=&lang=
 *
 * Proxies Google Geocoding / OpenStreetMap Nominatim, both of which are billed
 * or fairness-limited upstream, so the route is rate limited per caller.
 */
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    'geocode',
    'Too many address searches. Please wait a moment before searching again.',
  );
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim();
  const lang = (sp.get('lang') ?? 'en').trim().slice(0, 5);

  if (q.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters.', results: [] }, { status: 400 });
  }

  const pincode = normalisePincode(q);

  const localMatches: GeocodeCandidate[] = searchIndianLocalities(pincode ?? q, 6).map((loc) => ({
    label: loc.label,
    lat: loc.lat,
    lng: loc.lng,
    source: 'indian-gazetteer' as const,
    approximate: true,
    postalCode: loc.pincode ?? null,
  }));

  const googleKey = process.env.GOOGLE_MAPS_API_KEY;

  // 1. Google Geocoding API (preferred — best India coverage).
  if (googleKey) {
    try {
      const query = pincode ? `${pincode}, India` : `${q}, India`;
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        query,
      )}&region=in&components=country:IN&language=${encodeURIComponent(lang)}&key=${encodeURIComponent(googleKey)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
          const googleResults: GeocodeCandidate[] = data.results
            .slice(0, 5)
            .map(
              (r: {
                formatted_address: string;
                place_id?: string;
                geometry: { location: { lat: number; lng: number }; location_type?: string };
                types?: string[];
              }) => ({
                label: r.formatted_address,
                lat: r.geometry.location.lat,
                lng: r.geometry.location.lng,
                source: 'google' as const,
                placeId: r.place_id ?? null,
                approximate: r.geometry.location_type !== 'ROOFTOP',
              }),
            );
          return NextResponse.json({
            count: googleResults.length,
            source: 'google',
            queryType: pincode ? 'pincode' : 'address',
            results: googleResults,
          });
        }
      }
    } catch {
      /* fall through */
    }
  }

  // 2. OpenStreetMap Nominatim fallback.
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=5&q=${encodeURIComponent(
      pincode ? `${pincode}, India` : q,
    )}`;
    const res = await fetch(nomUrl, {
      headers: {
        'Accept-Language': lang,
        'User-Agent': 'JeevanSetu-Healthcare-Platform/1.0 (https://www.jeevansetu.in)',
      },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (res.ok) {
      const data: { display_name: string; lat: string; lon: string; place_id?: number }[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const nomResults: GeocodeCandidate[] = data.map((d) => ({
          label: d.display_name.split(',').slice(0, 3).join(', '),
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
          source: 'nominatim' as const,
          approximate: true,
        }));
        const merged = [...localMatches.slice(0, 2), ...nomResults].filter(
          (item, idx, arr) =>
            arr.findIndex((o) => Math.abs(o.lat - item.lat) < 0.005 && Math.abs(o.lng - item.lng) < 0.005) === idx,
        );
        return NextResponse.json({
          count: merged.length,
          source: 'nominatim',
          queryType: pincode ? 'pincode' : 'address',
          results: merged.slice(0, 6),
        });
      }
    }
  } catch {
    /* offline / restricted network */
  }

  // 3. Verified Indian gazetteer (works offline).
  return NextResponse.json({
    count: localMatches.length,
    source: 'indian-gazetteer',
    queryType: pincode ? 'pincode' : 'address',
    note:
      localMatches.length === 0
        ? 'No matching Indian place found in the offline gazetteer. Add GOOGLE_MAPS_API_KEY for full address search, or pick a city.'
        : 'Offline gazetteer match — these are locality/centroid coordinates, not a rooftop address.',
    results: localMatches,
  });
}
