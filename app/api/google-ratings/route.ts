import { NextRequest, NextResponse } from 'next/server';
import { getHospitalById } from '@/data/hospitals';
import { cachedRating, readCachedRating } from '@/lib/google-ratings-cache';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export interface GoogleRatingResponse {
  hospitalId: string;
  status: 'connected' | 'awaiting-api-key' | 'not-found' | 'api-error';
  rating: number | null;
  userRatingsTotal: number | null;
  googleMapsUrl: string;
  reviews: {
    authorName: string;
    rating: number;
    relativeTimeDescription: string;
    text: string;
  }[];
  attribution: string;
  note: string;
}

/**
 * Google Places ratings change slowly and are billed per call, so a successful
 * lookup is cached server-side per hospital for 10 minutes
 * (`lib/google-ratings-cache.ts`). Repeated page loads (hospital detail → back →
 * detail) then cost nothing, while a fresh facility page still gets a real
 * Google answer within minutes. Transient failures are never cached.
 */

interface LookupParams {
  hospitalId: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  apiKey: string;
  fallbackMapsUrl: string;
}

/**
 * Performs the two-step Places lookup (Find Place → Place Details).
 *
 * Throws on transport/HTTP/API-status failures so the caller can report an
 * honest `api-error`; "no match" is a valid, cacheable answer and is returned.
 */
async function lookupGoogleRating(params: LookupParams): Promise<GoogleRatingResponse> {
  const { hospitalId, name, city, lat, lng, apiKey, fallbackMapsUrl } = params;

  // 1. Find Place from Text
  const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
    `${name} ${city}`,
  )}&inputtype=textquery&fields=place_id&locationbias=point:${lat},${lng}&key=${encodeURIComponent(apiKey)}`;
  const findRes = await fetch(findUrl, { signal: AbortSignal.timeout(4000) });
  if (!findRes.ok) {
    throw new Error(`Place search failed with HTTP ${findRes.status}`);
  }
  const findData = await findRes.json().catch(() => null);
  if (!findData || typeof findData !== 'object') {
    throw new Error('Place search returned an unreadable response');
  }

  // Google reports quota/permission problems with HTTP 200 + a status field.
  const findStatus: string | null = typeof findData.status === 'string' ? findData.status : null;
  if (findStatus && findStatus !== 'OK' && findStatus !== 'ZERO_RESULTS') {
    throw new Error(`Place search rejected with status ${findStatus}`);
  }

  const placeId: string | undefined = findData?.candidates?.[0]?.place_id;

  if (!placeId) {
    return {
      hospitalId,
      status: 'not-found',
      rating: null,
      userRatingsTotal: null,
      googleMapsUrl: fallbackMapsUrl,
      reviews: [],
      attribution: 'Powered by Google',
      note: 'No exact Google Place match returned for this hospital.',
    };
  }

  // 2. Place Details for permitted rating, user_ratings_total, url, reviews
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId,
  )}&fields=rating,user_ratings_total,url,reviews&key=${encodeURIComponent(apiKey)}`;
  const detRes = await fetch(detailsUrl, { signal: AbortSignal.timeout(4000) });
  if (!detRes.ok) {
    throw new Error(`Place details failed with HTTP ${detRes.status}`);
  }
  const detData = await detRes.json().catch(() => null);
  if (!detData || typeof detData !== 'object') {
    throw new Error('Place details returned an unreadable response');
  }
  const detStatus: string | null = typeof detData.status === 'string' ? detData.status : null;
  if (detStatus && detStatus !== 'OK') {
    throw new Error(`Place details rejected with status ${detStatus}`);
  }

  const result = detData?.result;
  if (!result) {
    throw new Error('Empty place details');
  }

  return {
    hospitalId,
    status: 'connected',
    rating: typeof result.rating === 'number' ? result.rating : null,
    userRatingsTotal: typeof result.user_ratings_total === 'number' ? result.user_ratings_total : null,
    googleMapsUrl: typeof result.url === 'string' && result.url ? result.url : fallbackMapsUrl,
    reviews: Array.isArray(result.reviews)
      ? result.reviews.slice(0, 3).map((rv: { author_name?: string; rating?: number; relative_time_description?: string; text?: string }) => ({
          authorName: rv.author_name ?? 'Google User',
          rating: rv.rating ?? 0,
          relativeTimeDescription: rv.relative_time_description ?? '',
          text: rv.text ?? '',
        }))
      : [],
    attribution: 'Powered by Google',
    note: 'Live rating and review excerpts sourced from Google Places API.',
  };
}

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    'googleRatings',
    'Too many rating lookups. Please wait a moment before retrying.',
  );
  if (limited) return limited;

  const hospitalId = (request.nextUrl.searchParams.get('hospitalId') ?? '').trim();
  const hospital = getHospitalById(hospitalId);

  if (!hospital) {
    return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });
  }

  const fallbackMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${hospital.name}, ${hospital.city}`,
  )}`;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  // Mandatory Engineering Rule #5 & #15: Never fabricate Google scores or claim
  // external APIs are connected when the key is missing. This state is not
  // cached — configuring the key must take effect immediately.
  if (!apiKey) {
    const resp: GoogleRatingResponse = {
      hospitalId,
      status: 'awaiting-api-key',
      rating: null,
      userRatingsTotal: null,
      googleMapsUrl: fallbackMapsUrl,
      reviews: [],
      attribution: 'Google Maps',
      note: 'Live Google Places rating requires GOOGLE_PLACES_API_KEY. JeevanSetu never fabricates Google ratings — tap "View on Google Maps" to check live public reviews directly on Google.',
    };
    return NextResponse.json(resp);
  }

  const hit = readCachedRating<GoogleRatingResponse>(hospitalId);
  if (hit) {
    return NextResponse.json(hit, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    const resp = await cachedRating(hospitalId, () =>
      lookupGoogleRating({
        hospitalId,
        name: hospital.name,
        city: hospital.city,
        lat: hospital.lat,
        lng: hospital.lng,
        apiKey,
        fallbackMapsUrl,
      }),
    );
    return NextResponse.json(resp, { headers: { 'X-Cache': 'MISS' } });
  } catch (err) {
    // Transient upstream failures are never cached, so the next page load
    // retries Google instead of pinning a stale error for 10 minutes.
    console.error('[api/google-ratings]', err);
    const resp: GoogleRatingResponse = {
      hospitalId,
      status: 'api-error',
      rating: null,
      userRatingsTotal: null,
      googleMapsUrl: fallbackMapsUrl,
      reviews: [],
      attribution: 'Google Maps',
      note: 'Google Places API could not be reached right now. Open Google Maps directly to view current public ratings.',
    };
    return NextResponse.json(resp);
  }
}
