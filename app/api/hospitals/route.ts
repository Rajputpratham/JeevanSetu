import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS } from '@/data/hospitals';
import { HospitalType } from '@/data/types';
import { CITY_HI, FACILITY_HI, SPECIALITY_HI, STATE_HI } from '@/lib/i18n-data';
import { computeCommunityScore, getAllReviews } from '@/lib/ratings';
import { isValidLang } from '@/lib/lang-meta';
import { getTravelSnapshot } from '@/lib/travel';
import { cached, travelCacheKey } from '@/lib/travel-cache';
import { resolveHospitalGeo } from '@/data/hospital-locations';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 60_000;

/**
 * GET /api/hospitals
 *
 * Distances come exclusively from the central travel service (Google Routes
 * API). There is no modelled/tortuosity fallback: if Google is unavailable the
 * hospital is returned with `distanceKm: null` and the response carries
 * `distanceSource: 'unavailable'` so the UI can say so instead of guessing.
 *
 * `lat`/`lng` are optional as a pair. Without them we skip the routing provider.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const latRaw = sp.get('lat');
    const lngRaw = sp.get('lng');

    const hasOrigin = latRaw !== null || lngRaw !== null;
    const lat = Number(latRaw), lng = Number(lngRaw);
    if (hasOrigin && (!latRaw?.trim() || !lngRaw?.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180)) {
      return NextResponse.json({ error: 'Invalid coordinates', code: 'BAD_ORIGIN' }, { status: 400 });
    }
    const radius = Math.min(Math.max(parseFloat(sp.get('radius') ?? '500') || 500, 1), 1000);
    const typeRaw = sp.get('type');
    if (typeRaw && !['government', 'private', 'all'].includes(typeRaw)) {
      return NextResponse.json({ error: 'Invalid type — use government, private or all.' }, { status: 400 });
    }
    const type = typeRaw as HospitalType | 'all' | null;
    const speciality = sp.get('speciality');
    const emergencyOnly = sp.get('emergency') === '1';
    const q = (sp.get('q') ?? '').trim().toLowerCase().replace(/एम्स|^aims$/g, 'aiims').replace(/सफदरजंग|safdarjang/g, 'safdarjung').replace(/gurgaon|गुड़गांव/g, 'gurugram').replace(/bangalore/g, 'bengaluru').replace(/bombay/g, 'mumbai');
    const sort = sp.get('sort') ?? 'distance';
    const langParam = sp.get('lang') ?? 'en';
    const lang = isValidLang(langParam) ? langParam : 'en';
    const sourceRaw = sp.get('source');
    const originSource =
      sourceRaw === 'geolocation' || sourceRaw === 'manual' || sourceRaw === 'preset' || sourceRaw === 'map'
        ? sourceRaw
        : 'unknown';

    const allReviews = getAllReviews();

    // ── 1. Filter the dataset first (cheap) so we only route to what we show ──
    let filtered = [...HOSPITALS];
    if (type && type !== 'all') filtered = filtered.filter((h) => h.type === type);
    if (speciality) filtered = filtered.filter((h) => h.specialities.includes(speciality));
    if (emergencyOnly) {
      filtered = filtered.filter((h) => h.emergency === 'verified');
    }
    if (q) {
      filtered = filtered.filter((h) =>
        [
          h.name,
          h.shortName,
          h.city,
          CITY_HI[h.city] ?? '',
          h.state,
          STATE_HI[h.state] ?? '',
          h.address,
          h.pincode ?? '',
          h.type === 'government'
            ? 'सरकारी সরকারি ప్రభుత్వ सरकारी அரசு સરકારી سرکاری ಸರ್ಕಾರಿ ସରକାରୀ സർക്കാർ'
            : 'निजी বেসরকারি ప్రైవేట్ खाजगी தனியார் ખાનગી نجی ಖಾಸಗಿ ବେସରକାରୀ സ്വകാര്യം',
          ...h.specialities,
          ...h.specialities.map((s) => SPECIALITY_HI[s] ?? ''),
          ...h.facilities,
          ...h.facilities.map((f) => FACILITY_HI[f] ?? ''),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }

    // ── 2. One authoritative travel snapshot for the whole result set ─────────
    const snapshot = hasOrigin ? await cached(
      travelCacheKey(['hospitals', lat, lng, filtered.map((h) => h.id).join('+')]),
      CACHE_TTL_MS,
      () => getTravelSnapshot({ origin: { lat, lng }, originSource, hospitals: filtered, language: 'en-IN' }),
    ) : null;

    const results = filtered.map((h) => {
      const leg = snapshot?.legs[h.id];
      const geo = resolveHospitalGeo(h);
      const community = computeCommunityScore(h.id, allReviews);
      return {
        ...h,
        lat: geo.lat,
        lng: geo.lng,
        address: geo.address,
        /** Driving road distance in km from Google Routes (null = unknown, never guessed). */
        distanceKm: leg?.distanceKm ?? null,
        roadKm: leg?.distanceKm ?? null,
        distanceMeters: leg?.distanceMeters ?? null,
        /** Direct-line measurement, explicitly separate from the road distance. */
        straightKm: leg?.straightKm ?? null,
        etaMinutes: leg?.etaMinutes ?? null,
        staticMinutes: leg?.staticMinutes ?? null,
        trafficImpactMinutes: leg?.trafficImpactMinutes ?? null,
        travelSource: leg?.source ?? 'unavailable',
        travelError: leg?.error ?? null,
        distanceComputedAt: leg?.computedAt ?? null,
        communityScore: community.weightedStarScore,
        imdbScore: community.imdbScaleScore,
        reviewCount: community.eligibleCount,
      };
    });

    const known = results.filter((h) => typeof h.distanceKm === 'number');
    const withinRadius = results.filter((h) => typeof h.distanceKm === 'number' && (h.distanceKm as number) <= radius);
    const unrestricted = sp.get('unrestrictedRadius') === '1';
    const fellBack = !unrestricted && known.length > 0 && withinRadius.length === 0;
    const finalList = unrestricted ? results : fellBack ? known : withinRadius.length > 0 ? withinRadius : results;

    finalList.sort((a, b) => {
      if (sort === 'name') return a.shortName.localeCompare(b.shortName);
      if (sort === 'type') {
        return a.type.localeCompare(b.type) || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      }
      if (sort === 'rating') {
        const ra = a.communityScore ?? 0;
        const rb = b.communityScore ?? 0;
        if (rb !== ra) return rb - ra;
        return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      }
      return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    });

    const fellBackNote =
      lang === 'hi'
        ? 'चुनी गई दूरी के भीतर कोई अस्पताल नहीं मिला — इसके बजाय सबसे नज़दीकी अस्पताल दिखाए जा रहे हैं।'
        : 'No hospitals within the selected radius — showing the nearest hospitals instead.';

    return NextResponse.json({
      count: finalList.length,
      totalInDataset: HOSPITALS.length,
      radiusKm: radius,
      fellBack,
      note: fellBack ? fellBackNote : undefined,
      results: finalList,
      /** Provenance for every distance in this response. */
      distanceSource: snapshot?.source,
      distanceDisclosure: snapshot?.disclosure,
      travelComputedAt: snapshot?.computedAt,
      requestId: snapshot?.requestId,
      origin: hasOrigin ? { lat, lng, source: originSource } : null,
      blockers: snapshot?.blockers,
    });
  } catch (err) {
    console.error('[api/hospitals]', err);
    return NextResponse.json({ error: 'Failed to load hospitals. Please try again.' }, { status: 500 });
  }
}
