import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS } from '@/data/hospitals';
import { estimateTravelMetrics } from '@/lib/geo';
import { HospitalType } from '@/data/types';
import { CITY_HI, FACILITY_HI, SPECIALITY_HI, STATE_HI } from '@/lib/i18n-data';
import { computeCommunityScore, getAllReviews } from '@/lib/ratings';
import { isValidLang } from '@/lib/lang-meta';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const lat = parseFloat(sp.get('lat') ?? '28.6139');
    const lng = parseFloat(sp.get('lng') ?? '77.2090');
    const radius = Math.min(Math.max(parseFloat(sp.get('radius') ?? '500') || 500, 1), 1000);
    const typeRaw = sp.get('type');
    if (typeRaw && !['government', 'private', 'all'].includes(typeRaw)) {
      return NextResponse.json({ error: 'Invalid type — use government, private or all.' }, { status: 400 });
    }
    const type = typeRaw as HospitalType | 'all' | null;
    const speciality = sp.get('speciality');
    const emergencyOnly = sp.get('emergency') === '1';
    const q = (sp.get('q') ?? '').trim().toLowerCase();
    const sort = sp.get('sort') ?? 'distance';
    const langParam = sp.get('lang') ?? 'en';
    const lang = isValidLang(langParam) ? langParam : 'en';

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const allReviews = getAllReviews();

    let results = HOSPITALS.map((h) => {
      const travel = estimateTravelMetrics(lat, lng, h.lat, h.lng);
      const community = computeCommunityScore(h.id, allReviews);
      return {
        ...h,
        /** Driving road distance (km) — used consistently across map, cards, detail, compare & emergency */
        distanceKm: travel.roadKm,
        straightKm: travel.straightKm,
        roadKm: travel.roadKm,
        etaMinutes: travel.trafficMinutes,
        baseMinutes: travel.baseMinutes,
        trafficLevel: travel.trafficLevel,
        trafficSource: travel.source,
        communityScore: community.weightedStarScore,
        imdbScore: community.imdbScaleScore,
        reviewCount: community.eligibleCount,
      };
    });

    if (type && type !== 'all') results = results.filter((h) => h.type === type);
    if (speciality) results = results.filter((h) => h.specialities.includes(speciality));
    if (emergencyOnly) results = results.filter((h) => h.emergency === 'verified' || h.emergency === 'unverified');
    if (q) {
      results = results.filter((h) =>
        [
          h.name,
          h.shortName,
          h.city,
          CITY_HI[h.city] ?? '',
          h.state,
          STATE_HI[h.state] ?? '',
          h.address,
          h.pincode ?? '',
          h.type === 'government' ? 'सरकारी সরকারি ప్రభుత్వ सरकारी அரசு સરકારી سرکاری ಸರ್ಕಾರಿ ସରକାରୀ സർക്കാർ' : 'निजी বেসরকারি ప్రైవేట్ खाजगी தனியார் ખાનગી نجی ಖಾಸಗಿ ବେସରକାରୀ സ്വകാര്യം',
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

    const withinRadius = results.filter((h) => h.distanceKm <= radius);
    const fellBack = withinRadius.length === 0 && results.length > 0;
    const finalList = fellBack ? results : withinRadius;

    finalList.sort((a, b) => {
      if (sort === 'name') return a.shortName.localeCompare(b.shortName);
      if (sort === 'type') return a.type.localeCompare(b.type) || a.distanceKm - b.distanceKm;
      if (sort === 'rating') {
        const ra = a.communityScore ?? 0;
        const rb = b.communityScore ?? 0;
        if (rb !== ra) return rb - ra;
        return a.distanceKm - b.distanceKm;
      }
      return a.distanceKm - b.distanceKm;
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
    });
  } catch (err) {
    console.error('[api/hospitals]', err);
    return NextResponse.json({ error: 'Failed to load hospitals. Please try again.' }, { status: 500 });
  }
}
