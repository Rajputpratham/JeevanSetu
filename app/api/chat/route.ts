import { NextRequest, NextResponse } from 'next/server';
import { generateGroundedChatReply } from '@/lib/chatbot';
import { isValidLang } from '@/lib/lang-meta';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { message, lang, lat, lng, focusedHospitalId } = body as {
      message?: string;
      lang?: string;
      lat?: number;
      lng?: number;
      focusedHospitalId?: string;
    };

    const text = (message ?? '').trim();
    if (!text || text.length > 500) {
      return NextResponse.json({ error: 'Please enter a valid question (1–500 characters).' }, { status: 400 });
    }

    const safeLang = isValidLang(lang) ? lang : 'en';
    const safeLat = typeof lat === 'number' && Number.isFinite(lat) ? lat : 28.6139;
    const safeLng = typeof lng === 'number' && Number.isFinite(lng) ? lng : 77.2090;

    const payload = await generateGroundedChatReply({
      message: text,
      lang: safeLang,
      lat: safeLat,
      lng: safeLng,
      focusedHospitalId: typeof focusedHospitalId === 'string' ? focusedHospitalId : undefined,
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error('[api/chat]', err);
    return NextResponse.json({ error: 'Assistant temporarily unavailable.' }, { status: 500 });
  }
}
