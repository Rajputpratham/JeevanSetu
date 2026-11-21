import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS, getHospitalById } from '@/data/hospitals';
import { resolveAllSchemes } from '@/lib/schemes';
import { aggregateFor } from '@/lib/review-bills';
import { buildCostPreview, resolveTreatment } from '@/lib/hospital-costs';
import { isValidLang } from '@/lib/lang-meta';

export const dynamic = 'force-dynamic';

/**
 * GET /api/schemes — scheme empanelment status per hospital branch.
 *
 * Every row carries its own provenance so the client can render the source link,
 * the checked date and the "not a coverage guarantee" caveat without inventing
 * any of it. A hospital with no record returns `unverified` for that scheme.
 *
 * Query: ids (comma separated, optional), lang
 */
export function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const langRaw = sp.get('lang') ?? 'en';
  const lang = isValidLang(langRaw) && (langRaw === 'hi' || langRaw === 'en') ? langRaw : 'en';
  const idsParam = (sp.get('ids') ?? '').trim();
  const requested = idsParam ? new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean)) : null;
  const hospitals = requested ? HOSPITALS.filter((h) => requested.has(h.id)) : HOSPITALS;

  const rows = hospitals.map((h) => ({
    hospitalId: h.id,
    hospitalName: h.shortName,
    state: h.state,
    city: h.city,
    schemes: resolveAllSchemes(h, { lang }).map((s) => ({
      scheme: s.scheme,
      short: s.definition.short,
      name: lang === 'hi' ? s.definition.hindiName : s.definition.name,
      status: s.status,
      label: s.label,
      stale: s.stale,
      downgraded: s.downgraded,
      lookupUrl: s.definition.lookupUrl,
      authority: s.record?.authority ?? s.definition.authority,
      sourceUrl: s.record?.sourceUrl ?? null,
      officialRecordId: s.record?.officialRecordId ?? null,
      effectiveOn: s.record?.effectiveOn ?? null,
      lastCheckedOn: s.record?.lastCheckedOn ?? null,
      validityNote: s.record?.validityNote ?? null,
      matchConfidence: s.record?.matchConfidence ?? null,
      evidenceNote: s.record?.evidenceNote ?? null,
      caveat: s.record?.caveat ?? null,
    })),
    /** Shown verbatim next to any "Ayushman" style claim. */
    disclosure:
      'Empanelment means a hospital joined a scheme network. It does not guarantee that you are eligible, that a particular treatment is covered, or that no money will be charged.',
  }));

  return NextResponse.json({
    count: rows.length,
    results: rows,
    reportBadgeUrl:
      'mailto:hello@jeevansetu.in?subject=' + encodeURIComponent('Incorrect scheme badge on JeevanSetu'),
    note: 'A hospital without official evidence for a scheme is shown as “Not verified”. JeevanSetu never infers “not empanelled” from a missing record.',
  });
}

/**
 * GET /api/schemes?hospitalId=…&treatmentId=… → cost preview payload.
 * Kept on the same route so a card can fetch scheme + cost in one request.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body', code: 'BAD_BODY' }, { status: 400 });
  }
  const { hospitalId, treatmentId, lang: rawLang } = body as {
    hospitalId?: string;
    treatmentId?: string;
    lang?: string;
  };
  const lang = rawLang === 'hi' ? 'hi' : 'en';
  const hospital = hospitalId ? getHospitalById(hospitalId) : undefined;
  if (!hospital) {
    return NextResponse.json({ error: 'Unknown hospital.', code: 'UNKNOWN_HOSPITAL' }, { status: 400 });
  }
  const treatment = resolveTreatment(treatmentId);
  if (!treatment) {
    return NextResponse.json({ error: 'Unknown treatment.', code: 'UNKNOWN_TREATMENT' }, { status: 400 });
  }
  const aggregate = aggregateFor(hospital.id, treatment.id);
  const preview = buildCostPreview(hospital, treatment, {
    community: { count: aggregate.count, latestMonth: aggregate.latestMonth },
  });
  return NextResponse.json({
    hospitalId: hospital.id,
    treatment: {
      id: treatment.id,
      name: lang === 'hi' && treatment.hindiName ? treatment.hindiName : treatment.name,
      category: treatment.category,
      typicalStayDays: treatment.typicalStayDays,
      opdOnly: treatment.roomPerDay === null && treatment.procedure === null,
    },
    preview,
    aggregate,
    lang,
  });
}
