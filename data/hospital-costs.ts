/**
 * TREATMENT × HOSPITAL COST EVIDENCE — data model + the records we actually hold.
 *
 * THREE SEPARATE CONCEPTS (never merged in the UI)
 *   1. Scheme package rate  — what a scheme pays a hospital for a package. It is
 *      NOT the hospital's price and NOT what the patient pays.
 *   2. Hospital tariff / written quote — the hospital's own published price.
 *   3. Community bill observation — a single patient's reported bill. Never a
 *      tariff, never "the typical price".
 *
 * EVIDENCE ORDER (strict): official scheme package → hospital tariff/quote →
 * labelled community observations. A lower tier is never presented as if it were
 * a higher one.
 *
 * WHAT IS IN THIS FILE
 *   The dataset is deliberately close to empty. No branch-level official package
 *   amount, hospital tariff or written quote has been verified for the hospitals
 *   in `data/hospitals.ts`, so `HOSPITAL_COSTS` has no price records. The UI must
 *   therefore say "Cost estimate unavailable" for hospital-specific pricing
 *   rather than reuse the generic estimator range as if it were this hospital's
 *   price. See `docs/data/cost-evidence.md`.
 */

export type CostConfidence = 'high' | 'medium' | 'low';

export type CostEvidenceKind =
  | 'scheme-package' // official scheme package rate
  | 'hospital-tariff' // hospital's published tariff
  | 'hospital-quote' // written quote given to a patient
  | 'community-bill'; // a self-reported bill (separate tier)

export interface MoneyRange {
  min: number;
  max: number;
  currency: 'INR';
}

export interface TreatmentCostRecord {
  hospitalId: string;
  /** Treatment id from `data/treatments.ts` (aliases resolved via lib/hospital-costs). */
  treatmentId: string;
  kind: CostEvidenceKind;
  /** Only for kind === 'scheme-package'. */
  schemeId?: 'pmjay' | 'cghs' | 'delhi-arogya-kosh' | 'haryana-chirayu' | 'esic' | 'state-other';
  /** Official package / procedure code, when the source publishes one. */
  packageCode?: string | null;
  /** Eligibility caveats for a package amount (scheme, room class, etc.). */
  eligibility?: string | null;
  amount: MoneyRange;
  /** What the amount includes. */
  inclusions: string[];
  /** What it excludes — always shown with the figure. */
  exclusions: string[];
  /** Human-readable source, e.g. "HBP 2022, package code MG001A". */
  sourceLabel: string;
  /** Direct URL of the source document. */
  sourceUrl: string;
  /** Effective date printed by the source (YYYY-MM-DD). */
  effectiveOn: string | null;
  /** Date a human last confirmed the figure (YYYY-MM-DD). */
  lastCheckedOn: string;
  confidence: CostConfidence;
  note?: string;
}

/**
 * Verified hospital-level price records.
 *
 * EMPTY ON PURPOSE. Every hospital in the current dataset either publishes no
 * machine-readable tariff or we could not open the official source from this
 * environment. The resolver returns `unavailable` for hospital-specific pricing,
 * which is the honest state — it is not a placeholder for a number to be invented
 * later.
 */
export const HOSPITAL_COSTS: TreatmentCostRecord[] = [];

/** Generic reference ranges (from `data/treatments.ts`) are NOT hospital prices. */
export const GENERIC_RANGE_DISCLOSURE =
  'Generic indicative range for this treatment type, compiled from public CGHS / PM-JAY / published-tariff references (2023–2025). It is not this hospital’s price and not a quote.';

export const GENERIC_RANGE_AS_OF = '2023–2025';

/** PM-JAY covers secondary/tertiary inpatient care; OPD-only care is not a package. */
export const PMJAY_COVERS_OPD = false;
