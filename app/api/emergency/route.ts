import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS } from '@/data/hospitals';
import { haversineKm } from '@/lib/geo';
import { HELPLINES } from '@/data/helplines';
import { HELPLINE_HI } from '@/lib/i18n-data';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const lang = sp.get('lang') === 'hi' ? 'hi' : 'en';
    const lat = parseFloat(sp.get('lat') ?? '28.6139');
    const lng = parseFloat(sp.get('lng') ?? '77.2090');
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const emergencyHospitals = HOSPITALS
      .filter((h) => h.emergency === 'verified' || h.emergency === 'unverified')
      .map((h) => ({ ...h, distanceKm: haversineKm(lat, lng, h.lat, h.lng) }))
      .sort((a, b) => (a.emergency === b.emergency ? a.distanceKm - b.distanceKm : a.emergency === 'verified' ? -1 : 1));

    const helplines = lang === 'hi'
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
      notice:
        lang === 'hi'
          ? 'यदि कोई गंभीर रूप से बीमार या घायल है, तो पहले 112 पर कॉल करें और ऑपरेटर से बात करें — इस वेबसाइट को देखने के लिए इलाज में देरी न करें। दूरियां अनुमानित हैं। संभव हो तो हमेशा फ़ोन पर आपातकालीन क्षमता की पुष्टि करें।'
          : 'If someone is seriously ill or injured, call 112 FIRST and speak to the operator — do not delay medical care to browse this website. Distances are approximate. Always confirm emergency capability by phone when possible.',
    });
  } catch (err) {
    console.error('[api/emergency]', err);
    return NextResponse.json({ error: 'Could not load emergency data. If this is an emergency, call 112 now.' }, { status: 500 });
  }
}
