/**
 * SCHEME EMPANELMENT RECORDS — official evidence only.
 *
 * Each entry below was read from a government source and matched to the EXACT
 * branch in `data/hospitals.ts`. Where that was not possible, no record exists
 * and the UI shows "Not verified" — the absence of a record is never treated as
 * "not empanelled".
 *
 * Verified in this build (2026-11-21):
 *   • AB-PMJAY district list, Gurugram (Haryana) — Government of Haryana,
 *     Ayushman Bharat cell, list dated 03/08/2026. Official hospital IDs quoted.
 *   • BSKY state empanelment list (Odisha) — AIIMS Bhubaneswar.
 *
 * NOT verifiable from this build environment (official hosts unreachable from
 * the build network, and no verified mirror exists):
 *   • NHA PM-JAY hospital locator (hospitals.pmjay.gov.in) for Delhi, Mumbai,
 *     Bengaluru, Chennai, Hyderabad, Jaipur, Lucknow, Kolkata, Ahmedabad,
 *     Kochi, Pune and Noida/Ghaziabad branches.
 *   • CGHS empanelled-hospital list (cghs.mohfw.gov.in) for any branch.
 *   • Delhi Arogya Kosh / Chirayu Haryana branch lists.
 * Those branches therefore render "Not verified" for those schemes. See
 * `docs/data/scheme-empanelment.md` for the exact research log and the
 * import workflow that replaces manual editing.
 */

import type { SchemeEmpanelmentRecord } from './schemes';

export const SCHEME_EMPANELMENT: SchemeEmpanelmentRecord[] = [
  // ── Haryana PM-JAY (official district lists, Govt of Haryana) ──────────────
  // Source: https://ayushmanbharat.haryana.gov.in/pm-jay/ → district PDFs.
  // District Gurugram list dated 03/08/2026 contains 66 facilities (31 public,
  // 35 private). Neither Medanta nor Fortis Memorial appears in it.
  {
    hospitalId: 'medanta-medicity',
    scheme: 'pmjay',
    status: 'verified_not_empanelled',
    authority: 'Ayushman Bharat Haryana — State Health Agency (PM-JAY)',
    sourceUrl:
      'https://cdnbbsr.s3waas.gov.in/s3169779d3852b32ce8b1a1724dbf5217d/uploads/2026/08/20260804420926830.pdf',
    officialRecordId: null,
    effectiveOn: '2026-08-03',
    lastCheckedOn: '2026-11-21',
    validityNote: 'District list published "as on 03/08/2026"; AB-PMJAY lists are revised without a fixed expiry.',
    matchConfidence: 'exact-branch',
    sourceCompleteForCity: true,
    evidenceNote:
      'Read the complete "List of empanelled Hospitals of District Gurugram (Haryana) under AB-PMJAY as on 03/08/2026" (66 facilities, hospital IDs HOSP6G…/HOSP6P…). No entry for Medanta / Medicity anywhere in the list.',
    caveat:
      'District list scope is Gurugram district only. A facility could hold a different district listing; re-check the live NHA locator before treating this as final.',
  },
  {
    hospitalId: 'fmri-gurugram',
    scheme: 'pmjay',
    status: 'verified_not_empanelled',
    authority: 'Ayushman Bharat Haryana — State Health Agency (PM-JAY)',
    sourceUrl:
      'https://cdnbbsr.s3waas.gov.in/s3169779d3852b32ce8b1a1724dbf5217d/uploads/2026/08/20260804420926830.pdf',
    officialRecordId: null,
    effectiveOn: '2026-08-03',
    lastCheckedOn: '2026-11-21',
    validityNote: 'District list published "as on 03/08/2026"; AB-PMJAY lists are revised without a fixed expiry.',
    matchConfidence: 'exact-branch',
    sourceCompleteForCity: true,
    evidenceNote:
      'Same district Gurugram AB-PMJAY list as above: no "Fortis" entry among the 66 empanelled facilities (the private entries are eye/dental/ortho/multi-speciality facilities such as Park Hospital, Signature Hospital, SilverStreak, Umang, Kathuria).',
    caveat:
      'Fortis group has other empanelled branches in India; this record applies to the Gurugram (Sector 44) branch only. Re-check before admission.',
  },

  // ── Odisha BSKY (state scheme, NOT PM-JAY) ────────────────────────────────
  {
    hospitalId: 'aiims-bhubaneswar',
    scheme: 'state-other',
    status: 'verified_empanelled',
    authority: 'Government of Odisha — Biju Swasthya Kalyan Yojana (BSKY)',
    sourceUrl: 'https://bsky.odisha.gov.in/application/storage/app/uploads/6573067535d9b1702037109.pdf',
    officialRecordId: 'BSKY list Sl. No. 481',
    effectiveOn: null,
    lastCheckedOn: '2026-11-21',
    validityNote: 'BSKY empanelment list published by the Odisha Health Department; no per-facility expiry printed.',
    matchConfidence: 'exact-branch',
    evidenceNote:
      'Official BSKY state list "List of hospitals empanelled under BSKY within the State": Sl. No. 481, district Khordha (Rural), hospital "AIIMS BHUBANESWAR".',
    caveat:
      'This is Odisha’s BSKY scheme, not AB-PMJAY (PM-JAY is not implemented in Odisha). It is evidence of BSKY empanelment only. Re-open the live PDF before relying on it.',
  },
];

/**
 * Schemes whose official list we could not open from the build environment.
 * Recorded so the UI can be explicit rather than silently blank, and so the
 * next data run knows exactly what to re-check.
 */
export const SCHEME_SOURCE_STATUS = [
  {
    scheme: 'pmjay' as const,
    officialLookupUrl: 'https://hospitals.pmjay.gov.in/',
    state: 'reachable' as const,
    note: 'NHA locator requires an interactive captcha search; district mirrors are used where a state agency publishes them.',
  },
  {
    scheme: 'cghs' as const,
    officialLookupUrl: 'https://cghs.mohfw.gov.in/',
    state: 'unreachable' as const,
    note: 'CGHS portal did not respond from the build network on 2026-11-21; no CGHS record is published, so every branch reads "Not verified".',
  },
  {
    scheme: 'delhi-arogya-kosh' as const,
    officialLookupUrl: 'https://delhi.gov.in/',
    state: 'unreachable' as const,
    note: 'No branch-level DAK list retrievable; no DAK record is published.',
  },
  {
    scheme: 'haryana-chirayu' as const,
    officialLookupUrl: 'https://ayushmanbharat.haryana.gov.in/cchf/',
    state: 'reachable' as const,
    note: 'Haryana publishes PM-JAY district lists (used above) and a separate Cashless (CCHF) list; CCHF is not yet imported.',
  },
] as const;
