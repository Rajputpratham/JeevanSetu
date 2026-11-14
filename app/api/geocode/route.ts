import { NextRequest, NextResponse } from 'next/server';
import { searchIndianLocalities } from '@/data/localities';

export const dynamic = 'force-dynamic';

export interface GeocodeCandidate {
  label: string;
  lat: number;
  lng: number;
  source: 'google' | 'nominatim' | 'indian-gazetteer';
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim();
  const lang = (sp.get('lang') ?? 'en').trim();

  if (q.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters.', results: [] }, { status: 400 });
  }

  const localMatches: GeocodeCandidate[] = searchIndianLocalities(q, 6).map((loc) => ({
    label: loc.label,
    lat: loc.lat,
    lng: loc.lng,
    source: 'indian-gazetteer',
  }));

  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

  // 1. Try Google Geocoding API if configured
  if (googleKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        `${q}, India`,
      )}&region=in&language=${encodeURIComponent(lang)}&key=${encodeURIComponent(googleKey)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
          const googleResults: GeocodeCandidate[] = data.results.slice(0, 5).map((r: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }) => ({
            label: r.formatted_address,
            lat: r.geometry.location.lat,
            lng: r.geometry.location.lng,
            source: 'google',
          }));
          return NextResponse.json({ count: googleResults.length, source: 'google', results: googleResults });
        }
      }
    } catch {
      // Fall through to Nominatim / Gazetteer
    }
  }

  // 2. Try OpenStreetMap Nominatim with short timeout
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=5&q=${encodeURIComponent(q)}`;
    const res = await fetch(nomUrl, {
      headers: {
        'Accept-Language': lang,
        'User-Agent': 'JeevanSetu-Healthcare-Platform/1.0 (https://www.jeevansetu.in)',
      },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data: { display_name: string; lat: string; lon: string }[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const nomResults: GeocodeCandidate[] = data.map((d) => ({
          label: d.display_name.split(',').slice(0, 3).join(', '),
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
          source: 'nominatim',
        }));
        // Merge top local match first if exact locality match exists (e.g. Pusa Road)
        const merged = [...localMatches.slice(0, 2), ...nomResults].filter(
          (item, idx, arr) =>
            arr.findIndex((o) => Math.abs(o.lat - item.lat) < 0.005 && Math.abs(o.lng - item.lng) < 0.005) === idx,
        );
        return NextResponse.json({ count: merged.length, source: 'nominatim', results: merged.slice(0, 6) });
      }
    }
  } catch {
    // Offline or restricted network — fall back cleanly to verified Indian gazetteer
  }

  // 3. Verified Indian Gazetteer fallback
  return NextResponse.json({
    count: localMatches.length,
    source: 'indian-gazetteer',
    results: localMatches,
  });
}
