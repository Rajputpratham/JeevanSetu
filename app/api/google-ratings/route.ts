import { NextRequest, NextResponse } from 'next/server';
import { getHospitalById } from '@/data/hospitals';

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

export async function GET(request: NextRequest) {
  const hospitalId = (request.nextUrl.searchParams.get('hospitalId') ?? '').trim();
  const hospital = getHospitalById(hospitalId);

  if (!hospital) {
    return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });
  }

  const fallbackMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${hospital.name}, ${hospital.city}`,
  )}`;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  //Mandatory Engineering Rule #5 & #15: Never fabricate Google scores or claim external APIs are connected when key is missing
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

  try {
    // 1. Find Place from Text
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
      `${hospital.name} ${hospital.city}`,
    )}&inputtype=textquery&fields=place_id&locationbias=point:${hospital.lat},${hospital.lng}&key=${encodeURIComponent(apiKey)}`;
    const findRes = await fetch(findUrl, { signal: AbortSignal.timeout(4000) });
    const findData = await findRes.json();
    const placeId = findData?.candidates?.[0]?.place_id;

    if (!placeId) {
      const resp: GoogleRatingResponse = {
        hospitalId,
        status: 'not-found',
        rating: null,
        userRatingsTotal: null,
        googleMapsUrl: fallbackMapsUrl,
        reviews: [],
        attribution: 'Powered by Google',
        note: 'No exact Google Place match returned for this hospital.',
      };
      return NextResponse.json(resp);
    }

    // 2. Place Details for permitted rating, user_ratings_total, url, reviews
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId,
    )}&fields=rating,user_ratings_total,url,reviews&key=${encodeURIComponent(apiKey)}`;
    const detRes = await fetch(detailsUrl, { signal: AbortSignal.timeout(4000) });
    const detData = await detRes.json();
    const result = detData?.result;

    if (!result) {
      throw new Error('Empty place details');
    }

    const resp: GoogleRatingResponse = {
      hospitalId,
      status: 'connected',
      rating: typeof result.rating === 'number' ? result.rating : null,
      userRatingsTotal: typeof result.user_ratings_total === 'number' ? result.user_ratings_total : null,
      googleMapsUrl: result.url || fallbackMapsUrl,
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
    return NextResponse.json(resp);
  } catch (err) {
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
