import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS, ALL_SPECIALITIES } from '@/data/hospitals';
import { recommendHospitals, specialityForProblem } from '@/lib/recommend';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const problem = (sp.get('problem') ?? '').trim();
    let speciality = sp.get('speciality') ?? '';
    if (!speciality && problem) speciality = specialityForProblem(problem) ?? '';

    if (!speciality || !ALL_SPECIALITIES.includes(speciality)) {
      return NextResponse.json(
        { error: 'Please choose a valid medical speciality or describe your problem more clearly.', mappedSpeciality: speciality || null },
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

    const results = recommendHospitals(HOSPITALS, { speciality, typePreference, budget, facilitiesWanted, lat, lng });

    return NextResponse.json({
      speciality,
      mappedFromProblem: problem ? speciality : undefined,
      count: results.length,
      results,
      disclaimer:
        'Recommendations are based on listed facilities, approximate distance and affordability signals — they are NOT medical advice or a guarantee of care. Always confirm services by phone before travel.',
    });
  } catch (err) {
    console.error('[api/recommendations]', err);
    return NextResponse.json({ error: 'Recommendation engine failed. Please try again.' }, { status: 500 });
  }
}
