/**
 * JeevanSetu shared types.
 *
 * Verification model — every hospital field that cannot be guaranteed
 * carries an explicit verification status:
 *   'verified'   — checked against public, official or widely-published listings
 *   'unverified' — plausible / commonly listed, but not double-checked
 *   'unavailable'— we do not have reliable data; UI must say so, never guess
 */
export type Verification = 'verified' | 'unverified' | 'unavailable';
export type HospitalType = 'government' | 'private';
export type EmergencyStatus = 'verified' | 'unverified' | 'none';

export interface Hospital {
  id: string;
  name: string;
  shortName: string;
  type: HospitalType;
  tagline?: string;
  address: string;
  city: string;
  state: string;
  pincode?: string;
  lat: number;
  lng: number;
  /** Publicly listed contact number, or null when not reliably known. */
  phone: string | null;
  /** 24x7 emergency care availability. */
  emergency: EmergencyStatus;
  emergencyNote?: string;
  beds: number | null;
  opdTimings: string | null;
  opdStatus: Verification;
  specialities: string[];
  facilities: string[];
  /** Approximate relative spending profile used for affordability hints — never an exact quote. */
  costProfile: 'very-low' | 'low' | 'moderate' | 'high';
  ownershipNote?: string;
  foundedNote?: string;
  dataNote?: string;
}

export interface TreatmentRange {
  govt: [number, number];
  private: [number, number];
}
export interface CostTest extends TreatmentRange {
  name: string;
}
export interface Treatment {
  id: string;
  name: string;
  hindiName?: string;
  category: string;
  /** OPD-only (no admission) treatments use zero-night stays. */
  consultation: TreatmentRange;
  tests: CostTest[];
  /** null  = procedure cost not reliably published — estimator must say so */
  procedure: TreatmentRange | null;
  /** null when the treatment is OPD-only with no room charge expected */
  roomPerDay: TreatmentRange | null;
  typicalStayDays: [number, number];
  medicines: TreatmentRange;
  note?: string;
  sourceNote: string;
}
