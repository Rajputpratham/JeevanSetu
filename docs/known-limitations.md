# Known limitations & how to finish the wiring

Everything in the three fixes (A/B/C) and the three features (schemes, cost
preview, bills) is implemented and reachable in the running app. What follows are
the **deliberate, honest gaps** — places where the software refuses to guess, and
the exact steps a maintainer must take to fill them.

## 1. Road distance & drive time (Problem A)

- The app routes **key-free** through an OSRM server and falls back to Google
  Routes only when `GOOGLE_MAPS_API_KEY` exists. `lib/osrm.ts` reads
  `OSRM_BASE_URL` (default `https://router.project-osrm.org`).
- **The public OSRM demo server is not a production backend.** It is rate-limited,
  has no SLA, and is explicitly documented by the OSRM project as a demo. Deploy
  your own OSRM instance (or a commercial key-free router) and point
  `OSRM_BASE_URL` at it before real traffic. Until then the route panel degrades to
  the compact "Road route unavailable" line plus a straight-line context figure and
  the Google Maps directions link — it never fabricates a distance or a drive time.
- From the build sandbox `router.project-osrm.org` was unreachable, so the happy
  path was verified against a local OSRM-compatible mock server that returns the
  real OSRM `routes[].distance/duration/geometry` shape. The `source: "osrm"`
  branch, disclosure, attribution and geometry rendering were all exercised that
  way, plus by unit tests in `tests/schemes-costs-bills.test.ts`.
- Duration is always labelled **"Estimated drive time"**. `liveTraffic` is only
  `true` when Google Routes actually returns traffic data; OSRM never does, and
  the UI says so instead of printing "Live traffic not returned" in a warning
  block.

## 2. Scheme empanelment coverage (Feature 1)

- Coverage is intentionally sparse. See `docs/data/scheme-empanelment.md`.
  A hospital without a record shows **"Not verified"**, which is correct: the
  absence of a record is never treated as "not empanelled".
- `hospitals.pmjay.gov.in`, `nha.gov.in`, `cghs.mohfw.gov.in` and the CGHS report
  pages were unreachable from this environment. Only Haryana's published district
  PDFs (via `cdnbbsr.s3waas.gov.in`) and Odisha's BSKY list could be read, so only
  those branches have records.
- **No CGHS record exists yet**, so every CGHS badge currently reads "Not
  verified". Add CGHS records from a consolidated OM when you can open one.

## 3. Treatment cost previews (Feature 2)

- `HOSPITAL_COSTS` in `data/hospital-costs.ts` is **empty**. This is a data gap,
  not a bug: no hospital tariff or official package amount has been extracted with
  a citable source yet. Every hospital therefore shows "Cost estimate unavailable"
  and never a number attributed to that hospital.
- **What must never happen** (enforced by tests): a figure is only shown when a
  record carries a real `amount`, `sourceLabel`, `sourceUrl`, `effectiveOn` and
  `lastCheckedOn`. Empanelment alone can never produce a ₹0 figure — the strongest
  claim it unlocks is *"Potentially covered — confirm eligibility and package with
  the hospital."*
- Generic national ranges are kept in a **separate, labelled block** behind a
  "Cost details" toggle, with a note that they are not this hospital's price.
- Community bill observations are shown as a **count of self-reported/verified
  reports**, never averaged into a "typical price".

## 4. Community bills & private uploads (Feature 3)

- **Storage is in-process memory** (`lib/review-bills.ts`). Records and uploaded
  files live in a module-scoped store: they survive within one server process and
  are lost on restart/redeploy, and are **not shared between serverless
  instances**. This is enough to demonstrate the full consent → moderation →
  label flow and to keep the privacy contract testable, but it is **not** durable
  storage.
- To make it production-durable you need:
  1. a database with row-level rules (insert = anyone, read = public columns only,
     update = reviewer role only, delete = reviewer role only);
  2. a private object store for the bill file, referenced by an opaque id that is
     never returned by a public endpoint;
  3. an authenticated reviewer surface that can flip a record to `bill_verified`
     only after opening the file and matching the amount.
- Uploads are capped at 3 MB (JPG/PNG/WebP/PDF), parsed as base64 in the request
  body and never returned by any API. The public payload strips the file name, the
  base64, phone numbers, e-mail addresses and long digit strings (redaction is
  best-effort, so the form asks the person to cover their name and IDs).
- Verification states: `self_reported` (no evidence) → `pending_verification`
  (file attached) → `bill_verified` (reviewer confirmed against the file) or
  `rejected_removed` (removed from public view; still visible to reviewers).
  A reviewer cannot reach `bill_verified` without
  `verifiedAgainstFile: true`, and the moderation endpoint requires
  `BILL_REVIEW_TOKEN`.
- Duplicate abuse: an identical (hospital, treatment, month, amount) submission is
  rejected with `DUPLICATE`. There is no per-user identity, so this is a
  content-level check only — a rate limiter covers request volume.
- Correction/removal: the public copy explains that reports can be corrected or
  deleted via `hello@jeevansetu.in`; `removeBill()` moves the record to
  `rejected_removed`.

## 5. Google rating (Problem C)

- Without a Places API key/credential, no rating is fetched, and nothing is
  scraped, estimated or relabelled. The large empty card is gone; a compact
  "View on Google Maps" link is shown instead.
- The community rating stays a separate, clearly-labelled JeevanSetu number.

## 6. Hospital photographs (Problem B)

- `HOSPITAL_PHOTOS` is empty: no branch has a licensed, branch-specific photo yet.
  Every hospital renders the neutral illustration with a "not a photograph"
  caption.
- A photo renders **only** if its record's `branchId` matches the hospital id and
  it carries rights/attribution and a source URL. Anything else is rejected at
  render time (`photoFor`), so a duplicated record cannot show another hospital's
  building.

## 7. Verification actually performed

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | 0 problems |
| `npm test` (`vitest run`) | 239 passed, 6 skipped |
| `npm run build` | success, 34 hospital pages prerendered |
| Live `curl` of `/api/schemes`, `/api/cost-preview`, `/api/route`, `/api/bills` | checked in the dev server |
| Real Chromium journeys | **not possible in this sandbox** — `npx playwright install chromium` fails to download (egress blocked) and the only available Chromium bundle is missing `libnss3`/`libnspr4`. Journeys are covered by jsdom component tests that render the real client components (`tests/journey-ui.test.tsx`) plus API-level tests (`tests/schemes-costs-bills.test.ts`). |
