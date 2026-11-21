/**
 * TREATMENT × HOSPITAL COST PREVIEW resolver.
 *
 * Rules enforced here (not in the components):
 *   1. A hospital-specific figure is only returned from verified evidence
 *      (`HOSPITAL_COSTS`), in strict order: scheme package → hospital tariff /
 *      quote → labelled community observation.
 *   2. With no verified hospital-level evidence the preview is
 *      `hospital-estimate-unavailable`. The generic estimator range may be shown
 *      ONLY as a clearly separate "generic range" line, never as this hospital's
 *      price.
 *   3. Empanelment alone NEVER produces ₹0 or an out-of-pocket figure. A verified
 *      PM-JAY empanelment with no verified package data yields the exact sentence
 *      "Potentially covered — confirm eligibility and package with the hospital."
 *   4. Every monetary figure carries its source label, URL and date.
 */

import { TREATMENTS } from '@/data/treatments';
import type { Treatment } from '@/data/types';
import type { Hospital } from '@/data/types';
import {
  HOSPITAL_COSTS,
  GENERIC_RANGE_AS_OF,
  GENERIC_RANGE_DISCLOSURE,
  PMJAY_COVERS_OPD,
  type CostEvidenceKind,
  type MoneyRange,
  type TreatmentCostRecord,
} from '@/data/hospital-costs';
import { resolveScheme, type ResolvedSchemeStatus } from './schemes';
import type { SchemeId } from '@/data/schemes';
import { aggregateFor } from './review-bills';

/** Common alternate names → canonical treatment id. */
export const TREATMENT_ALIASES: Record<string, string> = {
  delivery: 'normal-delivery',
  'normal delivery': 'normal-delivery',
  'vaginal delivery': 'normal-delivery',
  'c-section': 'caesarean',
  'cesarean': 'caesarean',
  'cesarean section': 'caesarean',
  'c section': 'caesarean',
  'bypass': 'angioplasty',
  angioplasty: 'angioplasty',
  'ptca': 'angioplasty',
  'stent': 'angioplasty',
  'cataract surgery': 'cataract',
  'lens': 'cataract',
  'appendix': 'appendectomy',
  'appendicitis': 'appendectomy',
  'gall bladder': 'appendectomy',
  'knee surgery': 'knee-replacement',
  'knee transplant': 'knee-replacement',
  tkr: 'knee-replacement',
  dialysis: 'dialysis-session',
  'hemodialysis': 'dialysis-session',
  'haemodialysis': 'dialysis-session',
  chemo: 'chemotherapy',
  'cancer chemotherapy': 'chemotherapy',
  hernia: 'hernia-repair',
  fracture: 'fracture-minor',
  'bone fracture': 'fracture-minor',
  typhoid: 'typhoid',
  dengue: 'dengue-admit',
  'blood test': 'cbc-test',
  cbc: 'cbc-test',
  xray: 'chest-xray',
  'x-ray': 'chest-xray',
  ultrasound: 'ultrasound',
  'sonography': 'ultrasound',
  ecg: 'ecg',
  echo: 'ecg',
  mri: 'mri',
  'consultation': 'general-consultation',
  'opd': 'general-consultation',
  'fever': 'general-consultation',
};

/** Resolve any user-facing treatment name / alias / id to a canonical treatment. */
export function resolveTreatment(idOrAlias: string | null | undefined): Treatment | null {
  if (!idOrAlias) return null;
  const raw = idOrAlias.trim().toLowerCase();
  if (!raw) return null;
  const direct = TREATMENTS.find((t) => t.id === raw || t.name.toLowerCase() === raw);
  if (direct) return direct;
  const alias = TREATMENT_ALIASES[raw];
  if (alias) return TREATMENTS.find((t) => t.id === alias) ?? null;
  return null;
}

export type CostPreviewState =
  | 'loading'
  | 'hospital-price' // verified hospital-level figure
  | 'potentially-covered' // empanelled, but no verified package amount
  | 'generic-range' // no hospital evidence; generic range only, clearly labelled
  | 'unavailable';

export interface CostPreviewFigure {
  amount: MoneyRange;
  kind: CostEvidenceKind;
  sourceLabel: string;
  sourceUrl: string;
  effectiveOn: string | null;
  lastCheckedOn: string;
  inclusions: string[];
  exclusions: string[];
  confidence: TreatmentCostRecord['confidence'];
}

export interface CostPreview {
  treatment: Treatment;
  state: CostPreviewState;
  /** The strongest hospital-specific figure, if any. */
  figure: CostPreviewFigure | null;
  /** Community observations, always separate and never averaged into a price. */
  community: { count: number; latestMonth: string | null; label: string } | null;
  /** Generic range for the treatment (regardless of hospital). */
  generic: {
    govt: MoneyRange;
    private: MoneyRange;
    asOf: string;
    disclosure: string;
  };
  /** Scheme facts relevant to the caveat (never a ₹0 claim). */
  schemes: {
    schemeId: SchemeId;
    label: string;
    empanelled: boolean;
    verified: boolean;
  }[];
  /** Exact sentence explaining coverage — rendered verbatim. */
  coverageNote: { en: string; hi: string } | null;
}

const KIND_LABEL: Record<CostEvidenceKind, string> = {
  'scheme-package': 'Official scheme package rate',
  'hospital-tariff': 'Hospital published tariff',
  'hospital-quote': 'Written hospital quote',
  'community-bill': 'Community bill observation',
};

export const KIND_LABEL_I18N: Record<CostEvidenceKind, { en: string; hi: string }> = {
  'scheme-package': { en: 'Official scheme package rate', hi: 'आधिकारिक योजना पैकेज दर' },
  'hospital-tariff': { en: 'Hospital published tariff', hi: 'अस्पताल का प्रकाशित शुल्क' },
  'hospital-quote': { en: 'Written hospital quote', hi: 'अस्पताल का लिखित कोटेशन' },
  'community-bill': { en: 'Community bill observation', hi: 'समुदाय द्वारा बताया गया बिल' },
};

