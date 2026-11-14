import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS } from '@/data/hospitals';
import { estimateTravelMetrics } from '@/lib/geo';
import { HELPLINES } from '@/data/helplines';
import { HELPLINE_HI } from '@/lib/i18n-data';
import { isValidLang } from '@/lib/lang-meta';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const langParam = sp.get('lang') ?? 'en';
    const lang = isValidLang(langParam) ? langParam : 'en';
    const lat = parseFloat(sp.get('lat') ?? '28.6139');
    const lng = parseFloat(sp.get('lng') ?? '77.2090');
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const emergencyHospitals = HOSPITALS
      .filter((h) => h.emergency === 'verified' || h.emergency === 'unverified')
      .map((h) => {
        const travel = estimateTravelMetrics(lat, lng, h.lat, h.lng);
        return {
          ...h,
          distanceKm: travel.roadKm,
          straightKm: travel.straightKm,
          roadKm: travel.roadKm,
          etaMinutes: travel.trafficMinutes,
          baseMinutes: travel.baseMinutes,
          trafficLevel: travel.trafficLevel,
          trafficSource: travel.source,
        };
      })
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
      incidentFeedStatus: 'unavailable-no-authorised-feed',
      incidentNotice:
        'Live road-accident / road-closure incident feeds are not connected (no authorised municipal traffic feed configured). JeevanSetu never invents road incident alerts.',
      notice:
        lang === 'hi'
          ? 'यदि कोई गंभीर रूप से बीमार या घायल है, तो पहले 112 पर कॉल करें और ऑपरेटर से बात करें — इस वेबसाइट को देखने के लिए इलाज में देरी न करें। सड़क दूरी और यात्रा समय अनुमानित हैं। संभव हो तो हमेशा फ़ोन पर आपातकालीन क्षमता की पुष्टि करें।'
          : 'If someone is seriously ill or injured, call 112 FIRST and speak to the operator — do not delay medical care to browse this website. Road distances and ETAs are indicative estimates. Always confirm emergency capability by phone when possible.',
    });
  } catch (err) {
    console.error('[api/emergency]', err);
    return NextResponse.json({ error: 'Could not load emergency data. If this is an emergency, call 112 now.' }, { status: 500 });
  }
}
