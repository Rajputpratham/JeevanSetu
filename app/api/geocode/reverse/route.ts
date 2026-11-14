import { NextRequest, NextResponse } from 'next/server';
import { INDIAN_LOCALITIES } from '@/data/localities';

export const dynamic = 'force-dynamic';

interface ReverseResult {
  label: string;
  lat: number;
  lng: number;
  source: 'google-geocoding' | 'nominatim' | 'nearest-gazetteer' | 'coordinates-only';
  /** Set when no human-readable address could be resolved. */
  degraded: boolean;
}

/** Haversine in metres — local copy so this route has no UI dependencies. */
function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Number((R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))).toFixed(0));
}

/**
 * GET /api/geocode/reverse?lat=&lng=&lang=
 *
 * Turns a device fix into a human-readable origin label. Never invents an
 * address: if every provider fails we return the raw coordinates flagged
 * `degraded: true`, and the UI keeps saying "coordinates only".
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = parseFloat(sp.get('lat') ?? '');
  const lng = parseFloat(sp.get('lng') ?? '');
  const lang = (sp.get('lang') ?? 'en').slice(0, 5);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'Valid lat and lng are required.', code: 'BAD_COORDS' }, { status: 400 });
  }

  const coordinatesOnly: ReverseResult = {
    label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    lat,
    lng,
    source: 'coordinates-only',
    degraded: true,
  };

  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

  // 1. Google Geocoding API (most accurate for Indian addresses).
  if (googleKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&region=in&language=${encodeURIComponent(lang)}&key=${encodeURIComponent(googleKey)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const first = data?.results?.[0];
        if (data?.status === 'OK' && first?.formatted_address) {
          return NextResponse.json({
            label: first.formatted_address,
            lat,
            lng,
            source: 'google-geocoding',
            degraded: false,
            placeId: first.place_id ?? null,
          });
        }
      }
    } catch {
      /* fall through */
    }
  }

  // 2. OpenStreetMap Nominatim (no key required).
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': lang,
        'User-Agent': 'JeevanSetu-Healthcare-Platform/1.0 (https://www.jeevansetu.in)',
      },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as { display_name?: string };
      if (data?.display_name) {
        return NextResponse.json({
          label: data.display_name.split(',').slice(0, 3).join(', '),
          lat,
          lng,
          source: 'nominatim',
          degraded: false,
        });
      }
    }
  } catch {
    /* fall through */
  }

  // 3. Nearest known Indian locality (explicitly labelled as an approximation).
  let nearest: { label: string; distance: number } | null = null;
  for (const loc of INDIAN_LOCALITIES) {
    const d = metresBetween(lat, lng, loc.lat, loc.lng);
    if (!nearest || d < nearest.distance) nearest = { label: loc.label, distance: d };
  }
  if (nearest && nearest.distance <= 15000) {
    return NextResponse.json({
      label: `Near ${nearest.label} (~${Math.round(nearest.distance / 1000)} km)`,
      lat,
      lng,
      source: 'nearest-gazetteer',
      degraded: false,
      approximate: true,
    });
  }

  // 4. Honest degradation — we do not fabricate an address.
  return NextResponse.json({ ...coordinatesOnly, reverseGeocodeFailed: true });
}
