# JeevanSetu — Connecting People to Better Healthcare

JeevanSetu is a free, rural-first healthcare discovery and assistance platform for India. It helps families answer six questions:

1. **Where is the nearest hospital?** — location-aware discovery with map + list views (`/hospitals`)
2. **Which hospital suits my needs?** — speciality, budget and facility-aware recommendations (`/recommendations`)
3. **How much might treatment cost?** — itemised ₹ estimator, government vs private (`/cost-estimator`)
4. **Which hospital is the better choice?** — side-by-side comparison, up to 3 hospitals (`/compare`)
5. **What does a particular hospital offer?** — detailed pages with honestly labelled data (`/hospitals/[id]`)
6. **Where do I get emergency help?** — verified 24×7 emergency hospitals + national 112 helpline (`/emergency`)

No sign-up. Works on low-end Android phones.

## Languages

The whole UI — navigation, filters, hospital pages, the cost estimator and the AI assistant — is available in **11 languages**: English (EN), Hindi (हिन्दी), Bengali (বাংলা), Telugu (తెలుగు), Marathi (मराठी), Tamil (தமிழ்), Gujarati (ગુજરાતી), Urdu (اردو, right-to-left), Kannada (ಕನ್ನಡ), Odia (ଓଡ଼ିଆ) and Malayalam (മലയാളം).

Language codes, native names, script direction and speech-recognition locales live in `lib/lang-meta.ts`; translations are in `lib/i18n-data.ts` + `lib/languages-extra.ts`. The selected language is applied to Google Routes requests too, so road names and traffic phrases come back in the user's language (`/api/travel?lang=ta` → `languageCode: ta-IN`).

## AI Assistant (`GEMINI_API_KEY`)

`/api/assistant` powers the in-app assistant (bottom-right launcher). It is **grounded and gated**, not a free-form chatbot:

- A deterministic intent layer (`lib/assistant/intent.ts`) decides what the turn is allowed to do — greetings never trigger hospital search, and prescription/real-time-bed questions are refused.
- Only the tools that intent permits run, and every figure shown (distance, ETA, cost range, rating) comes from JeevanSetu data or the Google Routes API — never from the model.
- Gemini (`GEMINI_API_KEY`, model via `GEMINI_TEXT_MODEL`) only **phrases** the grounded answer. Without the key the assistant still answers correctly from the rule engine and reports `groundingMode: "deterministic-grounded"` plus an explicit blocker, instead of failing.
- Voice input uses the browser's speech recognition; no microphone audio is sent to JeevanSetu servers.

## Community reviews (`/api/reviews`)

Every hospital page accepts community reviews with per-aspect ratings (doctor care, cleanliness, wait time, billing transparency) and an overall 1–5 score.

- Submissions are screened by `lib/moderation.ts` before storage: HTML is stripped, mobile numbers are redacted, spam links/profanity/miracle-cure claims are rejected (`422`), and duplicates per hospital are blocked.
- The displayed **Community Score** is an IMDb-style Bayesian weighted average (`lib/ratings.ts`) — hospitals with too few reviews show no score rather than a misleading one. Reviews are labelled **community-unverified** and are experience reports, not clinical audits.
- Review submission is rate limited to 4 per minute per IP (`429` otherwise).

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Google Maps / Places / Routes (optional; see `.env.example`) · Gemini (optional) · data shipped as typed in-repo datasets (`data/hospitals.ts`, `data/treatments.ts`) behind server-side API routes (`/api/hospitals`, `/api/recommendations`, `/api/estimate`, `/api/emergency`, `/api/travel`, `/api/assistant`, …).

### API limits and caching

Public endpoints that can spend third-party quota are rate limited per caller by `lib/rate-limit.ts` (sliding 60-second window, independent bucket per endpoint, `429` + `Retry-After` when exceeded):

| Endpoint | Limit / minute | Why |
| --- | --- | --- |
| `POST /api/assistant` | 20 | Each turn can call the paid Gemini API |
| `POST /api/reviews` | 4 | User-generated content |
| `GET /api/geocode` | 60 | Debounced address search (Google Geocoding / Nominatim) |
| `GET /api/travel` | 60 | Google Routes lookups |
| `GET /api/google-ratings` | 30 | Google Places Find-Place + Details |

Expensive upstream answers are also cached server-side: Routes snapshots for 60 s (`lib/travel-cache.ts`) and Places ratings for 10 minutes per hospital (`app/api/google-ratings/route.ts`), both on the shared TTL cache in `lib/server-cache.ts`. Repeated page loads therefore do not re-bill Google, and transient upstream failures are never cached.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve production build
```

Everything is optional, including API keys: without them the app still runs and tells you what is missing (see `.env.example`).

## Verify

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm test           # vitest run (unit + API route handler contracts)
npm run test:watch # vitest in watch mode
```

`npm test` needs no keys and no network: the suite covers the routing/travel maths, i18n, accessibility, moderation and the exported API route handlers (input validation, `400`/`404`/`422`/`429`, rate limiting, and degraded behaviour when keys are absent or Google answers non-2xx). Live Google verification (`tests/travel-live.test.ts`) runs only when `GOOGLE_MAPS_API_KEY` is set, and skips itself loudly otherwise.

CI runs `npm ci`, `npm run typecheck`, `npm run lint` and `npm test` on every push and pull request to `main` (`.github/workflows/ci.yml`), with **no** API keys, so a regression that invents a distance, ETA or rating fails the build.

### Browser QA (Playwright)

The scripts in `scripts/` drive a real headless Chromium against a locally running instance — they are end-to-end UI checks and are **not** part of `npm test`:

```bash
npx playwright install chromium   # once, if Playwright's browser is not present
npm run dev                       # in another terminal; scripts target http://localhost:3000

npm run qa:browser                # 65 responsive-viewport overflow checks + screenshots/docs/qa/layout.json
npm run qa:failures               # denied/timed-out geolocation, manual origin, language switching, 320px nav
npm run qa:history                # back/forward state, compare add/duplicate limits, print layout
npm run qa                        # all three, in order
```

`qa:failures` uses mock permissions and never submits a review or opens a call, mail or map app. Both scripts honour `CHROME_PATH` (existing Chromium binary) and `CHROME_ARGS` (JSON array of launch flags), so they work in sandboxes without Playwright's own browser download.

## Honesty policy

- Hospital names/addresses are from public listings. Verification status is shown per field: **Verified / Unverified / Not listed**.
- Cost figures are indicative ranges compiled from public CGHS / PM-JAY / state-scheme / published-tariff references. They are **not quotes**. Missing pricing data is shown as “not available”, never invented.
- Driving distance and ETA come only from the Google Routes API; when it is unavailable the UI says so instead of showing a straight-line guess as a road distance.
- Google ratings/reviews are shown only when the Places API answers; otherwise the page links to Google Maps directly.
- JeevanSetu is not medical advice. In an emergency call **112**.

See `/disclaimer` in the app for full sourcing and `/privacy` for data handling.

## Verification and integration status

See [the implementation handoff](docs/qa/HANDOFF.md) for the route matrix, local browser regression commands, screenshots, mobile performance measurement and outstanding release checks.
