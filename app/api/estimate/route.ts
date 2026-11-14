import { NextRequest, NextResponse } from 'next/server';
import { TREATMENTS, getTreatmentById } from '@/data/treatments';
import { estimateTreatment, RoomType } from '@/lib/cost-estimate';
import { isValidLang } from '@/lib/lang-meta';

export const dynamic = 'force-dynamic';

/** GET: treatment catalogue for the estimator UI. */
export function GET() {
  return NextResponse.json({
    count: TREATMENTS.length,
    treatments: TREATMENTS.map((t) => ({
      id: t.id,
      name: t.name,
      hindiName: t.hindiName,
      category: t.category,
      typicalStayDays: t.typicalStayDays,
      hasProcedureData: t.procedure !== null,
      note: t.note,
    })),
  });
}

/** POST: compute an itemised estimate. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { treatmentId, includedTests, stayDays, roomType, lang } = body as {
      treatmentId?: string;
      includedTests?: number[];
      stayDays?: number;
      roomType?: RoomType;
      lang?: string;
    };

    const safeLang = isValidLang(lang) ? lang : 'en';
    const treatment = treatmentId ? getTreatmentById(treatmentId) : undefined;
    if (!treatment) {
      return NextResponse.json({ error: safeLang === 'hi' ? 'अज्ञात इलाज' : 'Unknown treatment' }, { status: 400 });
    }
    const maxTestIdx = treatment.tests.length - 1;
    const included = Array.isArray(includedTests)
      ? includedTests.filter((i) => Number.isInteger(i) && i >= 0 && i <= maxTestIdx)
      : treatment.tests.map((_, i) => i);

    const safeRoom: RoomType = ['general', 'semi-private', 'private', 'icu'].includes(roomType as string)
      ? (roomType as RoomType)
      : 'general';
    const safeDays = Math.min(90, Math.max(0, Number(stayDays) || 0));

    const result = estimateTreatment(
      treatment,
      {
        treatmentId: treatment.id,
        includedTests: included,
        stayDays: safeDays,
        roomType: safeRoom,
      },
      safeLang,
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/estimate POST]', err);
    return NextResponse.json({ error: 'Could not compute estimate. Please try again.' }, { status: 500 });
  }
}
