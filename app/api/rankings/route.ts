import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS } from '@/data/hospitals';
import { estimateTravelMetrics } from '@/lib/geo';
import { rankHospitals } from '@/lib/ratings';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const city = (sp.get('city') ?? '').trim();
    const type = (sp.get('type') ?? 'all').trim();
    const speciality = (sp.get('speciality') ?? '').trim();
    const emergencyOnly = sp.get('emergency') === '1';
    const lat = parseFloat(sp.get('lat') ?? '28.6139');
    const lng = parseFloat(sp.get('lng') ?? '77.2090');

    let filtered = [...HOSPITALS];
    if (city) filtered = filtered.filter((h) => h.city.toLowerCase() === city.toLowerCase());
    if (type === 'government' || type === 'private') filtered = filtered.filter((h) => h.type === type);
    if (speciality) filtered = filtered.filter((h) => h.specialities.includes(speciality));
    if (emergencyOnly) filtered = filtered.filter((h) => h.emergency === 'verified');

    const ranked = rankHospitals(filtered).map((entry) => {
      const travel = estimateTravelMetrics(
        Number.isFinite(lat) ? lat : 28.6139,
        Number.isFinite(lng) ? lng : 77.2090,
        entry.hospital.lat,
        entry.hospital.lng,
      );
      return {
        ...entry,
        roadKm: travel.roadKm,
        etaMinutes: travel.trafficMinutes,
      };
    });

    return NextResponse.json({
      count: ranked.length,
      methodology:
        'Composite Score (0–100) = Verified Facilities (30) + Specialities (25) + Verified 24×7 Emergency (15) + Public Affordability (15) + IMDb-style Bayesian Community Score (15). Not a clinical mortality/outcome ranking.',
      results: ranked,
    });
  } catch (err) {
    console.error('[api/rankings]', err);
    return NextResponse.json({ error: 'Failed to load rankings.' }, { status: 500 });
  }
}
