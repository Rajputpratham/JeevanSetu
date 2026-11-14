import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS, ALL_SPECIALITIES } from '@/data/hospitals';
import { recommendHospitals, specialityForProblem } from '@/lib/recommend';
import { isValidLang } from '@/lib/lang-meta';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
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
    const lat = parseFloat(sp.get('lat') ?? '28.6139');
    const lng = parseFloat(sp.get('lng') ?? '77.2090');
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: 'Invalid location coordinates' }, { status: 400 });
    }

    const results = recommendHospitals(HOSPITALS, {
      speciality,
      typePreference,
      budget,
      facilitiesWanted,
      lat,
      lng,
      lang,
    });

    return NextResponse.json({
      speciality,
      mappedFromProblem: problem ? speciality : undefined,
      count: results.length,
      results,
      disclaimer:
        lang === 'hi'
          ? 'सुझाव सूचीबद्ध सुविधाओं, अनुमानित दूरी और किफ़ायती संकेतों पर आधारित हैं — ये चिकित्सा सलाह या इलाज की गारंटी नहीं हैं। जाने से पहले फ़ोन पर पुष्टि ज़रूर करें।'
          : 'Recommendations are based on listed facilities, approximate distance and affordability signals — they are NOT medical advice or a guarantee of care. Always confirm services by phone before travel.',
    });
  } catch (err) {
    console.error('[api/recommendations]', err);
    return NextResponse.json({ error: 'Recommendation engine failed. Please try again.' }, { status: 500 });
  }
}
