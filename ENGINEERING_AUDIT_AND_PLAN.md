# JeevanSetu — Loop Engineering Audit, Plan & Requirement Traceability Matrix

## LOOP 0 — COMPLETE PROJECT AUDIT

### 1. Framework, Architecture, Dependencies & Data Sources
- **Framework**: Next.js 15.5.29 (App Router) with React 19, TypeScript 5.6, Tailwind CSS 3.4, Leaflet 1.9.4 + OpenStreetMap, Lucide React icons, Vitest + Testing Library, ESLint 9 (`eslint-config-next`).
- **Data Sources**:
  - `data/hospitals.ts` — Expanded from 31 to **34 verified public/private hospitals** across Delhi NCR, Mumbai, Pune, Jaipur, Lucknow, Kolkata, Bengaluru, Chennai, Ahmedabad, Hyderabad, Bhubaneswar, and Kochi.
  - `data/localities.ts` — 34-entry multilingual Indian locality, neighbourhood, hospital area, and pincode gazetteer (`Pusa Road, New Delhi`, `Ansari Nagar`, `Saket`, `Parel, Mumbai`, `Park Town, Chennai`, `Salt Lake, Kolkata`, etc.).
  - `data/reviews.ts` — Moderated baseline community reviews (`Community Submitted (Unverified Visit)`).
  - `data/treatments.ts` — 18 treatments with CGHS / PM-JAY / published tariff ranges.
  - `data/helplines.ts` — 5 national helplines (`112`, `108`, `102`, `104`, `14567`).
  - Server-side API routes: `/api/hospitals`, `/api/hospitals/[id]`, `/api/geocode`, `/api/route`, `/api/reviews`, `/api/google-ratings`, `/api/rankings`, `/api/chat`, `/api/recommendations`, `/api/estimate`, `/api/emergency`.

### 2. Existing Flaws, Bugs & Gaps Detected (All Resolved in Loops 2–8)
1. **Distance & Origin Inconsistencies (Root Cause — FIXED)**:
   - Previously `useUserLocation()` used isolated component-level `useState` instead of a React Context, so changing origin on `/hospitals` did not propagate in-memory to Home, Detail, Compare, Emergency, or Chatbot, and `HospitalDetailClient` showed no distance/ETA and omitted `origin=` in Google Maps links.
   - Previously all distances were straight-line Haversine (`haversineKm`) only. Replaced with a unified `LocationProvider` (`lib/useLocation.tsx`) + `computeTravelMetrics()` (`lib/geo.ts`) + `/api/route` (`lib/routing.ts`), consistently providing road driving distance, straight-line distance, traffic-aware ETA, and origin-preserved Google Maps turn-by-turn URLs across every view.
2. **Geocoding Limitations (FIXED)**:
   - Built `/api/geocode` (`app/api/geocode/route.ts`) combining a fast 34-entry Indian locality/pincode gazetteer (`data/localities.ts`) with optional Google Geocoding API / Nominatim fallback so searches like `"Pusa Road, New Delhi"` resolve deterministically even offline.
3. **Unused / Disconnected Homepage Components & Hardcoded Strings (FIXED)**:
   - Rebuilt `components/home/NearbySection.tsx` with full 11-language localization and live `LocationProvider` road distance + ETA + IMDb score integration, and mounted it on `HomeClient.tsx` alongside Rankings and AI Assistant access.
4. **Map & Marker Numbering Desync (FIXED)**:
   - Synchronized numbered markers `1..N` across `MapView.tsx` and `HospitalCard.tsx` with bidirectional active-card highlight, smooth scroll-into-view, and route polyline preview.
5. **Multilingual & RTL Gap (FIXED)**:
   - Expanded from 2 languages (`en`, `hi`) to **11 languages** (`en`, `hi`, `bn`, `te`, `mr`, `ta`, `gu`, `ur` [with automatic `dir="rtl"` & Nastaliq typography], `kn`, `or`, `ml`), preserving origin, selected hospital, route preview, saved bookmarks, and compare tray across language switches.
