import { NextRequest, NextResponse } from 'next/server';
import { getHospitalById } from '@/data/hospitals';
import { CommunityReview } from '@/data/reviews';
import {
  addCommunityReview,
  computeCommunityScore,
  getAllReviews,
  getReviewsForHospital,
} from '@/lib/ratings';
import { checkRateLimit, moderateReviewInput } from '@/lib/moderation';

export const dynamic = 'force-dynamic';

function clampRating(n: unknown, fallback: 1 | 2 | 3 | 4 | 5 = 4): 1 | 2 | 3 | 4 | 5 {
  const v = Math.round(Number(n));
  if (v >= 1 && v <= 5) return v as 1 | 2 | 3 | 4 | 5;
  return fallback;
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
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'anonymous-client';

    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Too many review submissions. Please wait a minute before submitting again.' },
        { status: 429 },
      );
    }

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

    const overallVal = clampRating(overall, 4);
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
        : new Date().toISOString().slice(0, 7);

    const newReview: CommunityReview = {
      id: `rev-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      hospitalId,
      authorAlias: mod.sanitizedAuthor,
      visitType: safeVisitType,
      visitMonth: safeMonth,
      overall: overallVal,
      metrics: {
        doctorCare: clampRating(doctorCare, overallVal),
        cleanliness: clampRating(cleanliness, overallVal),
        waitTime: clampRating(waitTime, overallVal),
        billingTransparency: clampRating(billingTransparency, overallVal),
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
