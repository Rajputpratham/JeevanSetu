import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS, getHospitalById } from '@/data/hospitals';
import { resolveHospitalGeo } from '@/data/hospital-locations';
import { getRouteDetail, hasServerMapsKey } from '@/lib/travel';
import { getRoadRouteDetail, osrmBaseUrl } from '@/lib/osrm';
import { cached, travelCacheKey } from '@/lib/travel-cache';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 60_000;

/**
 * GET /api/route — driving route for ONE hospital.
 *
 * SOURCE LADDER (strict, never mixed):
 *   1. Google Routes API v2 — only when GOOGLE_MAPS_API_KEY is configured. It is
 *      the ONLY source allowed to claim live traffic.
 *   2. OSRM (key-free)      — routed road distance + estimated drive time. No
 *      live traffic, so the UI must label it "Estimated drive time".
 *   3. unavailable          — compact "Road route unavailable" fallback with the
 *      labelled straight-line distance. Never a guessed road figure.
 *
 * Query: fromLat, fromLng, hospitalId | toLat, toLng, lang
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const fromLat = parseFloat(sp.get('fromLat') ?? '');
  const fromLng = parseFloat(sp.get('fromLng') ?? '');

  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLng)) {
    return NextResponse.json({ error: 'A valid origin is required.', code: 'ORIGIN_REQUIRED' }, { status: 400 });
  }

  const requestedId = (sp.get('hospitalId') ?? '').trim();
  let hospital = getHospitalById(requestedId);
  const toLat = parseFloat(sp.get('toLat') ?? '');
  const toLng = parseFloat(sp.get('toLng') ?? '');

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

  if (Math.abs(fromLat) > 90 || Math.abs(fromLng) > 180) {
    return NextResponse.json({ error: 'Origin coordinates are out of range.', code: 'BAD_ORIGIN' }, { status: 400 });
  }

  const origin = { lat: fromLat, lng: fromLng };
  const hospitalMeta = {
    id: hospital.id,
    name: hospital.name,
    shortName: hospital.shortName,
    lat: geo.lat,
    lng: geo.lng,
    address: geo.address,
    coordinateConfidence: geo.confidence,
    coordinateNote: geo.note,
  };

  try {
    // ── 1. Google Routes (only when configured) ───────────────────────────────
    if (hasServerMapsKey()) {
      const detail = await cached(
        travelCacheKey(['route', fromLat, fromLng, hospital.id, 0]),
        CACHE_TTL_MS,
        () =>
          getRouteDetail({
            origin,
            hospital,
            selectedIndex: 0,
            language: sp.get('lang') === 'hi' ? 'hi-IN' : 'en-IN',
          }),
      );
      if (detail.source !== 'unavailable') {
        return NextResponse.json({
          ...detail,
          liveTraffic: true,
          provider: 'Google Routes API',
          googleConfigured: true,
          osrmConfigured: true,
          hospital: hospitalMeta,
          origin,
        });
      }
      // Google failed (quota/restriction/network) — fall through to OSRM rather
      // than showing a dead panel.
      const fallback = await cached(
        travelCacheKey(['osrm-route', fromLat, fromLng, hospital.id]),
        CACHE_TTL_MS,
        () => getRoadRouteDetail(origin, hospital),
      );
      return NextResponse.json({
        ...fallback,
        googleConfigured: true,
        googleError: detail.error,
        detailSource: 'google-failed',
        osrmConfigured: true,
        hospital: hospitalMeta,
        origin,
      });
    }

    // ── 2. Key-free OSRM ─────────────────────────────────────────────────────
    const road = await cached(
      travelCacheKey(['osrm-route', fromLat, fromLng, hospital.id]),
      CACHE_TTL_MS,
      () => getRoadRouteDetail(origin, hospital),
    );
    return NextResponse.json({
      ...road,
      // The old payload shape is still consumed by the map/alternatives UI.
      etaMinutes: road.minutes,
      staticMinutes: road.minutes,
      trafficImpactMinutes: null,
      errorStatus: road.error,
      disclosure: {
        text: road.error
          ? 'No road route could be computed right now, so no road distance or drive time is shown.'
          : 'Road distance and estimated drive time from OSRM. This is not live traffic.',
        live: false,
      },
      googleConfigured: false,
      osrmConfigured: true,
      osrmBaseUrl: osrmBaseUrl(),
      hospital: hospitalMeta,
      origin,
    });
  } catch (err) {
    console.error('[api/route]', err);
    return NextResponse.json({ error: 'Could not compute route.', code: 'ROUTE_FAILED' }, { status: 500 });
  }
}