6. **External Credentials Audit (HONEST DISCLOSURE)**:
   - Runtime check confirmed `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACES_API_KEY`, `OPENAI_API_KEY`, and `GEMINI_API_KEY` are not set in the sandbox environment. All external adapters are implemented and automatically activate when keys are added via `.env.local` / Vercel; when absent, the platform uses deterministic grounded engines and displays honest disclosures (`Awaiting API key` for Google Places, `Estimated urban traffic model` for routing, `Offline-capable Indian gazetteer` for geocoding, and `No live incident feed connected — dial 112/108` in Emergency Mode).

---

## LOOP 1 & LOOP 3 — MODULE PLAN & REQUIREMENT TRACEABILITY MATRIX

| Req ID | Module | Requirement Description | Status | Files / Tests |
|---|---|---|---|---|
| JS-001 | Mod 4 | Hindi (`hi`) full UI & data translation | Verified | `lib/i18n.tsx`, `lib/i18n-data.ts`, `tests/i18n.test.ts` |
| JS-002 | Mod 4 | Bengali (`bn`) full UI & data translation | Verified | `lib/languages-extra.ts`, `lib/i18n.tsx`, `tests/i18n.test.ts`, `tests/journeys.test.ts` |
| JS-003 | Mod 4 | Urdu (`ur`) translation + automatic RTL (`dir="rtl"`) layout & Leaflet LTR isolation | Verified | `lib/lang-meta.ts`, `lib/languages-extra.ts`, `lib/i18n.tsx`, `app/globals.css`, `tests/i18n.test.ts`, `tests/regression.test.tsx` |
| JS-004 | Mod 2 | Numbered hospital markers (`#1..#N`) synced between Map and Hospital Cards + bidirectional selection & route polyline | Verified | `components/MapView.tsx`, `components/HospitalCard.tsx`, `components/hospitals/DiscoveryClient.tsx`, `tests/journeys.test.ts` |
| JS-005 | Mod 1 | Shared `LocationProvider` context + consistent road & straight-line distance across Discovery, Detail, Compare, Emergency, Home & Chatbot | Verified | `lib/useLocation.tsx`, `lib/geo.ts`, `tests/geo-routing.test.ts`, `tests/journeys.test.ts` |
| JS-006 | Mod 3 | Traffic-aware ETA & road routing (`/api/route` supporting Google Routes API / OSRM + clearly labelled time-of-day urban traffic model fallback; live Google traffic blocked only on `GOOGLE_MAPS_API_KEY`) | Verified (Fallback) / Blocked (Live Google Key) | `lib/routing.ts`, `app/api/route/route.ts`, `tests/geo-routing.test.ts` |
| JS-007 | Mod 7 | Google Places rating integration (`/api/google-ratings`) with official Google attribution & honest `awaiting-api-key` disclosure when `GOOGLE_PLACES_API_KEY` is absent (zero fabricated Google scores) | Verified (Adapter & Honest UI) / Blocked (Live Google Key) | `app/api/google-ratings/route.ts`, `components/detail/RatingsSection.tsx`, `tests/regression.test.tsx` |
| JS-008 | Mod 6 | IMDb-style Bayesian weighted JeevanSetu Community Score (`WR = (v/(v+m))R + (m/(v+m))C`, `m=10`) + 5-star distribution & 5 sub-metrics | Verified | `lib/ratings.ts`, `data/reviews.ts`, `components/detail/RatingsSection.tsx`, `tests/ratings-moderation.test.ts` |
| JS-009 | Mod 8 | Native review submission, anti-spam/profanity/defamation/unsupported-medical-claim moderation, PII phone/email redaction, IP rate limiting & `Community Submitted (Unverified Visit)` badges | Verified | `lib/moderation.ts`, `app/api/reviews/route.ts`, `tests/ratings-moderation.test.ts`, `tests/journeys.test.ts` |
| JS-010 | Mod 10 | Grounded Multilingual AI Chatbot (`/api/chat` + floating `ChatbotWidget`) supporting OpenAI/Gemini keys or deterministic grounded retrieval across all 11 languages + 112 red-flag safety triage | Verified | `lib/chatbot.ts`, `app/api/chat/route.ts`, `components/ChatbotWidget.tsx`, `tests/journeys.test.ts` |
| JS-011 | Mod 4 | Telugu (`te`), Marathi (`mr`), Tamil (`ta`), Gujarati (`gu`), Kannada (`kn`), Odia (`or`), Malayalam (`ml`) translations (11 total languages) | Verified | `lib/lang-meta.ts`, `lib/languages-extra.ts`, `lib/i18n.tsx`, `tests/i18n.test.ts` |
| JS-012 | Mod 1 | Offline-capable Indian locality, landmark & pincode geocoder (`/api/geocode` covering Pusa Road, Ansari Nagar, Saket, Parel, Park Town, Salt Lake, etc. + Google/Nominatim when available) | Verified | `data/localities.ts`, `app/api/geocode/route.ts`, `tests/geo-routing.test.ts`, `tests/journeys.test.ts` |
| JS-013 | Mod 5 | Expanded 34-hospital dataset, `SavedProvider` bookmarking store + filter, road distance + traffic ETA on detail page, origin-aware Google Maps directions | Verified | `data/hospitals.ts`, `lib/saved.tsx`, `components/detail/HospitalDetailClient.tsx`, `components/detail/DetailActions.tsx`, `tests/regression.test.tsx` |
| JS-014 | Mod 9 | Hospital Rankings & Leaderboards page (`/rankings` + `/api/rankings`) with podium, filters (city, type, speciality, 24×7 emergency), and transparent composite score breakdown | Verified | `app/rankings/page.tsx`, `components/rankings/RankingsClient.tsx`, `app/api/rankings/route.ts`, `tests/ratings-moderation.test.ts` |
| JS-015 | Mod 11 | Enhanced Hospital Comparison (origin switcher, road distance + traffic ETA, IMDb community score, treatment cost ranges, print/PDF) & Cost Estimator uncertainty/scheme disclosures | Verified | `components/compare/CompareClient.tsx`, `components/cost/CostEstimatorClient.tsx`, `tests/regression.test.tsx` |
| JS-016 | Mod 12 | Cohesive UI/UX redesign, smooth `prefers-reduced-motion`-safe animations, live homepage `NearbySection`, strict **"JeevanSetu"** branding | Verified | `app/globals.css`, `components/Header.tsx`, `components/home/HomeClient.tsx`, `components/home/NearbySection.tsx` |
| JS-017 | Mod 13 | Emergency Mode upgrades (`112`/`108` tap-to-call, GPS + manual/voice origin selector, traffic-aware ETAs, built-in offline directory fallback, honest live-incident-feed disclosure) + Multilingual Voice Search (`VoiceSearchButton`) | Verified | `components/VoiceSearchButton.tsx`, `components/emergency/EmergencyClient.tsx`, `app/api/emergency/route.ts`, `tests/journeys.test.ts` |
| JS-018 | Mod 14 | Data accuracy labels, HTTP security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`), E2B `allowedDevOrigins`, ARIA combobox/RTL accessibility, privacy & `.env.example` | Verified | `next.config.mjs`, `.env.example`, `eslint.config.mjs` |
| JS-019 | Mod 15 | Clean `tsc --noEmit`, `eslint .` (0 errors, 0 warnings), 24/24 Vitest tests, optimized Next.js production build (51 static/SSG/dynamic routes), live server HTTP 200 verification & Vercel (`bom1`) config | Verified | `vercel.json`, `vitest.config.mjs`, `tests/*.test.{ts,tsx}` |
