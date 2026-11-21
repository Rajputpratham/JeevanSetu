/**
 * OFFICIAL SCHEME EMPANELMENT — data model.
 *
 * WHAT THIS IS
 *   One record per (hospital branch × scheme). Nothing here is inferred from a
 *   hospital group, from a private directory, or from the hospital's own
 *   marketing page. A record only carries `verified_empanelled` /
 *   `verified_not_empanelled` when a human checked the *official* source for the
 *   exact branch, and the record stores enough provenance to re-check it.
 *
 * STATUS MEANINGS (never collapse these)
 *   verified_empanelled      — official list, exact branch matched → "Verified empanelled"
 *   verified_not_empanelled  — official list is complete for that city/scheme and
 *                              the branch is absent, or an official record says the
 *                              branch is not/ex-no-longer empanelled → "Verified not empanelled"
 *   unverified               — no current official evidence for this branch
 *                              (missing record, uncertain match, stale list,
 *                              source inaccessible) → "Not verified"
 *
 *   Absence of evidence is NOT evidence of absence: an incomplete or unreachable
 *   list must produce `unverified`, never `verified_not_empanelled`.
 *
 * "Ayushman card accepted here" is only rendered from a PM-JAY record whose
 * status is `verified_empanelled`, whose `lastCheckedOn` is inside the freshness
 * window, and which names an official source — see `scheme-badges.md` in
 * `docs/data/`.
 */

export type SchemeStatus = 'verified_empanelled' | 'verified_not_empanelled' | 'unverified';

export type SchemeId =
  | 'pmjay' // Ayushman Bharat PM-JAY (NHA)
  | 'cghs' // Central Government Health Scheme (MoHFW)
  | 'delhi-arogya-kosh' // Delhi Arogya Kosh (Govt of NCT Delhi)
  | 'haryana-chirayu' // Haryana Chirayu Haryana / Ayushman Bharat Haryana
  | 'esic'
  | 'state-other';

export interface SchemeDefinition {
  id: SchemeId;
  /** Short label used on compact badges. */
  short: string;
  name: string;
  hindiName: string;
  /** Human name of the official issuing authority. */
  authority: string;
  /** Where a member of the public can re-check this scheme's own list. */
  lookupUrl: string;
  /** Who the scheme covers — printed in the detail-page caveat. */
  audience: string;
  audienceHi: string;
  /** States where this scheme's records are relevant. */
  states: string[];
}

export type MatchConfidence = 'exact-branch' | 'uncertain' | 'group-only';

export interface SchemeEmpanelmentRecord {
  hospitalId: string;
  scheme: SchemeId;
  status: SchemeStatus;
  /** Official authority, e.g. "National Health Authority (NHA)". */
  authority: string;
  /** Direct URL of the official list/document this record was read from. */
  sourceUrl: string;
  /** Official identifier inside that source, when the source publishes one. */
  officialRecordId: string | null;
  /** Date the source document was published / took effect (YYYY-MM-DD). */
  effectiveOn: string | null;
  /** Date a human last opened the official source and checked this branch. */
  lastCheckedOn: string;
  /** Expiry / suspension / validity wording exactly as published. */
  validityNote: string | null;
  /** How the branch was matched: address + locality + official id. */
  matchConfidence: MatchConfidence;
  /** What was seen, verbatim-enough to audit (no interpretation). */
  evidenceNote: string;
  /** Anything that limits the claim (partial list, name change, etc.). */
  caveat?: string;
  /**
   * True only when the official list consulted is complete for this city and
   * scheme. Required for `verified_not_empanelled`; ignored otherwise.
   */
  sourceCompleteForCity?: boolean;
}

/** Records older than this are shown as stale and never as "accepted here". */
export const SCHEME_STALE_AFTER_DAYS = 365;

