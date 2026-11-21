# Scheme empanelment data — import & admin process

This document describes how the scheme badges on JeevanSetu cards and detail pages
get their data, and the rules the data must satisfy before a badge is shown.

> **Never edit a badge by hand-editing UI copy.** Every badge is derived from a
> record in `data/scheme-empanelment.ts`. If a record is missing, the UI says
> **"Not verified"** — that is the correct, honest state, not a bug.

## 1. What a badge may claim

| Status | Meaning | Label (EN / HI) |
| --- | --- | --- |
| `verified_empanelled` | A **current** official list names **this exact branch** | Verified empanelled / सत्यापित — सूची में शामिल |
| `verified_not_empanelled` | A **complete** official list for that **city/district** was read and does **not** name this branch | Verified not empanelled / सत्यापित — सूची में नहीं |
| `unverified` | No usable evidence, or the evidence is stale/incomplete | Not verified / सत्यापित नहीं |

Hard rules enforced in `lib/schemes.ts` and covered by
`tests/schemes-costs-bills.test.ts`:

1. **"Ayushman card accepted here"** requires `verified_empanelled` for PM-JAY on
   the exact branch, and the record must not be stale. Nothing else may produce it.
2. `verified_not_empanelled` additionally requires
   `sourceCompleteForCity: true`. A partial list (one hospital group, one PDF page
   that was only partly readable) can never produce a negative claim; it degrades
   to `unverified`.
3. Records with `matchConfidence !== 'exact-branch'` never produce
   `verified_empanelled`.
4. Any record older than **12 months** (`lastCheckedOn`) is treated as
   `unverified` and flagged `stale` in the UI.
5. A group/brand listing (e.g. "Fortis" in a state list) is **never** copied onto
   every branch of that brand — each branch needs its own record.
6. Empanelment is **not** coverage. The UI always shows the caveat that
   empanelment does not guarantee eligibility, that this treatment is covered, or
   that you will pay nothing.

## 2. Record shape

```ts
{
  hospitalId: 'medanta-medicity',       // must exist in data/hospitals.ts
  scheme: 'pmjay',                       // pmjay | cghs | delhi-arogya-kosh | haryana-chirayu | state-other
  status: 'verified_not_empanelled',
  authority: 'Ayushman Bharat Haryana — State Health Agency (PM-JAY)',
  sourceUrl: 'https://…/20260804420926830.pdf',   // the exact document read
  officialRecordId: 'District list 03/08/2026 · HOSP6G/HOSP6P', // citable id, or null
  effectiveOn: '2026-08-03',             // date the document speaks about
  lastCheckedOn: '2026-11-21',           // date WE read it (drives staleness)
  validityNote: '…',                     // how long the document stays valid
  matchConfidence: 'exact-branch',
  sourceCompleteForCity: true,           // required for a negative claim
  evidenceNote: '…',                     // what exactly was read, verbatim enough to audit
  caveat: '…',                           // optional: what limits the claim
}
```

`lastCheckedOn` must be the date a human actually opened the document. Back-dating
it defeats the staleness rule and is not permitted.

## 3. Import procedure

1. **Locate the authoritative list.** Only official sources count: NHA/PM-JAY
   state portals, the state health agency, CGHS OMs, or the state scheme portal.
   Third-party directories are leads, never evidence.
2. **Confirm scope.** District lists are district-scoped. Note the district and
   the "as on" date in `validityNote`. National/live locator > state list >
   district PDF, in that order of preference.
3. **Match on the exact branch.** Compare facility name **and** address/ID. Two
   branches of the same brand are different facilities. If you cannot confirm
   the branch, do not write a record.
4. **Negative claims.** Only write `verified_not_empanelled` if you read the
   **entire** list for that city/district and searched for the name and its
   common aliases. Set `sourceCompleteForCity: true` and say so in `evidence`.
5. **Record the citation.** Paste the exact URL of the document (not the portal
   landing page) and the official record ID/serial where one exists.
6. **Write the record** in `data/scheme-empanelment.ts`, keeping the file sorted by
   `hospitalId`, then `scheme`.
7. **Run the checks:** `npm test` (scheme suite), `npm run lint`, `npm run
   typecheck`. Then load the detail page and confirm the badge, its evidence
   panel and the report link.

## 4. Review cadence

- Re-check every record whose `lastCheckedOn` is older than 90 days when touching
  the file; the app tolerates up to 12 months before downgrading a badge.
- PM-JAY district lists in Haryana are re-published wholesale (currently dated
  *03/08/2026 onwards*). When a new list appears, treat every record sourced from
  the previous list as due for re-verification.
- CGHS publishes consolidated OMs with explicit validity windows; store the
  window in `validityNote` and re-verify at least a month before it lapses.

## 5. Corrections and abuse

- The detail page offers **"Report an incorrect badge"**, a `mailto:` to
  `hello@jeevansetu.in` pre-filled with the hospital and scheme.
- On a credible report, **remove the record** (which immediately returns the badge
  to "Not verified") rather than arguing in the UI. Re-add only with fresh
  evidence.

## 6. Current provenance (as shipped)

- `state-other` records name a different state scheme explicitly (e.g. Odisha BSKY
  for AIIMS Bhubaneswar). They are evidence of **that** scheme only and are never
  rendered as PM-JAY/CGHS coverage.
- PM-JAY / Haryana: state portal `ayushmanbharat.haryana.gov.in/pm-jay/`, district
  PDFs on `cdnbbsr.s3waas.gov.in`. Only the **Gurugram** list has been read into
  the dataset so far; every other branch is `unverified`.
- CGHS, Delhi Arogya Kosh, Haryana Chirayu: **no verified records yet** — all
  branches show "Not verified". The NHA/PM-JAY/CGHS hosts were unreachable from
  the build environment (`HTTP 500`/TLS failure), so no record was written from a
  source that could not be opened.

## 7. Known gaps

- Coverage is sparse by design: only records that were actually read exist. Most
  hospitals legitimately show "Not verified".
- No automated crawler: parsing is deliberately manual, because a mis-parsed
  hospital name would produce a false claim about a person's healthcare cost.
- District scoping means a branch outside the read district cannot be marked
  "not empanelled" even if it is absent from that PDF.
