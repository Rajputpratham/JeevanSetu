export interface CommunityReview {
  id: string;
  hospitalId: string;
  authorAlias: string;
  visitType: 'OPD' | 'Emergency' | 'Inpatient' | 'Maternity' | 'Diagnostics';
  visitMonth: string; // e.g. '2026-09'
  overall: 1 | 2 | 3 | 4 | 5;
  metrics: {
    doctorCare: 1 | 2 | 3 | 4 | 5;
    cleanliness: 1 | 2 | 3 | 4 | 5;
    waitTime: 1 | 2 | 3 | 4 | 5;
    billingTransparency: 1 | 2 | 3 | 4 | 5;
  };
  comment: string;
  verificationStatus: 'community-unverified';
  moderationStatus: 'approved' | 'flagged' | 'rejected';
  createdAt: string;
  helpfulCount: number;
  isDemoSeed?: boolean;
}