export const SCHEME_DEFINITIONS: Record<SchemeId, SchemeDefinition> = {
  pmjay: {
    id: 'pmjay',
    short: 'PM-JAY',
    name: 'Ayushman Bharat PM-JAY',
    hindiName: 'आयुष्मान भारत PM-JAY',
    authority: 'National Health Authority (NHA), Government of India',
    lookupUrl: 'https://beneficiary.nha.gov.in/',
    audience: 'SECC-2011 / state-expanded eligible families (₹5 lakh per family per year)',
    audienceHi: 'SECC-2011 / राज्य-विस्तारित पात्र परिवार (प्रति परिवार ₹5 लाख प्रति वर्ष)',
    states: ['Delhi', 'Haryana', 'Uttar Pradesh', 'Maharashtra', 'Rajasthan', 'West Bengal', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Gujarat', 'Odisha', 'Kerala'],
  },
  cghs: {
    id: 'cghs',
    short: 'CGHS',
    name: 'Central Government Health Scheme',
    hindiName: 'केंद्रीय सरकारी स्वास्थ्य योजना (CGHS)',
    authority: 'Directorate General of CGHS, Ministry of Health & Family Welfare',
    lookupUrl: 'https://cghs.mohfw.gov.in/',
    audience: 'Central government employees, pensioners and their dependants',
    audienceHi: 'केंद्र सरकार के कर्मचारी, पेंशनभोगी और उनके आश्रित',
    states: ['Delhi', 'Haryana', 'Uttar Pradesh', 'Maharashtra', 'Rajasthan', 'West Bengal', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Gujarat', 'Odisha', 'Kerala'],
  },
  'delhi-arogya-kosh': {
    id: 'delhi-arogya-kosh',
    short: 'Delhi Arogya Kosh',
    name: 'Delhi Arogya Kosh',
    hindiName: 'दिल्ली आरोग्य कोष',
    authority: 'Department of Health & Family Welfare, Govt of NCT of Delhi',
    lookupUrl: 'https://delhi.gov.in/',
    audience: 'Delhi-resident patients referred for high-cost treatment',
    audienceHi: 'उच्च लागत इलाज के लिए रेफर किए गए दिल्ली के निवासी मरीज़',
    states: ['Delhi'],
  },
  'haryana-chirayu': {
    id: 'haryana-chirayu',
    short: 'Chirayu Haryana',
    name: 'Chirayu Haryana (Ayushman Bharat Haryana)',
    hindiName: 'चिरायु हरियाणा (आयुष्मान भारत हरियाणा)',
    authority: 'Ayushman Bharat Haryana, Govt of Haryana',
    lookupUrl: 'https://ayushmanbharat.haryana.gov.in/pm-jay/',
    audience: 'Eligible Haryana families under the state scheme',
    audienceHi: 'राज्य योजना के तहत पात्र हरियाणा परिवार',
    states: ['Haryana'],
  },
  esic: {
    id: 'esic',
    short: 'ESIC',
    name: 'Employees’ State Insurance Corporation',
    hindiName: 'कर्मचारी राज्य बीमा निगम (ESIC)',
    authority: 'Employees’ State Insurance Corporation, Ministry of Labour & Employment',
    lookupUrl: 'https://www.esic.gov.in/',
    audience: 'Insured workers and their families',
    audienceHi: 'बीमित श्रमिक और उनके परिवार',
    states: ['Delhi', 'Haryana', 'Uttar Pradesh', 'Maharashtra', 'Rajasthan', 'West Bengal', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Gujarat', 'Odisha', 'Kerala'],
  },
  'state-other': {
    id: 'state-other',
    short: 'State scheme',
    name: 'State health scheme',
    hindiName: 'राज्य स्वास्थ्य योजना',
    authority: 'State Government',
    lookupUrl: 'https://nha.gov.in/',
    audience: 'State-specific beneficiaries',
    audienceHi: 'राज्य-विशेष लाभार्थी',
    states: [],
  },
};

export const SCHEME_STATUS_LABELS: Record<SchemeStatus, { en: string; hi: string; tone: 'green' | 'slate' | 'amber' }> = {
  verified_empanelled: { en: 'Verified empanelled', hi: 'सत्यापित — सूची में शामिल', tone: 'green' },
  verified_not_empanelled: { en: 'Verified not empanelled', hi: 'सत्यापित — सूची में नहीं', tone: 'slate' },
  unverified: { en: 'Not verified', hi: 'सत्यापित नहीं', tone: 'amber' },
};

export function daysSince(dateIso: string | null | undefined, now = Date.now()): number | null {
  if (!dateIso) return null;
  const t = Date.parse(`${dateIso}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}

export function isStale(record: SchemeEmpanelmentRecord, now = Date.now()): boolean {
  const age = daysSince(record.lastCheckedOn, now);
  return age === null || age > SCHEME_STALE_AFTER_DAYS;
}
