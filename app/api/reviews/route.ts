import { NextRequest, NextResponse } from 'next/server';
import { getHospitalById } from '@/data/hospitals';
import { CommunityReview } from '@/data/reviews';
import {
  addCommunityReview,
  computeCommunityScore,
  getAllReviews,
  getReviewsForHospital,
} from '@/lib/ratings';
import { moderateReviewInput } from '@/lib/moderation';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function isRating(value: unknown): value is CommunityReview['overall'] {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const hospitalId = (sp.get('hospitalId') ?? '').trim();

  if (!hospitalId) {
    // Return summary map for all hospitals when hospitalId is omitted
    const all = getAllReviews();
    return NextResponse.json({
      totalReviews: all.filter((r) => r.moderationStatus === 'approved').length,
    });
  }

  const hospital = getHospitalById(hospitalId);
  if (!hospital) {
    return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });
  }

  const summary = computeCommunityScore(hospitalId, getAllReviews());
  const reviews = getReviewsForHospital(hospitalId);

  return NextResponse.json({
    hospitalId,
    summary,
    reviews,
    disclosure:
      'JeevanSetu Community Score uses an IMDb-style Bayesian weighted average of moderation-screened community submissions. Reviews are patient/attendant experience reports (unverified hospital admission) and not clinical quality audits.',
  });
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(
      request,
      'reviews',
      'Too many review submissions. Please wait a minute before submitting again.',
    );
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }

    const {
      hospitalId,
      authorAlias,
      visitType,
      visitMonth,
      overall,
      doctorCare,
      cleanliness,
      waitTime,
      billingTransparency,
      comment,
    } = body as Record<string, unknown>;

    if (typeof hospitalId !== 'string' || !getHospitalById(hospitalId)) {
      return NextResponse.json({ error: 'Unknown hospital.' }, { status: 400 });
    }

    if (!isRating(overall) || !isRating(doctorCare) || !isRating(cleanliness) || !isRating(waitTime) || !isRating(billingTransparency)) {
      return NextResponse.json({error:'Choose a rating from 1 to 5 for each field.'}, {status:400});
    }
    const overallVal = overall;
    const mod = moderateReviewInput(
      {
        hospitalId,
        authorAlias: typeof authorAlias === 'string' ? authorAlias : undefined,
        comment: typeof comment === 'string' ? comment : undefined,
        overall: overallVal,
      },
      getAllReviews(),
    );

    if (!mod.allowed) {
      return NextResponse.json({ error: mod.reason, moderationStatus: 'rejected' }, { status: 422 });
    }

    const validVisitTypes = ['OPD', 'Emergency', 'Inpatient', 'Maternity', 'Diagnostics'] as const;
    const safeVisitType = validVisitTypes.includes(visitType as (typeof validVisitTypes)[number])
      ? (visitType as CommunityReview['visitType'])
      : 'OPD';

    const safeMonth =
      typeof visitMonth === 'string' && /^\d{4}-\d{2}$/.test(visitMonth)
        ? visitMonth
        : ''; // No visit month was supplied; do not infer it from submission time.

    const newReview: CommunityReview = {
      id: `rev-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      hospitalId,
      authorAlias: mod.sanitizedAuthor,
      visitType: safeVisitType,
      visitMonth: safeMonth,
      overall: overallVal,
      metrics: {
        doctorCare,
        cleanliness,
        waitTime,
        billingTransparency,
      },
      comment: mod.sanitizedComment,
      verificationStatus: 'community-unverified',
      moderationStatus: 'approved',
      createdAt: new Date().toISOString(),
      helpfulCount: 0,
      isDemoSeed: false,
    };

    addCommunityReview(newReview);
    const updatedSummary = computeCommunityScore(hospitalId, getAllReviews());

    return NextResponse.json(
      {
        review: newReview,
        summary: updatedSummary,
        reviews: getReviewsForHospital(hospitalId),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/reviews POST]', err);
    return NextResponse.json({ error: 'Failed to submit review.' }, { status: 500 });
  }
}
