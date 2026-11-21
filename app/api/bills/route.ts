import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS, getHospitalById } from '@/data/hospitals';
import { TREATMENTS } from '@/data/treatments';
import {
  MAX_AMOUNT_INR,
  addBill,
  aggregateFor,
  getPublicBills,
  redactPersonalDetails,
  reviewBill,
  validateBillInput,
  type BillCoverageScope,
} from '@/lib/review-bills';
import { resolveTreatment } from '@/lib/hospital-costs';
import { enforceRateLimit } from '@/lib/rate-limit';
import { moderateReviewInput } from '@/lib/moderation';
import { getAllReviews } from '@/lib/ratings';

export const dynamic = 'force-dynamic';

const HOSPITAL_IDS = new Set(HOSPITALS.map((h) => h.id));
const TREATMENT_IDS = new Set(TREATMENTS.map((t) => t.id));
const SCOPES = new Set<BillCoverageScope['scope']>([
  'total_bill',
  'hospital_charges_only',
  'out_of_pocket_after_scheme',
  'not_sure',
]);

/**
 * GET /api/bills — PUBLIC view of reported bill amounts.
 *
 * Never returns uploaded files, file names, submitter identity or contact data.
 * Amounts are individual observations; no average is computed.
 *
 * Query: hospitalId, treatmentId
 */
export function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const hospitalId = (sp.get('hospitalId') ?? '').trim() || undefined;
  const treatmentIdRaw = (sp.get('treatmentId') ?? '').trim();
  const treatmentId = treatmentIdRaw ? resolveTreatment(treatmentIdRaw)?.id ?? undefined : undefined;

  if (hospitalId && !HOSPITAL_IDS.has(hospitalId)) {
    return NextResponse.json({ error: 'Unknown hospital.' }, { status: 404 });
  }
  if (treatmentIdRaw && !treatmentId) {
    return NextResponse.json({ error: 'Unknown treatment.' }, { status: 400 });
  }

  const bills = getPublicBills({ hospitalId, treatmentId });
  return NextResponse.json({
    count: bills.length,
    bills,
    aggregate: hospitalId ? aggregateFor(hospitalId, treatmentId) : null,
    disclosure:
      'These are individual self-reported amounts. A single bill is not the hospital’s tariff and not a typical price. Verification labels are shown on each report.',
    privacy:
      'Uploaded bills are stored privately and are never shown publicly. Only the amount, treatment, approximate month and verification label are published.',
  });
}

