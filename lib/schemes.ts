/**
 * SCHEME EMPANELMENT RESOLVER — the only way the UI may read scheme status.
 *
 * Encodes the honesty rules once, so no component can invent a claim:
 *   • A branch with no record → `unverified` ("Not verified").
 *   • A record whose last check is older than SCHEME_STALE_AFTER_DAYS → the
 *     status is downgraded to `unverified` and marked `stale`. Stale evidence is
 *     never shown as current.
 *   • `verified_not_empanelled` additionally requires `sourceCompleteForCity`
 *     and an exact-branch match; otherwise it too is `unverified`.
 *   • "Ayushman card accepted here" (`ayushmanAccepted`) is only true for a
 *     fresh, exact-branch PM-JAY `verified_empanelled` record.
 */

import type { Hospital } from '@/data/types';
import { SCHEME_EMPANELMENT } from '@/data/scheme-empanelment';
import {
  SCHEME_DEFINITIONS,
  SCHEME_STATUS_LABELS,
  isStale,
  type SchemeDefinition,
  type SchemeEmpanelmentRecord,
  type SchemeId,
  type SchemeStatus,
} from '@/data/schemes';

export interface ResolvedSchemeStatus {
  scheme: SchemeId;
  definition: SchemeDefinition;
  status: SchemeStatus;
  /** Label for the status, already translated. */
  label: string;
  /** True when the raw record existed but is past its freshness window. */
  stale: boolean;
  /** True when the record was downgraded because the match was not exact. */
  downgraded: boolean;
  record: SchemeEmpanelmentRecord | null;
}

/** Schemes shown on every card, in a stable order. */
export const CARD_SCHEMES: SchemeId[] = ['pmjay', 'cghs', 'delhi-arogya-kosh', 'haryana-chirayu'];

const MAX_STATUS_AGE_DAYS = 365;
export { MAX_STATUS_AGE_DAYS };

function recordFor(hospitalId: string, scheme: SchemeId): SchemeEmpanelmentRecord | null {
  return SCHEME_EMPANELMENT.find((r) => r.hospitalId === hospitalId && r.scheme === scheme) ?? null;
}

/** Schemes that are plausibly relevant to this hospital's state. */
export function relevantSchemes(hospital: Hospital): SchemeId[] {
  return CARD_SCHEMES.filter((id) => {
    if (id === 'delhi-arogya-kosh') return hospital.state === 'Delhi';
    if (id === 'haryana-chirayu') return hospital.state === 'Haryana';
    return true;
  });
}

/**
 * Pure status resolver for one record. Exported so tests (and the future import
 * pipeline) can prove the downgrade rules without touching the shipped dataset.
 */
export function resolveRecord(
  record: SchemeEmpanelmentRecord | null,
  scheme: SchemeId,
  opts: { lang?: 'en' | 'hi'; now?: number } = {},
): ResolvedSchemeStatus {
  const lang = opts.lang ?? 'en';
  const definition = SCHEME_DEFINITIONS[scheme];
  const base: ResolvedSchemeStatus = {
    scheme,
    definition,
    status: 'unverified',
    label: SCHEME_STATUS_LABELS.unverified[lang],
    stale: false,
    downgraded: false,
    record,
  };
  if (!record) return base;

  const stale = isStale(record, opts.now);
  const exact = record.matchConfidence === 'exact-branch';
  const notEmpanelmentClaimIsSound = record.sourceCompleteForCity === true && exact;

  let effective: SchemeStatus = record.status;
  let downgraded = false;
  if (record.status === 'verified_not_empanelled' && !notEmpanelmentClaimIsSound) {
    effective = 'unverified';
    downgraded = true;
  }
  if (record.status === 'verified_empanelled' && !exact) {
    effective = 'unverified';
    downgraded = true;
  }
  if (stale) {
    effective = 'unverified';
  }

  return {
    ...base,
    status: effective,
    stale,
    downgraded,
    label: SCHEME_STATUS_LABELS[effective][lang],
  };
}

export function resolveScheme(
  hospitalId: string,
  scheme: SchemeId,
  opts: { lang?: 'en' | 'hi'; now?: number } = {},
): ResolvedSchemeStatus {
  return resolveRecord(recordFor(hospitalId, scheme), scheme, opts);
}

export function resolveAllSchemes(
  hospital: Hospital,
  opts: { lang?: 'en' | 'hi'; now?: number } = {},
): ResolvedSchemeStatus[] {
  return relevantSchemes(hospital).map((scheme) => resolveScheme(hospital.id, scheme, opts));
}

/**
 * "Ayushman card accepted here" — requires a FRESH, exact-branch PM-JAY
 * verified empanelment. Empanelment is still not a coverage promise; the UI adds
 * that caveat next to the badge.
 */
export function ayushmanAccepted(hospital: Hospital, now = Date.now()): boolean {
  const pmjay = resolveScheme(hospital.id, 'pmjay', { now });
  return pmjay.status === 'verified_empanelled' && !pmjay.stale;
}

/** How many schemes have official evidence for this branch (any decisive state). */
export function verifiedSchemeCount(hospital: Hospital): number {
  return relevantSchemes(hospital).filter((s) => resolveScheme(hospital.id, s).status !== 'unverified').length;
}

/** Plain serialisable badge row used by cards and the detail page. */
export interface SchemeBadgeData {
  scheme: SchemeId;
  short: string;
  label: string;
  status: SchemeStatus;
  stale: boolean;
  sourceUrl: string | null;
  authority: string;
  officialRecordId: string | null;
  effectiveOn: string | null;
  lastCheckedOn: string | null;
  validityNote: string | null;
  evidenceNote: string | null;
  caveat: string | null;
  lookupUrl: string;
}

export function schemeBadges(
  hospital: Hospital,
  opts: { lang?: 'en' | 'hi'; now?: number } = {},
): SchemeBadgeData[] {
  return resolveAllSchemes(hospital, opts).map((s) => ({
    scheme: s.scheme,
    short: s.definition.short,
    label: (opts.lang ?? 'en') === 'hi' ? s.definition.hindiName : s.definition.name,
    status: s.status,
    stale: s.stale,
    sourceUrl: s.record?.sourceUrl ?? null,
    authority: s.record?.authority ?? s.definition.authority,
    officialRecordId: s.record?.officialRecordId ?? null,
    effectiveOn: s.record?.effectiveOn ?? null,
    lastCheckedOn: s.record?.lastCheckedOn ?? null,
    validityNote: s.record?.validityNote ?? null,
    evidenceNote: s.record?.evidenceNote ?? null,
    caveat: s.record?.caveat ?? null,
    lookupUrl: s.definition.lookupUrl,
  }));
}
