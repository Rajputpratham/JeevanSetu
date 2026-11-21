/**
 * PRIVATE BILL EVIDENCE STORE for community "what did you actually pay?" reports.
 *
 * PRIVACY MODEL (enforced here, not in the UI)
 *   • A bill submission is stored as an internal record with a moderation state.
 *   • `publicView()` is the ONLY function that produces data for browsers and it
 *     never returns the uploaded file, its name, its bytes, contact details, or
 *     unstripped free text.
 *   • Files are held as opaque base64 blobs in this process only, capped in size,
 *     and are never served by any GET endpoint. There is no download route.
 *   • Money is NEVER attributed to a hospital tariff. `verificationStatus`
 *     drives the public label, and `bill_verified` requires an explicit reviewer
 *     action (admin endpoint gated by `BILL_REVIEW_TOKEN`), never an automatic
 *     promotion.
 *
 * STORAGE REALITY
 *   The app has no database. Reviews already live in in-process memory
 *   (`lib/ratings.ts`). Bills use the same pattern, documented rather than
 *   pretended: data is lost on restart and is NOT shared between server
 *   instances. A production deployment must move this to a database with a
 *   private file bucket. The access rules below are written so that move is
 *   mechanical — one row per record, and the file column is never returned by any
 *   public query.
 */

import type { SchemeId } from '@/data/schemes';

export type BillVerificationStatus =
  | 'self_reported'
  | 'pending_verification'
  | 'bill_verified'
  | 'rejected_removed';

export interface BillCoverageScope {
  /** What the amount is understood to cover, in the submitter's own terms. */
  scope: 'total_bill' | 'hospital_charges_only' | 'out_of_pocket_after_scheme' | 'not_sure';
  schemeUsed?: SchemeId | 'none' | 'not_sure';
}

export interface BillSubmission {
  id: string;
  hospitalId: string;
  /** Canonical treatment id from data/treatments.ts. */
  treatmentId: string;
  /** Approximate month of care, YYYY-MM. */
  careMonth: string;
  /** Amount in whole rupees. */
  amountInr: number;
  coverage: BillCoverageScope;
  /** Moderated comment from the review form. */
  note: string;
  verificationStatus: BillVerificationStatus;
  /** Public explanation of the label (never a reviewer identity). */
  statusReason: string | null;
  createdAt: string;
  /** Reviewer action timestamp — required before `bill_verified`. */
  reviewedAt: string | null;
  consentGiven: boolean;
  /** Private evidence, never exposed publicly. */
  file: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    /** base64 payload — NEVER serialised to a client. */
    base64: string;
    redactionNote: string | null;
  } | null;
  /** One-way dedupe key (hospital|treatment|month|amount|file prefix). */
  dedupeKey: string;
}

export interface PublicBillObservation {
  id: string;
  hospitalId: string;
  treatmentId: string;
  careMonth: string;
  amountInr: number;
  coverage: BillCoverageScope;
  note: string;
  verificationStatus: BillVerificationStatus;
  statusReason: string | null;
  /** Presence only — the file itself is unreachable. */
  hasPrivateEvidence: boolean;
  /** Always true: one report is never a tariff or a "typical price". */
  isSingleObservation: true;
  createdAt: string;
  correctionPolicy: { canRequestRemoval: true; removalChannel: string };
}

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
export const MAX_AMOUNT_INR = 10_000_000;
export const MIN_AMOUNT_INR = 1;
export const REMOVAL_CHANNEL = 'hello@jeevansetu.in';

const store: BillSubmission[] = [];

export function resetBillStore(): void {
  store.length = 0;
}

export interface BillInput {
  hospitalId: string;
  treatmentId: string;
  careMonth: string;
  amountInr: number;
  coverage: BillCoverageScope;
  note?: string;
  consentGiven: boolean;
  file?: { originalName: string; mimeType: string; base64: string } | null;
}

export type BillErrorCode =
  | 'CONSENT_REQUIRED'
  | 'BAD_AMOUNT'
  | 'BAD_MONTH'
  | 'UNKNOWN_HOSPITAL'
  | 'UNKNOWN_TREATMENT'
  | 'BAD_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'DUPLICATE';

export interface BillValidationError {
  code: BillErrorCode;
  message: string;
}

export function validateBillInput(
  input: BillInput,
  knownHospitals: Set<string>,
  knownTreatments: Set<string>,
): BillValidationError | null {
  if (!input.consentGiven) {
    return {
      code: 'CONSENT_REQUIRED',
      message: 'Please confirm you agree to share this amount publicly with a verification label.',
    };
  }
  if (!knownHospitals.has(input.hospitalId)) {
    return { code: 'UNKNOWN_HOSPITAL', message: 'Unknown hospital.' };
  }
  if (!knownTreatments.has(input.treatmentId)) {
    return { code: 'UNKNOWN_TREATMENT', message: 'Choose a treatment from the list.' };
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.careMonth)) {
    return { code: 'BAD_MONTH', message: 'Choose the approximate month of care.' };
  }
  if (
    !Number.isInteger(input.amountInr) ||
    input.amountInr < MIN_AMOUNT_INR ||
    input.amountInr > MAX_AMOUNT_INR
  ) {
    return { code: 'BAD_AMOUNT', message: 'Enter an amount in whole rupees between ₹1 and ₹1,00,00,000.' };
  }
  if (input.file) {
    if (!ALLOWED_MIME.has(input.file.mimeType)) {
      return { code: 'BAD_FILE_TYPE', message: 'Upload a JPG, PNG, WebP image or a PDF of the bill.' };
    }
    const bytes = Math.floor((input.file.base64.length * 3) / 4);
    if (bytes > MAX_FILE_BYTES) {
      return { code: 'FILE_TOO_LARGE', message: 'The bill file must be 3 MB or smaller.' };
    }
  }
  return null;
}

