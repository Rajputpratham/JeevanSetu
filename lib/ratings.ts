import { CommunityReview, INITIAL_COMMUNITY_REVIEWS } from '@/data/reviews';
import { Hospital } from '@/data/types';

/**
 * IMDb-style Bayesian Weighted Rating (WR) parameters:
 *   WR = (v / (v + m)) * R + (m / (v + m)) * C
 * where:
 *   R = arithmetic mean of eligible reviews for the hospital (1.0 – 5.0)
 *   v = number of eligible, moderation-approved reviews for the hospital
 *   m = minimum credibility threshold (m = 3 reviews)
 *   C = global prior mean across all eligible reviews on JeevanSetu
 */
export const BAYESIAN_MIN_REVIEWS = 3;

export interface CommunityScoreSummary {
  hospitalId: string;
  eligibleCount: number;
  rawAverage: number | null;
  /** Bayesian weighted score on 10-point IMDb-style scale (e.g. 8.6 / 10) AND 5-star scale */
  weightedStarScore: number | null;
  imdbScaleScore: number | null;
  priorMean: number;
  minThreshold: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  subMetrics: {
    doctorCare: number | null;
    cleanliness: number | null;
    waitTime: number | null;
    billingTransparency: number | null;
  };
  formulaNote: string;
}

export function computeGlobalPriorMean(allReviews: CommunityReview[]): number {
  const eligible = allReviews.filter((r) => r.moderationStatus === 'approved');
  if (eligible.length === 0) return 4.0;
  const sum = eligible.reduce((acc, r) => acc + r.overall, 0);
  return Number((sum / eligible.length).toFixed(2));
}

export function computeCommunityScore(
  hospitalId: string,
  allReviews: CommunityReview[],
): CommunityScoreSummary {
  const priorMean = computeGlobalPriorMean(allReviews);
  const eligible = allReviews.filter(
    (r) => r.hospitalId === hospitalId && r.moderationStatus === 'approved',
  );
  const v = eligible.length;
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  if (v === 0) {
    return {
      hospitalId,
      eligibleCount: 0,
      rawAverage: null,
      weightedStarScore: null,
      imdbScaleScore: null,
      priorMean,
      minThreshold: BAYESIAN_MIN_REVIEWS,
      distribution,
      subMetrics: {
        doctorCare: null,
        cleanliness: null,
        waitTime: null,
        billingTransparency: null,
      },
      formulaNote:
        'No eligible community reviews yet. JeevanSetu never fabricates a score when reviews are absent.',
    };
  }

  let sumOverall = 0;
  let sumDoc = 0;
  let sumClean = 0;
  let sumWait = 0;
  let sumBill = 0;

  for (const r of eligible) {
    distribution[r.overall] = (distribution[r.overall] ?? 0) + 1;
    sumOverall += r.overall;
    sumDoc += r.metrics.doctorCare;
    sumClean += r.metrics.cleanliness;
    sumWait += r.metrics.waitTime;
    sumBill += r.metrics.billingTransparency;
  }

  const R = sumOverall / v;
  const m = BAYESIAN_MIN_REVIEWS;
  const C = priorMean;
  const WR = (v / (v + m)) * R + (m / (v + m)) * C;

  return {
    hospitalId,
    eligibleCount: v,
    rawAverage: Number(R.toFixed(2)),
    weightedStarScore: Number(WR.toFixed(2)),
    imdbScaleScore: Number((WR * 2).toFixed(1)),
    priorMean: C,
    minThreshold: m,
    distribution,
    subMetrics: {
      doctorCare: Number((sumDoc / v).toFixed(1)),
      cleanliness: Number((sumClean / v).toFixed(1)),
      waitTime: Number((sumWait / v).toFixed(1)),
      billingTransparency: Number((sumBill / v).toFixed(1)),
    },
    formulaNote: `IMDb-style Bayesian Weighted Rating: WR = (v/(v+m))×R + (m/(v+m))×C where v=${v}, m=${m}, R=${R.toFixed(2)}, C=${C.toFixed(2)}.`,
  };
}

/**
 * In-memory runtime review store (seeded from INITIAL_COMMUNITY_REVIEWS so user-submitted
 * moderated reviews persist across API calls during the server lifecycle).
 */
const runtimeReviews: CommunityReview[] = [...INITIAL_COMMUNITY_REVIEWS];

export function getAllReviews(): CommunityReview[] {
  return runtimeReviews;
}

export function getReviewsForHospital(hospitalId: string): CommunityReview[] {
  return runtimeReviews
    .filter((r) => r.hospitalId === hospitalId && r.moderationStatus === 'approved')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addCommunityReview(review: CommunityReview): void {
  runtimeReviews.unshift(review);
}

/**
 * Transparent Hospital Leaderboard Composite Score (0 – 100) for `/rankings`.
 * Combines:
 *  - Verified Facility Breadth (0–30 pts)
 *  - Speciality Coverage (0–25 pts)
 *  - Verified 24×7 Emergency Capability (0–15 pts)
 *  - Affordability / Public Access Score (0–15 pts)
 *  - Bayesian Community Score (0–15 pts; neutral prior when unreviewed so unreviewed district hospitals aren't unfairly penalised)
 */
export interface RankedHospitalEntry {
  rank: number;
  hospital: Hospital;
  compositeScore: number;
  community: CommunityScoreSummary;
  breakdown: {
    facilitiesPts: number;
    specialitiesPts: number;
    emergencyPts: number;
    affordabilityPts: number;
    communityPts: number;
  };
}

export function rankHospitals(
  hospitals: Hospital[],
  reviews: CommunityReview[] = getAllReviews(),
): RankedHospitalEntry[] {
  const prior = computeGlobalPriorMean(reviews);

  const entries = hospitals.map((h) => {
    const community = computeCommunityScore(h.id, reviews);
    const facilitiesPts = Math.min(30, Math.round((h.facilities.length / 13) * 30));
    const specialitiesPts = Math.min(25, Math.round((h.specialities.length / 14) * 25));
    const emergencyPts = h.emergency === 'verified' ? 15 : h.emergency === 'unverified' ? 6 : 0;
    const affordabilityPts =
      h.costProfile === 'very-low'
        ? 15
        : h.costProfile === 'low'
          ? 12
          : h.costProfile === 'moderate'
            ? 8
            : 4;
    const effectiveStars = community.weightedStarScore ?? prior;
    const communityPts = Math.round((effectiveStars / 5) * 15);

    const compositeScore =
      facilitiesPts + specialitiesPts + emergencyPts + affordabilityPts + communityPts;

    return {
      rank: 0,
      hospital: h,
      compositeScore,
      community,
      breakdown: {
        facilitiesPts,
        specialitiesPts,
        emergencyPts,
        affordabilityPts,
        communityPts,
      },
    };
  });

  entries.sort((a, b) => {
    if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
    const aRev = a.community.eligibleCount;
    const bRev = b.community.eligibleCount;
    if (bRev !== aRev) return bRev - aRev;
    return a.hospital.shortName.localeCompare(b.hospital.shortName);
  });

  return entries.map((e, idx) => ({ ...e, rank: idx + 1 }));
}
