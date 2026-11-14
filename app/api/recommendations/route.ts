import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS, ALL_SPECIALITIES } from '@/data/hospitals';
import { recommendHospitals, specialityForProblem } from '@/lib/recommend';
import { isValidLang } from '@/lib/lang-meta';
import { getTravelSnapshot } from '@/lib/travel';
import { cached, travelCacheKey } from '@/lib/travel-cache';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 60_000;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const langRaw = sp.get('lang') ?? 'en';
    const lang = isValidLang(langRaw) ? langRaw : 'en';
    const problem = (sp.get('problem') ?? '').trim();
    let speciality = sp.get('speciality') ?? '';
    if (!speciality && problem) speciality = specialityForProblem(problem) ?? '';

    if (!speciality || !ALL_SPECIALITIES.includes(speciality)) {
      return NextResponse.json(
        {
          error:
            lang === 'hi'
              ? 'कृपया एक मान्य चिकित्सा विशेषता चुनें या अपनी समस्या अधिक स्पष्ट लिखें।'
              : 'Please choose a valid medical speciality or describe your problem more clearly.',
          mappedSpeciality: speciality || null,
        },
        { status: 400 },
      );
    }

    const typePreference = (sp.get('type') ?? 'any') as 'any' | 'government' | 'private';
    const budget = (sp.get('budget') ?? 'any') as 'any' | 'low' | 'medium' | 'high';
    const facilitiesWanted = (sp.get('facilities') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const lat = parseFloat(sp.get('lat') ?? '');
    const lng = parseFloat(sp.get('lng') ?? '');

    const base = recommendHospitals(HOSPITALS, {
      speciality,
      typePreference,
      budget,
      facilitiesWanted,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      lang,
    });

    // Authoritative driving distances for the recommended set only.
    let results = base;
    let distanceSource = 'unavailable';
    let distanceDisclosure = {
      text: 'Share your location to see verified Google driving distances for these recommendations.',
      live: false,
    };
    let blockers: string[] = [];

    if (Number.isFinite(lat) && Number.isFinite(lng) && base.length > 0) {
      const snapshot = await cached(
        travelCacheKey(['reco', lat, lng, base.map((r) => r.hospital.id).join('+')]),
        CACHE_TTL_MS,
        () =>
          getTravelSnapshot({ origin: { lat, lng }, hospitals: base.map((r) => r.hospital), language: 'en-IN' }),
      );
      distanceSource = snapshot.source;
      distanceDisclosure = snapshot.disclosure;
      blockers = snapshot.blockers;
      results = base
        .map((r) => {
          const leg = snapshot.legs[r.hospital.id];
          return {
            ...r,
            distanceKm: leg?.distanceKm ?? null,
            roadKm: leg?.distanceKm ?? null,
            etaMinutes: leg?.etaMinutes ?? null,
            travelSource: leg?.source ?? 'unavailable',
          };
        })
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    } else {
      results = base.map((r) => ({
        ...r,
        distanceKm: null,
        roadKm: null,
        etaMinutes: null,
        travelSource: 'unavailable',
      }));
    }

    return NextResponse.json({
      speciality,
      mappedFromProblem: problem ? speciality : undefined,
      count: results.length,
      results,
      distanceSource,
      distanceDisclosure,
      blockers,
      disclaimer:
        lang === 'hi'
          ? 'सुझाव सूचीबद्ध सुविधाओं, Google सड़क दूरी और किफ़ायती संकेतों पर आधारित हैं — ये चिकित्सा सलाह या इलाज की गारंटी नहीं हैं। जाने से पहले फ़ोन पर पुष्टि ज़रूर करें।'
          : 'Recommendations are based on listed facilities, verified Google driving distance and affordability signals — they are NOT medical advice or a guarantee of care. Always confirm services by phone before travel.',
    });
  } catch (err) {
    console.error('[api/recommendations]', err);
    return NextResponse.json({ error: 'Recommendation engine failed. Please try again.' }, { status: 500 });
  }
}