export const COVERAGE_ACKNOWLEDGEMENT = {
  en: 'Potentially covered — confirm eligibility and package with the hospital.',
  hi: 'संभवतः आवरण — पात्रता और पैकेज की पुष्टि अस्पताल से करें।',
};

export const COST_UNAVAILABLE = {
  en: 'Cost estimate unavailable',
  hi: 'लागत अनुमान उपलब्ध नहीं',
};

export const KIND_LABEL_OF = KIND_LABEL;

function genericFor(treatment: Treatment) {
  return {
    govt: { min: treatment.consultation.govt[0], max: treatment.consultation.govt[1], currency: 'INR' as const },
    private: { min: treatment.consultation.private[0], max: treatment.consultation.private[1], currency: 'INR' as const },
    asOf: GENERIC_RANGE_AS_OF,
    disclosure: GENERIC_RANGE_DISCLOSURE,
  };
}

const EVIDENCE_ORDER: CostEvidenceKind[] = ['scheme-package', 'hospital-tariff', 'hospital-quote', 'community-bill'];

/**
 * Build the preview for one hospital × treatment. `opts.community` lets the API
 * pass approved, aggregate-only bill observations; nothing user-identifiable is
 * ever part of this object.
 */
export function buildCostPreview(
  hospital: Hospital,
  treatment: Treatment,
  opts: { community?: { count: number; latestMonth: string | null } } = {},
): CostPreview {
  return buildCostPreviewWithSchemes(hospital, treatment, [
    resolveScheme(hospital.id, 'pmjay'),
    resolveScheme(hospital.id, 'cghs'),
  ], opts);
}

/**
 * Same resolver with the scheme statuses injected — used by the test suite (and
 * by the future data pipeline preview) to prove the coverage wording without
 * mutating the shipped dataset.
 */
export function buildCostPreviewWithSchemes(
  hospital: Hospital,
  treatment: Treatment,
  resolvedSchemes: ResolvedSchemeStatus[],
  opts: { community?: { count: number; latestMonth: string | null } } = {},
): CostPreview {
  const records = HOSPITAL_COSTS.filter(
    (r) => r.hospitalId === hospital.id && r.treatmentId === treatment.id,
  ).sort((a, b) => EVIDENCE_ORDER.indexOf(a.kind) - EVIDENCE_ORDER.indexOf(b.kind));

  const strongest = records[0] ?? null;
  const pmjay = resolvedSchemes.find((s) => s.scheme === 'pmjay') ?? resolveScheme(hospital.id, 'pmjay');

  const schemes = resolvedSchemes.map((s) => ({
    schemeId: s.scheme,
    label: s.definition.name,
    empanelled: s.status === 'verified_empanelled',
    verified: s.status !== 'unverified',
  }));

  const opdOnly = treatment.roomPerDay === null && treatment.procedure === null;

  let coverageNote: CostPreview['coverageNote'] = null;
  const pmjayEmpanelled = pmjay.status === 'verified_empanelled' && !pmjay.stale;
  const stateSchemeEmpanelled = schemes.some((s) => s.empanelled);
  const schemeRelevantInpatient = !opdOnly && PMJAY_COVERS_OPD === false ? true : false;

  if (!strongest && (pmjayEmpanelled || stateSchemeEmpanelled) && schemeRelevantInpatient) {
    coverageNote = COVERAGE_ACKNOWLEDGEMENT;
  }

  const community =
    opts.community && opts.community.count > 0
      ? {
          count: opts.community.count,
          latestMonth: opts.community.latestMonth,
          label: `${opts.community.count} community bill ${opts.community.count === 1 ? 'observation' : 'observations'} for this treatment — individual reports, not a hospital tariff or a typical price.`,
        }
      : null;

  if (strongest) {
    return {
      treatment,
      state: 'hospital-price',
      figure: {
        amount: strongest.amount,
        kind: strongest.kind,
        sourceLabel: strongest.sourceLabel,
        sourceUrl: strongest.sourceUrl,
        effectiveOn: strongest.effectiveOn,
        lastCheckedOn: strongest.lastCheckedOn,
        inclusions: strongest.inclusions,
        exclusions: strongest.exclusions,
        confidence: strongest.confidence,
      },
      community,
      generic: genericFor(treatment),
      schemes,
      coverageNote,
    };
  }

  return {
    treatment,
    state: coverageNote ? 'potentially-covered' : 'generic-range',
    figure: null,
    community,
    generic: genericFor(treatment),
    schemes,
    coverageNote,
  };
}

/**
 * The label of the whole preview: what the card may claim.
 * `unavailable` is returned only when even the generic treatment range is absent.
 */
export function previewHeadline(preview: CostPreview): { en: string; hi: string } {
  if (preview.state === 'hospital-price') {
    return { en: 'Hospital-specific figure', hi: 'अस्पताल-विशिष्ट आंकड़ा' };
  }
  if (preview.state === 'potentially-covered') return COVERAGE_ACKNOWLEDGEMENT;
  if (preview.generic.govt.max > 0 || preview.generic.private.max > 0) {
    return { en: 'Generic range — not this hospital’s price', hi: 'सामान्य सीमा — यह इस अस्पताल का शुल्क नहीं' };
  }
  return COST_UNAVAILABLE;
}

/** Live count of published community bill observations (aggregate only). */
export function communityBillCount(hospitalId: string, treatmentId?: string): number {
  return aggregateFor(hospitalId, treatmentId).count;
}
