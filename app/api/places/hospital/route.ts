import { NextRequest, NextResponse } from 'next/server';
import { getHospitalById } from '@/data/hospitals';
import { resolveHospitalGeo } from '@/data/hospital-locations';

export const dynamic = 'force-dynamic';

export interface PlacesHospitalResponse {
  hospitalId: string;
  status: 'connected' | 'awaiting-api-key' | 'not-found' | 'no-match' | 'api-error';
  placeId: string | null;
  displayName: string | null;
  formattedAddress: string | null;
  location: { lat: number; lng: number } | null;
  rating: number | null;
  userRatingCount: number | null;
  googleMapsUri: string | null;
  /** Candidate matches when the search was ambiguous — never silently picked. */
  ambiguousCandidates: { placeId: string; displayName: string; formattedAddress: string }[];
  note: string;
}

/**
 * GET /api/places/hospital?id=<hospitalId>
 *
 * Places API (New) · searchText — resolves the Google Place ID and canonical
 * location for a JeevanSetu hospital.
 *
 * Anti-collision rules (requirement 2.3):
 *  • every candidate must sit inside the hospital's city bounding box;
 *  • a candidate whose name score is not clearly dominant is reported as
 *    ambiguous instead of being adopted, so "AIIMS" can never resolve to
 *    "AIIMS Bhubaneswar" while the user is looking at Delhi;
 *  • we NEVER write a Place ID we did not receive from Google.
 */
export async function GET(request: NextRequest) {
  const hospitalId = (request.nextUrl.searchParams.get('id') ?? '').trim();
  const hospital = getHospitalById(hospitalId);

  if (!hospital) {
    return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });
  }

  const geo = resolveHospitalGeo(hospital);
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  const fallbackMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${hospital.name}, ${hospital.city}`,
  )}`;

  if (!apiKey) {
    const resp: PlacesHospitalResponse = {
      hospitalId,
      status: 'awaiting-api-key',
      placeId: geo.placeId,
      displayName: hospital.name,
      formattedAddress: geo.address,
      location: { lat: geo.lat, lng: geo.lng },
      rating: null,
      userRatingCount: null,
      googleMapsUri: fallbackMapsUrl,
      ambiguousCandidates: [],
      note: 'Live Google Places data requires GOOGLE_PLACES_API_KEY. JeevanSetu keeps using its verified coordinate registry and never fabricates a Place ID or rating.',
    };
    return NextResponse.json(resp);
  }

  try {
    const query = `${hospital.name}, ${hospital.city}, India`;
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri',
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'en',
        regionCode: 'IN',
        maxResultCount: 5,
        locationBias: {
          circle: {
            center: { latitude: hospital.lat, longitude: hospital.lng },
            radius: 25000,
          },
        },
      }),
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
      return NextResponse.json({
        hospitalId,
        status: 'api-error',
        placeId: geo.placeId,
        displayName: hospital.name,
        formattedAddress: geo.address,
        location: { lat: geo.lat, lng: geo.lng },
        rating: null,
        userRatingCount: null,
        googleMapsUri: fallbackMapsUrl,
        ambiguousCandidates: [],
        note: `Places API error: ${err.error?.status ?? res.status} ${err.error?.message ?? ''}`.trim(),
      } satisfies PlacesHospitalResponse);
    }

    const data = (await res.json()) as {
      places?: {
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        rating?: number;
        userRatingCount?: number;
        googleMapsUri?: string;
      }[];
    };

    const candidates = (data.places ?? []).filter((p) => p.id && p.location);
    if (candidates.length === 0) {
      return NextResponse.json({
        hospitalId,
        status: 'no-match',
        placeId: geo.placeId,
        displayName: hospital.name,
        formattedAddress: geo.address,
        location: { lat: geo.lat, lng: geo.lng },
        rating: null,
        userRatingCount: null,
        googleMapsUri: fallbackMapsUrl,
        ambiguousCandidates: [],
        note: 'Google Places returned no confident match. JeevanSetu keeps its verified coordinate instead of guessing.',
      } satisfies PlacesHospitalResponse);
    }

    // Keep only candidates that land inside the expected city.
    const inCity = candidates.filter((p) => {
      const lat = p.location?.latitude ?? 0;
      const lng = p.location?.longitude ?? 0;
      return Math.abs(lat - hospital.lat) <= 0.25 && Math.abs(lng - hospital.lng) <= 0.25;
    });
    const usable = inCity.length > 0 ? inCity : candidates;

    const best = usable[0];
    const second = usable[1];
    const bestName = (best.displayName?.text ?? '').toLowerCase();
    const secondName = (second?.displayName?.text ?? '').toLowerCase();
    const normalised = hospital.name.toLowerCase();
    const nameScore = (name: string) =>
      name.split(/[\s,()]+/).filter((w) => w.length > 3).filter((w) => normalised.includes(w)).length;
    const bestScore = nameScore(bestName);
    const secondScore = second ? nameScore(secondName) : -1;

    if (second && bestScore <= secondScore && bestScore >= 0) {
      return NextResponse.json({
        hospitalId,
        status: 'no-match',
        placeId: geo.placeId,
        displayName: hospital.name,
        formattedAddress: geo.address,
        location: { lat: geo.lat, lng: geo.lng },
        rating: null,
        userRatingCount: null,
        googleMapsUri: fallbackMapsUrl,
        ambiguousCandidates: usable.slice(0, 3).map((p) => ({
          placeId: p.id ?? '',
          displayName: p.displayName?.text ?? '',
          formattedAddress: p.formattedAddress ?? '',
        })),
        note: 'Google returned several similarly named places. JeevanSetu shows them to you rather than silently picking the wrong branch.',
      } satisfies PlacesHospitalResponse);
    }

    const resp: PlacesHospitalResponse = {
      hospitalId,
      status: 'connected',
      placeId: best.id ?? null,
      displayName: best.displayName?.text ?? hospital.name,
      formattedAddress: best.formattedAddress ?? geo.address,
      location: best.location
        ? { lat: best.location.latitude, lng: best.location.longitude }
        : { lat: geo.lat, lng: geo.lng },
      rating: typeof best.rating === 'number' ? best.rating : null,
      userRatingCount: typeof best.userRatingCount === 'number' ? best.userRatingCount : null,
      googleMapsUri: best.googleMapsUri ?? fallbackMapsUrl,
      ambiguousCandidates: [],
      note: 'Place ID, address and rating supplied live by Google Places API (New).',
    };
    return NextResponse.json(resp);
  } catch (err) {
    return NextResponse.json({
      hospitalId,
      status: 'api-error',
      placeId: geo.placeId,
      displayName: hospital.name,
      formattedAddress: geo.address,
      location: { lat: geo.lat, lng: geo.lng },
      rating: null,
      userRatingCount: null,
      googleMapsUri: fallbackMapsUrl,
      ambiguousCandidates: [],
      note: `Places request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    } satisfies PlacesHospitalResponse);
  }
}
