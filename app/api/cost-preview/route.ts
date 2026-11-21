import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS } from '@/data/hospitals';
import { TREATMENTS } from '@/data/treatments';
import { buildCostPreview, resolveTreatment } from '@/lib/hospital-costs';
import { aggregateFor } from '@/lib/review-bills';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cost-preview — compact treatment × hospital cost preview for cards.
 *
 * Query: treatment (id or alias), ids (comma separated hospital ids), lang
 *
 * Returns, per hospital: the evidence tier available for that branch, the exact
 * coverage sentence (never ₹0), the generic reference range clearly marked as
 * generic, and the count of community bill observations. No figures are invented
 * and no unpublished tariff is implied.
 */
export function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, 'geocode', 'Too many cost preview requests. Please wait a moment.');
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const treatment = resolveTreatment(sp.get('treatment'));
  const lang = sp.get('lang') === 'hi' ? 'hi' : 'en';
  const idsParam = (sp.get('ids') ?? '').trim();
  const ids = idsParam ? new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean)) : null;
  const hospitals = ids ? HOSPITALS.filter((h) => ids.has(h.id)) : HOSPITALS;

  if (!treatment) {
    return NextResponse.json(
      {
        error: 'Unknown treatment.',
        code: 'UNKNOWN_TREATMENT',
        treatments: TREATMENTS.map((t) => ({ id: t.id, name: t.name, hindiName: t.hindiName ?? t.name })),
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    treatment: {
      id: treatment.id,
      name: lang === 'hi' && treatment.hindiName ? treatment.hindiName : treatment.name,
      category: treatment.category,
      typicalStayDays: treatment.typicalStayDays,
      opdOnly: treatment.roomPerDay === null && treatment.procedure === null,
    },
    generatedAt: new Date().toISOString(),
    results: hospitals.map((hospital) => {
      const aggregate = aggregateFor(hospital.id, treatment.id);
      const preview = buildCostPreview(hospital, treatment, {
        community: { count: aggregate.count, latestMonth: aggregate.latestMonth },
      });
      return {
        hospitalId: hospital.id,
        state: preview.state,
        figure: preview.figure,
        coverageNote: preview.coverageNote,
        generic: preview.generic,
        community: preview.community,
        schemes: preview.schemes,
        aggregate,
      };
    }),
  });
}
