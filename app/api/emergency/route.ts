import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS } from '@/data/hospitals';
import { haversineKm } from '@/lib/geo';
import { HELPLINES } from '@/data/helplines';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const lat = parseFloat(sp.get('lat') ?? '28.6139');
    const lng = parseFloat(sp.get('lng') ?? '77.2090');
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const emergencyHospitals = HOSPITALS
      .filter((h) => h.emergency === 'verified' || h.emergency === 'unverified')
      .map((h) => ({ ...h, distanceKm: haversineKm(lat, lng, h.lat, h.lng) }))
      .sort((a, b) => (a.emergency === b.emergency ? a.distanceKm - b.distanceKm : a.emergency === 'verified' ? -1 : 1));

    return NextResponse.json({
      helplines: HELPLINES,
      count: emergencyHospitals.length,
      verifiedCount: emergencyHospitals.filter((h) => h.emergency === 'verified').length,
      hospitals: emergencyHospitals,
      notice:
        'If someone is seriously ill or injured, call 112 FIRST and speak to the operator — do not delay medical care to browse this website. Distances are approximate. Always confirm emergency capability by phone when possible.',
    });
  } catch (err) {
    console.error('[api/emergency]', err);
    return NextResponse.json({ error: 'Could not load emergency data. If this is an emergency, call 112 now.' }, { status: 500 });
  }
}
