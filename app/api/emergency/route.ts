import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS } from '@/data/hospitals';
import { HELPLINES } from '@/data/helplines';
import { HELPLINE_HI } from '@/lib/i18n-data';
import { isValidLang } from '@/lib/lang-meta';
import { getTravelSnapshot } from '@/lib/travel';
import { cached, travelCacheKey } from '@/lib/travel-cache';
import { resolveHospitalGeo } from '@/data/hospital-locations';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 60_000;

/**
 * GET /api/emergency — 24×7 hospitals ranked by Google driving distance from the
 * caller's real origin. No modelled fallback: unknown stays unknown.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const langParam = sp.get('lang') ?? 'en';
    const lang = isValidLang(langParam) ? langParam : 'en';
    const latRaw = sp.get('lat');
    const lngRaw = sp.get('lng');

    // An emergency page must still work without a location: it lists every
    // verified 24×7 hospital with NO distance rather than assuming a city.
    let lat = latRaw === null ? null : parseFloat(latRaw);
    let lng = lngRaw === null ? null : parseFloat(lngRaw);
    const hasOrigin = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
    if (!hasOrigin) {
      lat = null;
      lng = null;
    }
    if ((latRaw !== null && !Number.isFinite(parseFloat(latRaw))) || (lngRaw !== null && !Number.isFinite(parseFloat(lngRaw)))) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const candidates = HOSPITALS.filter((h) => h.emergency === 'verified' || h.emergency === 'unverified');

    const snapshot = hasOrigin
      ? await cached(
          travelCacheKey(['emergency', lat, lng, candidates.map((h) => h.id).join('+')]),
          CACHE_TTL_MS,
          () => getTravelSnapshot({ origin: { lat: lat!, lng: lng! }, hospitals: candidates, language: 'en-IN' }),
        )
      : null;

    const emergencyHospitals = candidates
      .map((h) => {
        const leg = snapshot?.legs[h.id];
        const geo = resolveHospitalGeo(h);
        return {
          ...h,
          lat: geo.lat,
          lng: geo.lng,
          address: geo.address,
          distanceKm: leg?.distanceKm ?? null,
          roadKm: leg?.distanceKm ?? null,
          straightKm: leg?.straightKm ?? null,
          etaMinutes: leg?.etaMinutes ?? null,
          staticMinutes: leg?.staticMinutes ?? null,
          trafficImpactMinutes: leg?.trafficImpactMinutes ?? null,
          travelSource: leg?.source ?? 'unavailable',
          travelError: leg?.error ?? null,
        };
      })
      .sort((a, b) => {
        if (a.emergency !== b.emergency) return a.emergency === 'verified' ? -1 : 1;
        return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      });

    const helplines =
      lang === 'hi'
        ? HELPLINES.map((h) => ({
            number: h.number,
            label: HELPLINE_HI[h.number]?.label ?? h.label,
            detail: HELPLINE_HI[h.number]?.detail ?? h.detail,
          }))
        : HELPLINES;

    return NextResponse.json({
      helplines,
      count: emergencyHospitals.length,
      verifiedCount: emergencyHospitals.filter((h) => h.emergency === 'verified').length,
      hospitals: emergencyHospitals,
      originKnown: hasOrigin,
      distanceSource: snapshot?.source ?? 'unavailable',
      distanceDisclosure: snapshot?.disclosure ?? null,
      travelComputedAt: snapshot?.computedAt ?? null,
      blockers: snapshot?.blockers ?? ['No starting point provided — distances are not calculated.'],
      incidentFeedStatus: 'unavailable-no-authorised-feed',
      incidentNotice:
        'Live road-accident / road-closure incident feeds are not connected (no authorised municipal traffic feed configured). JeevanSetu never invents road incident alerts.',
      notice:
        lang === 'hi'
          ? 'यदि कोई गंभीर रूप से बीमार या घायल है, तो पहले 112 पर कॉल करें और ऑपरेटर से बात करें — इस वेबसाइट को देखने के लिए इलाज में देरी न करें।'
          : 'If someone is seriously ill or injured, call 112 FIRST and speak to the operator — do not delay medical care to browse this website.',
    });
  } catch (err) {
    console.error('[api/emergency]', err);
    return NextResponse.json({ error: 'Could not load emergency data. If this is an emergency, call 112 now.' }, { status: 500 });
  }
}