function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** Detect obvious contact identifiers so a note cannot leak them publicly. */
export function redactPersonalDetails(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g, '[phone redacted]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, '[email redacted]')
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[ID redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

export function addBill(
  input: BillInput,
): { ok: true; record: PublicBillObservation } | { ok: false; error: BillValidationError } {
  const dedupeKey = hash(
    [input.hospitalId, input.treatmentId, input.careMonth, input.amountInr, input.file?.base64.slice(0, 64) ?? ''].join('|'),
  );
  if (store.some((b) => b.dedupeKey === dedupeKey && b.verificationStatus !== 'rejected_removed')) {
    return {
      ok: false,
      error: { code: 'DUPLICATE', message: 'This bill amount has already been reported for this hospital and month.' },
    };
  }
  const record: BillSubmission = {
    id: `bill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    hospitalId: input.hospitalId,
    treatmentId: input.treatmentId,
    careMonth: input.careMonth,
    amountInr: input.amountInr,
    coverage: input.coverage,
    note: redactPersonalDetails(input.note ?? ''),
    verificationStatus: input.file ? 'pending_verification' : 'self_reported',
    statusReason: input.file
      ? 'Bill uploaded — awaiting a JeevanSetu reviewer.'
      : 'Self-reported amount; no bill evidence attached.',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    consentGiven: true,
    file: input.file
      ? {
          originalName: input.file.originalName.slice(0, 120),
          mimeType: input.file.mimeType,
          sizeBytes: Math.floor((input.file.base64.length * 3) / 4),
          base64: input.file.base64,
          redactionNote: null,
        }
      : null,
    dedupeKey,
  };
  store.push(record);
  return { ok: true, record: publicView(record)! };
}

/** The ONLY shape a browser may see. Never includes file bytes or names. */
export function publicView(record: BillSubmission): PublicBillObservation | null {
  if (record.verificationStatus === 'rejected_removed') return null;
  return {
    id: record.id,
    hospitalId: record.hospitalId,
    treatmentId: record.treatmentId,
    careMonth: record.careMonth,
    amountInr: record.amountInr,
    coverage: record.coverage,
    note: record.note,
    verificationStatus: record.verificationStatus,
    statusReason: record.statusReason,
    hasPrivateEvidence: record.file !== null,
    isSingleObservation: true,
    createdAt: record.createdAt,
    correctionPolicy: { canRequestRemoval: true, removalChannel: REMOVAL_CHANNEL },
  };
}

export function getPublicBills(
  filter: { hospitalId?: string; treatmentId?: string } = {},
): PublicBillObservation[] {
  return store
    .filter((b) => !filter.hospitalId || b.hospitalId === filter.hospitalId)
    .filter((b) => !filter.treatmentId || b.treatmentId === filter.treatmentId)
    .map(publicView)
    .filter((b): b is PublicBillObservation => b !== null)
    .sort((a, b) => (a.careMonth < b.careMonth ? 1 : -1));
}

export const AGGREGATE_SUPPRESSED_REASON =
  'Amounts are individual reports, so no average or “typical price” is computed from them.';

export interface BillAggregate {
  count: number;
  pendingCount: number;
  verifiedCount: number;
  latestMonth: string | null;
  averageSuppressedReason: string;
}

export function aggregateFor(hospitalId: string, treatmentId?: string): BillAggregate {
  const bills = getPublicBills({ hospitalId, treatmentId });
  return {
    count: bills.length,
    pendingCount: bills.filter((b) => b.verificationStatus === 'pending_verification').length,
    verifiedCount: bills.filter((b) => b.verificationStatus === 'bill_verified').length,
    latestMonth: bills[0]?.careMonth ?? null,
    averageSuppressedReason: AGGREGATE_SUPPRESSED_REASON,
  };
}

/** Reviewer action. `bill_verified` is impossible without this call. */
export function reviewBill(
  id: string,
  decision: 'approve' | 'reject',
  reason: string,
  reviewerVerifiedAgainstFile = false,
): BillSubmission | null {
  const record = store.find((b) => b.id === id);
  if (!record) return null;
  record.reviewedAt = new Date().toISOString();
  if (decision === 'reject') {
    record.verificationStatus = 'rejected_removed';
    record.statusReason = reason.slice(0, 200) || 'Removed after review.';
    return record;
  }
  if (!reviewerVerifiedAgainstFile) {
    // Approving a number without checking the evidence is not "bill verified".
    record.verificationStatus = 'pending_verification';
    record.statusReason = 'Reviewer confirmed receipt but not the amount; evidence check still pending.';
    return record;
  }
  record.verificationStatus = 'bill_verified';
  record.statusReason = reason.slice(0, 200) || 'Amount checked against the uploaded bill by a JeevanSetu reviewer.';
  return record;
}

/** Reporter-initiated removal (correction / deletion right). */
export function removeBill(id: string, reason = 'Removed at the reporter’s request.'): boolean {
  const record = store.find((b) => b.id === id);
  if (!record) return false;
  record.verificationStatus = 'rejected_removed';
  record.statusReason = reason;
  record.file = null;
  return true;
}

/** Aggregate counters used by cost previews. No PII, no files. */
export function REVIEW_BILL_STORE_TOTALS(): { approved: number; pending: number } {
  return {
    approved: store.filter((b) => b.verificationStatus === 'bill_verified' || b.verificationStatus === 'self_reported').length,
    pending: store.filter((b) => b.verificationStatus === 'pending_verification').length,
  };
}

export function getPrivateRecord(id: string): Readonly<BillSubmission> | undefined {
  return store.find((b) => b.id === id);
}
