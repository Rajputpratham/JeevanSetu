import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS, getHospitalById } from '@/data/hospitals';
import { resolveHospitalGeo } from '@/data/hospital-locations';
import { getRouteDetail } from '@/lib/travel';
import { cached, travelCacheKey } from '@/lib/travel-cache';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 60_000;

/**
 * GET /api/route — full driving route for ONE hospital.
 *
 * Source of truth: Google Routes API v2. Query by stable hospital id (preferred)
 * or raw coordinates. Nothing is approximated when Google is unavailable.
 *
 * Query: fromLat, fromLng, hospitalId | toLat, toLng, alt (route index), lang
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const fromLat = parseFloat(sp.get('fromLat') ?? '');
  const fromLng = parseFloat(sp.get('fromLng') ?? '');
  const altIndex = parseInt(sp.get('alt') ?? '0', 10);

  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLng)) {
    return NextResponse.json({ error: 'A valid origin is required.', code: 'ORIGIN_REQUIRED' }, { status: 400 });
  }

  const requestedId = (sp.get('hospitalId') ?? '').trim();
  let hospital = getHospitalById(requestedId);
  let toLat = parseFloat(sp.get('toLat') ?? '');
  let toLng = parseFloat(sp.get('toLng') ?? '');

  if (!hospital) {
    // An explicit but unknown hospitalId is a client bug, not a request for
    // "somewhere else" — never route to a different hospital.
    if (requestedId && !Number.isFinite(parseFloat(sp.get('toLat') ?? ''))) {
      return NextResponse.json(
        { error: `Unknown hospitalId "${requestedId}".`, code: 'UNKNOWN_HOSPITAL' },
        { status: 404 },
      );
    }
    if (!Number.isFinite(toLat) || !Number.isFinite(toLng)) {
      return NextResponse.json(
        {
          error: 'Provide a known hospitalId, or valid destination coordinates (toLat, toLng).',
          code: 'DESTINATION_REQUIRED',
        },
        { status: 400 },
      );
    }
    // A raw destination point still needs validation against India bounds.
    const nearest = HOSPITALS.reduce(
      (best, h) => {
        const geo = resolveHospitalGeo(h);
        const d = (geo.lat - toLat) ** 2 + (geo.lng - toLng) ** 2;
        return d < best.d ? { d, h } : best;
      },
      { d: Number.POSITIVE_INFINITY, h: HOSPITALS[0] },
    );
    if (nearest.d > 1) {
      return NextResponse.json(
        {
          error:
            'Destination coordinates are not linked to a JeevanSetu hospital and are outside the validated dataset. Choose a hospital from the list instead.',
          code: 'UNVALIDATED_DESTINATION',
        },
        { status: 422 },
      );
    }
    hospital = nearest.h;
  }

  const geo = resolveHospitalGeo(hospital);
  toLat = geo.lat;
  toLng = geo.lng;

  if (Math.abs(fromLat) > 90 || Math.abs(fromLng) > 180) {
    return NextResponse.json({ error: 'Origin coordinates are out of range.', code: 'BAD_ORIGIN' }, { status: 400 });
  }

  try {
    const detail = await cached(
      travelCacheKey(['route', fromLat, fromLng, hospital.id, altIndex]),
      CACHE_TTL_MS,
      () =>
        getRouteDetail({
          origin: { lat: fromLat, lng: fromLng },
          hospital,
          selectedIndex: Number.isFinite(altIndex) ? altIndex : 0,
          language: sp.get('lang') === 'hi' ? 'hi-IN' : 'en-IN',
        }),
    );

    return NextResponse.json({
      ...detail,
      hospital: {
        id: hospital.id,
        name: hospital.name,
        shortName: hospital.shortName,
        lat: geo.lat,
        lng: geo.lng,
        address: geo.address,
        coordinateConfidence: geo.confidence,
        coordinateNote: geo.note,
      },
      origin: { lat: fromLat, lng: fromLng },
    });
  } catch (err) {
    console.error('[api/route]', err);
    return NextResponse.json({ error: 'Could not compute route.', code: 'ROUTE_FAILED' }, { status: 500 });
  }
}