/**
 * POST /api/bills — submit "what did you actually pay?" with optional private
 * bill evidence. The record starts as `self_reported` (no file) or
 * `pending_verification` (file attached). It can never become `bill_verified`
 * from this endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, 'reviews', 'Too many bill submissions. Please wait a minute.');
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request payload.', code: 'BAD_BODY' }, { status: 400 });
    }
    const {
      hospitalId,
      treatmentId: rawTreatment,
      careMonth,
      amountInr,
      scope,
      schemeUsed,
      note,
      consent,
      file,
      overall,
    } = body as Record<string, unknown>;

    if (typeof hospitalId !== 'string' || !HOSPITAL_IDS.has(hospitalId)) {
      return NextResponse.json({ error: 'Unknown hospital.', code: 'UNKNOWN_HOSPITAL' }, { status: 400 });
    }
    const treatment = resolveTreatment(typeof rawTreatment === 'string' ? rawTreatment : null);
    if (!treatment) {
      return NextResponse.json({ error: 'Choose a treatment from the list.', code: 'UNKNOWN_TREATMENT' }, { status: 400 });
    }
    const amount = Number(amountInr);

    let parsedFile: { originalName: string; mimeType: string; base64: string } | null = null;
    if (file && typeof file === 'object') {
      const f = file as Record<string, unknown>;
      if (typeof f.base64 !== 'string' || typeof f.mimeType !== 'string') {
        return NextResponse.json({ error: 'Malformed file payload.', code: 'BAD_FILE' }, { status: 400 });
      }
      parsedFile = {
        originalName: typeof f.name === 'string' ? f.name : 'bill',
        mimeType: f.mimeType,
        base64: f.base64,
      };
    }

    // Reuse the review moderation screen for the free-text note.
    let moderationOk = true;
    let moderationReason: string | undefined;
    if (typeof note === 'string' && note.trim().length > 0) {
      const mod = moderateReviewInput(
        { hospitalId, comment: redactPersonalDetails(note), overall: typeof overall === 'number' ? overall : 3 },
        getAllReviews(),
      );
      // A short bill note does not need the 15-char review minimum.
      if (!mod.allowed && !/at least 15 characters/.test(mod.reason ?? '')) {
        moderationOk = false;
        moderationReason = mod.reason;
      }
    }
    if (!moderationOk) {
      return NextResponse.json({ error: moderationReason, code: 'REJECTED' }, { status: 422 });
    }

    const safeScope = typeof scope === 'string' && SCOPES.has(scope as BillCoverageScope['scope'])
      ? (scope as BillCoverageScope['scope'])
      : 'not_sure';

    const input = {
      hospitalId,
      treatmentId: treatment.id,
      careMonth: typeof careMonth === 'string' ? careMonth : '',
      amountInr: Number.isFinite(amount) ? Math.round(amount) : -1,
      coverage: {
        scope: safeScope,
        schemeUsed:
          typeof schemeUsed === 'string' &&
          ['pmjay', 'cghs', 'delhi-arogya-kosh', 'haryana-chirayu', 'esic', 'state-other', 'none', 'not_sure'].includes(schemeUsed)
            ? (schemeUsed as BillCoverageScope['schemeUsed'])
            : undefined,
      },
      note: typeof note === 'string' ? note : '',
      consentGiven: consent === true,
      file: parsedFile,
    };

    const error = validateBillInput(input, HOSPITAL_IDS, TREATMENT_IDS);
    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    const result = addBill(input);
    if (!result.ok) {
      return NextResponse.json({ error: result.error.message, code: result.error.code }, { status: 409 });
    }

    const hospital = getHospitalById(hospitalId)!;
    return NextResponse.json(
      {
        bill: result.record,
        aggregate: aggregateFor(hospital.id, treatment.id),
        hospital: { id: hospital.id, name: hospital.shortName },
        message:
          result.record.verificationStatus === 'pending_verification'
            ? 'Thank you. Your amount is published as “Pending verification” while a reviewer checks the bill.'
            : 'Thank you. Your amount is published as “Self-reported”. Upload a bill if you want it verified.',
        limits: { maxAmountInr: MAX_AMOUNT_INR },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/bills POST]', err);
    return NextResponse.json({ error: 'Failed to submit bill amount.' }, { status: 500 });
  }
}

/**
 * PATCH /api/bills — reviewer action. Requires `BILL_REVIEW_TOKEN`.
 *
 * `decision: 'approve'` only promotes to "Bill verified" when
 * `verifiedAgainstFile: true` is explicitly sent, i.e. a human compared the
 * number with the uploaded evidence.
 */
export async function PATCH(request: NextRequest) {
  const token = process.env.BILL_REVIEW_TOKEN;
  const auth = request.headers.get('authorization') ?? '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || provided !== token) {
    return NextResponse.json(
      {
        error: 'Review actions are disabled or unauthorised. Set BILL_REVIEW_TOKEN and send it as a Bearer token.',
        code: 'UNAUTHORISED',
      },
      { status: 401 },
    );
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body', code: 'BAD_BODY' }, { status: 400 });
  }
  const { id, decision, reason, verifiedAgainstFile, action } = body as Record<string, unknown>;
  if (typeof id !== 'string' || (decision !== 'approve' && decision !== 'reject')) {
    return NextResponse.json({ error: 'Provide id and decision.', code: 'BAD_BODY' }, { status: 400 });
  }
  if (action === 'remove') {
    const removed = reviewBill(id, 'reject', typeof reason === 'string' ? reason : 'Removed on request.');
    return removed
      ? NextResponse.json({ ok: true, status: removed.verificationStatus })
      : NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const updated = reviewBill(
    id,
    decision,
    typeof reason === 'string' ? reason : '',
    decision === 'approve' && verifiedAgainstFile === true,
  );
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    ok: true,
    status: updated.verificationStatus,
    reason: updated.statusReason,
    verified: updated.verificationStatus === 'bill_verified',
  });
}
