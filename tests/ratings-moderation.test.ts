import { describe, it, expect } from 'vitest';
import {
  computeCommunityScore,
  computeGlobalPriorMean,
  rankHospitals,
  BAYESIAN_MIN_REVIEWS,
} from '@/lib/ratings';
import { INITIAL_COMMUNITY_REVIEWS } from './fixtures/reviews';
import { HOSPITALS } from '@/data/hospitals';
import { moderateReviewInput } from '@/lib/moderation';

describe('Module 6, 8 & 9 — IMDb-Style Bayesian Community Score, Moderation & Rankings', () => {
  it('never fabricates a score for hospitals with 0 reviews', () => {
    const summary = computeCommunityScore('bsa-hospital', INITIAL_COMMUNITY_REVIEWS);
    expect(summary.eligibleCount).toBe(0);
    expect(summary.weightedStarScore).toBeNull();
    expect(summary.imdbScaleScore).toBeNull();
  });

  it('computes exact IMDb-style Bayesian Weighted Rating WR = (v/(v+m))R + (m/(v+m))C', () => {
    expect(computeCommunityScore('aiims-new-delhi', INITIAL_COMMUNITY_REVIEWS).eligibleCount).toBe(0);
    const reports = INITIAL_COMMUNITY_REVIEWS.map(r => ({...r, isDemoSeed:false}));
    const C = computeGlobalPriorMean(reports);
    const summary = computeCommunityScore('aiims-new-delhi', reports);
    expect(summary.eligibleCount).toBe(3);
    const R = (5 + 4 + 5) / 3;
    const v = 3;
    const m = BAYESIAN_MIN_REVIEWS;
    const expectedWR = Number(((v / (v + m)) * R + (m / (v + m)) * C).toFixed(2));
    expect(summary.weightedStarScore).toBe(expectedWR);
    expect(summary.imdbScaleScore).toBe(Number((expectedWR * 2).toFixed(1)));
    expect(summary.distribution[5]).toBe(2);
    expect(summary.distribution[4]).toBe(1);
  });

  it('blocks spam links, profanity, miracle-cure claims, too-short comments, and duplicates', () => {
    const shortRes = moderateReviewInput(
      { hospitalId: 'aiims-new-delhi', comment: 'Good hospital' },
      INITIAL_COMMUNITY_REVIEWS,
    );
    expect(shortRes.allowed).toBe(false);

    const urlRes = moderateReviewInput(
      { hospitalId: 'aiims-new-delhi', comment: 'Great doctors visit https://spam-clinic.example.com now' },
      INITIAL_COMMUNITY_REVIEWS,
    );
    expect(urlRes.allowed).toBe(false);

    const miracleRes = moderateReviewInput(
      { hospitalId: 'aiims-new-delhi', comment: 'They offer a 100% cure for every disease here!' },
      INITIAL_COMMUNITY_REVIEWS,
    );
    expect(miracleRes.allowed).toBe(false);

    const dupRes = moderateReviewInput(
      {
        hospitalId: 'aiims-new-delhi',
        comment: INITIAL_COMMUNITY_REVIEWS[0].comment,
      },
      INITIAL_COMMUNITY_REVIEWS,
    );
    expect(dupRes.allowed).toBe(false);
  });

  it('redacts personal mobile numbers and strips HTML tags in legitimate reviews', () => {
    const validRes = moderateReviewInput(
      {
        hospitalId: 'rml-hospital',
        authorAlias: '<b>Ramesh</b>',
        comment: 'OPD registration was smooth at 8:30 AM. My attendant number is 9876543210.',
      },
      INITIAL_COMMUNITY_REVIEWS,
    );
    expect(validRes.allowed).toBe(true);
    expect(validRes.sanitizedAuthor).toBe('Ramesh');
    expect(validRes.sanitizedComment).toContain('[phone redacted]');
    expect(validRes.sanitizedComment).not.toContain('9876543210');
  });

  it('ranks hospitals transparently with complete score breakdowns', () => {
    const ranked = rankHospitals(HOSPITALS, INITIAL_COMMUNITY_REVIEWS);
    expect(ranked.length).toBe(HOSPITALS.length);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].compositeScore).toBeGreaterThanOrEqual(ranked[1].compositeScore);
    const sumBreakdown =
      ranked[0].breakdown.facilitiesPts +
      ranked[0].breakdown.specialitiesPts +
      ranked[0].breakdown.emergencyPts +
      ranked[0].breakdown.affordabilityPts +
      ranked[0].breakdown.communityPts;
    expect(ranked[0].compositeScore).toBe(sumBreakdown);
  });
});
