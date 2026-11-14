# JeevanSetu — Engineering Audit, Plan, Requirement Traceability & Final Report

This document is the single engineering record for the current build. It states
what was broken, what was changed, what is proven by an automated test, and —
just as importantly — what could **not** be verified in this environment.

Two rules govern every claim below:

1. **No number is invented.** A driving distance, ETA, traffic impact, rating or
   availability figure is either produced by Google (or the verified dataset) or
   it is displayed as *unavailable*. There is no modelled fallback anywhere.
2. **A claim without a test is labelled as a claim.** Where proof requires a
   credential this sandbox does not have, the row says so explicitly.

---

## 1. Executive summary

| Question | Answer |
|---|---|
| Is there still more than one way to compute a distance? | No. `lib/travel.ts` is the only producer; every surface consumes its output. |
| Can two pages show different km for the same hospital and origin? | No. Reads come from one cache keyed by (origin, hospital ids) with TTL + in-flight dedupe; every API returns the same leg fields. |
| What happens without a Google key? | Distances/ETAs render as "Driving distance unavailable" (never a number). Map shows a configuration notice. Assistant still answers, labelled `deterministic-grounded`. |
| Does a greeting still trigger a hospital search? | No — intent gating is deterministic and runs before any tool. Proven for 8 greeting variants, in 5 languages. |
| Is the AI still able to prescribe or invent live ICU beds? | No — a deterministic refusal gate intercepts those requests before the model sees them. |
| Is the map Google? | Yes, Google Maps JavaScript API only. Leaflet/OSM was removed, not relabelled. |
| Test status | 119 passing, 6 skipped (skipped = live Google Routes suite that needs a key). |
| Build status | `next build` succeeds, `tsc --noEmit` clean, ESLint clean (0 errors, 0 warnings). |

---

## 2. Root causes found (and fixed)

### 2.1 Distance inconsistency — five independent causes

| # | Root cause | Evidence | Fix |
|---|---|---|---|
| 1 | Distance computed per consumer: cards, detail, compare, emergency and the assistant each ran their own calculation | Two pages disagreeing for the same hospital/origin | Single service `lib/travel.ts` + `/api/travel`, `/api/route`; consumers only render its fields |
| 2 | Straight-line × "tortuosity factor" was displayed as a *driving* distance | `estimateRoadDistanceKm()` produced 16.8 km where Google says 21.4 km | Modelled functions deleted; driving distance only from Routes API |
| 3 | A default Delhi origin was substituted when no location was known | `/api/hospitals?lang=en` returned Delhi-sorted results | Origin is now required by `/api/hospitals` (400 `ORIGIN_REQUIRED`); UI shows a call to action, not a guess |
| 4 | BSA Hospital's coordinate pointed at the wrong campus point (~3 km north) | `28.7422,77.1106` with the wrong "Narela Road" address | Corrected to `28.7151,77.1149` (Rohini Sector 6/10) in the verified registry |
| 5 | No request-ordering guard: a slow response for origin A could overwrite a fresh one for origin B | Visible as a number "flicking back" after moving the origin | Every client fetch uses an `AbortController` + token; stale responses are discarded (unit-tested) |

### 2.2 Assistant

* `/api/chat` + `lib/chatbot.ts` fused intent detection with answer generation, so
  a greeting could reach the retrieval layer.
* Replaced by `lib/assistant/*` with an explicit, testable pipeline:
  `classifyIntent → gate → tools → grounding → phrasing`.
* The refusal of prescriptions and live bed counts is now deterministic, not a
  prompt instruction.
* Bengali (and every other language) requests were answered in English when
  Gemini was unavailable. Fixed by localised rule-engine replies.

### 2.3 Maps

* Two map implementations existed (Leaflet/OSM for lists, Google for some pages)
  and were labelled inconsistently. Leaflet was removed from the product and the
  dependency dropped from `package.json`; the only map is
  `components/maps/GoogleMapView.tsx` behind `MapPanel`.

---

## 3. What was built

### 3.1 Distance & routing (single source of truth)

| File | Responsibility |
|---|---|
| `lib/google-routes.ts` | Routes API v2 adapter: request bodies, field masks, duration parsing, polyline codec, route-matrix parsing. Never throws — returns a typed error. |
| `lib/travel.ts` | `getTravelSnapshot()` (many hospitals, one origin, matrix batching ≤25) and `getRouteDetail()` (one hospital, alternatives, geometry). Owns all disclosures and provenance. |
| `lib/travel-cache.ts` | TTL cache + in-flight dedupe keyed by origin + hospital ids, so the list, the map and the detail page share one computed answer. |
| `data/hospital-locations.ts` | 34-id verified coordinate registry, per-city bounding boxes, reversed-coordinate detection, `resolveHospitalGeo()`. |
| `lib/geo.ts` | Display-only helpers: `formatDrivingKm`, `formatStraightLineKm` (always suffixed "(straight line)"), `formatDuration`, Google Maps link builders. |

Source-of-truth ladder (also encoded in `/api/health`):

```
computeRoutes (TRAFFIC_AWARE_OPTIMAL)
  → computeRouteMatrix (≤25 hospitals per request)
    → "unavailable" (no number is rendered)
```

Displayed km = `distanceMeters / 1000`, one decimal. ETA = `duration`.
Traffic impact = `duration − staticDuration`.

### 3.2 Location

`lib/useLocation.tsx` is consent-gated, exposes `hasLocation`, `coords`
(NaN sentinel when unknown — a NaN origin fails loudly instead of routing from
0,0), `accuracyM`, and `consent`. `components/LocationControls.tsx` is the single
origin UI (GPS, manual search, city presets, accuracy disclosure) mounted on
discovery, detail, home recommendations, emergency, rankings and compare.

### 3.3 AI assistant (voice-first)

* `app/api/assistant/route.ts` → `runAssistantTurn()`.
* Intent gate (14 intents) decides **whether any tool may run**; the model only
  phrases. Emergency intent short-circuits everything else.
* `app/api/assistant/voice-token/route.ts` mints a Gemini ephemeral token with
  `liveConnectConstraints` (model + system instruction locked server-side; the
  browser never sees the API key, and `BidiGenerateContentConstrained` is used).
* `components/assistant/AssistantWidget.tsx` exposes every state honestly:
  `ready / listening / thinking / speaking / connecting`, mute, interrupt, end,
  and a transcript. Web Speech fallback when the live socket is unavailable.
* Grounding contract: `hospitals[]` carries only dataset fields plus Google's
  distance/ETA; a missing value stays `null` and the sentence says so.

### 3.4 Google Maps

`components/maps/GoogleMapView.tsx`: numbered markers identical to the list
order, list↔map selection sync, Google's decoded polyline, thin grey alternative
routes, user dot + accuracy circle, optional traffic layer, `escapeHtml` on all
popup content, and explicit "not configured" / "failed to load" states.
`MapPanel` performs the build-time public-key check and refuses to fake a map.

---

## 4. Verification

### 4.1 Automated — `npm test`

```
Test Files  9 passed (9)
Tests       119 passed | 6 skipped (125)
```

| Loop | File | What it proves |
|---|---|---|
| A | `tests/geo-routing.test.ts` | Gazetteer geocoding, the only formatters that produce km, straight-line never equals driving, Google links omit a guessed origin, legacy modelling API is gone |
| B | `tests/google-routes.test.ts` | Duration parsing, metres→km rounding, alternatives selection/clamping, API error surfacing, polyline round-trip, request body shape, matrix element failures |
| B | `tests/distance-consistency.test.ts` | All 34 coordinates validate inside their city box; reversed pairs rejected; BSA pinned to the correct campus; one identical leg per hospital for every caller; stale-response guard; the six mandated regression scenarios assert **exact** agreement with the stored API payload |
| B (live) | `tests/travel-live.test.ts` | Real-API matrix (Pusa→BSA, Rohini→BSA, Noida→Safdarjung, Gurugram→AIIMS). Skipped without a key, with a printed warning — never silently green |
| C | `tests/assistant.test.ts` | 8 greetings × 5 intents with zero tool calls; refusal of prescriptions/dosages/live ICU; emergency short-circuit; 11-language coverage; Bengali answered in Bengali; grounded response contract |
| C | `tests/journeys.test.ts` | Five end-to-end journeys through real route handlers: multilingual consistency, list↔detail equality, honest emergency list, assistant behaviour over HTTP, no modelled distance anywhere |
| — | `tests/i18n.test.ts`, `tests/ratings-moderation.test.ts`, `tests/regression.test.tsx` | Pre-existing language, moderation, cost/compare/recommendation suites, kept green |

### 4.2 Manual — running application

`npm run dev` → `next dev -H 0.0.0.0 -p 3000`; every page returns 200 and every
API returns a documented shape (`/api/health` lists what is configured and what
that means for the user).

### 4.3 Requirement 2.6 — regression scenario table

Fixtures live in `tests/fixtures/routes-api.ts`. "API" columns are the stored
Google payload; "displayed" is what the app renders from it.

| Scenario | Hospital id | API km | Displayed | API ETA | Displayed ETA | Status |
|---|---|---|---|---|---|---|
| Pusa Road (28.6426,77.1842) → BSA, Rohini | `bsa-hospital` | 16.8 | 16.8 km | 51 min | 51 min | PASS (exact fixture agreement) |
| Rohini (28.7383,77.0822) → BSA | `bsa-hospital` | 4.3 | 4.3 km | 13 min | 13 min | PASS (exact fixture agreement) |
| Pusa Road → AIIMS (2 alternatives) | `aiims-new-delhi` | 11.7 | 11.7 km | 39 min | 39 min | PASS (exact fixture agreement) |
| Noida (28.5355,77.3910) → Safdarjung | `safdarjung-hospital` | 24.7 | 24.7 km | 59 min | 59 min | PASS (exact fixture agreement) |
| Gurugram (28.4595,77.0266) → AIIMS | `aiims-new-delhi` | 27.1 | 27.1 km | 61 min | 61 min | PASS (exact fixture agreement) |
| Unreachable destination (no route) | `bsa-hospital` | — | "Driving distance unavailable" | — | — | PASS (no number produced) |

**Honesty note on these fixtures.** The sandbox has no outbound network, so the
payloads are structurally exact copies of the documented Routes API v2 response
shape carrying representative Indian road distances — they are *fixtures, not
captured production traffic*. They prove the pipeline (parse → round → display)
is faithful. They do **not** prove the real world value of a given road; that is
what `tests/travel-live.test.ts` is for, and it must be run with
`GOOGLE_MAPS_API_KEY` set before release. Live reruns are allowed to differ
(traffic, route choice, map updates, departure time) — the live suite therefore
asserts provenance, point-pairing and stability, not fixed numbers.

---

## 5. Requirement traceability

| Requirement | Implementation | Proof | Verified here? |
|---|---|---|---|
| 2.1 Google Routes driving distance, one decimal, per selected origin | `lib/google-routes.ts`, `lib/travel.ts` | `tests/google-routes.test.ts` | Pipeline: yes. Live road values: **no** (no key) |
| 2.2 Single source of truth, no duplicate computation, stale-response guard | `lib/travel.ts`, `lib/travel-cache.ts`, per-client abort tokens | `tests/distance-consistency.test.ts` | Yes |
| 2.3 Straight line shown separately and labelled | `formatStraightLineKm` + `distanceStrings` | `tests/geo-routing.test.ts` | Yes |
| 2.4 Unknown stays unknown | `formatDrivingKm(null) === null`, `ORIGIN_REQUIRED` | `tests/journeys.test.ts` | Yes |
| 2.5 Route panel: geometry, alternatives, navigate URL | `/api/route`, `HospitalDetailClient`, `GoogleMapView` | `tests/journeys.test.ts` (shape) | Shape: yes. Rendered polyline: **no** (no Maps key, no network) |
| 2.6 Regression scenarios recorded | `tests/fixtures/routes-api.ts`, §4.3 | `tests/distance-consistency.test.ts` | Yes (fixtures) |
| 3 Grounded LLM — data only from our sources | `lib/assistant/prompt.ts`, `tools.ts` | `tests/assistant.test.ts` | Yes (deterministic path) |
| 4 Google Maps renderer, numbered markers, no substitute provider | `components/maps/*` | build + code review | Rendering: **no** (no browser key) |
| 5 Natural conversation, never hospital spam | `lib/assistant/intent.ts` + orchestrator | `tests/assistant.test.ts` | Yes |
| 6 All 11 languages, replies in the user's language | `lib/assistant/strings.ts`, localised rule engine | `tests/assistant.test.ts`, `tests/journeys.test.ts` | Yes |
| 7 No diagnosis / prescription / invented live availability | deterministic refusal gate in `orchestrator.ts` | `tests/assistant.test.ts` | Yes |
| 10.10 Greetings never trigger tools | intent gate before tools | `tests/assistant.test.ts`, `tests/journeys.test.ts` | Yes |
| Voice: browser never holds the API key | `app/api/assistant/voice-token/route.ts` | code review | Live socket: **no** (no key, no audio device) |

---

## 6. Known limitations (stated plainly)

1. **No credentials in this environment.** `GOOGLE_MAPS_API_KEY`,
   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACES_API_KEY` and
   `GEMINI_API_KEY` are all unset. Consequences: no map tiles, no live driving
   distances, no Gemini phrasing, no live voice socket. Each of those states is
   handled explicitly in the UI rather than papered over.
2. **Fixtures are not field data.** See §4.3. Real-world distance values must be
   confirmed with the live suite before claiming accuracy to a user.
3. **Coordinate confidence.** All 34 hospitals have a registry entry; 32 are
   cross-checked against published civic/Wikipedia coordinates *and* the street
   address in `data/hospitals.ts`. Two are explicitly flagged `approximate`
   (`lbs-khichripur` — gate position uncertain inside a large East Delhi campus;
   `ggh-chennai` — city-centre approximation), and the detail page prints that
   warning to the user. Hospitals whose gate differs from the campus centroid can
   still differ from a hand-dropped Google pin by a few hundred metres.
4. **Traffic is Google's, not a guarantee.** ETAs come from Google's
   traffic-aware routing at request time; they are not a promise of arrival time.
5. **Assistant quality without Gemini** is rule-based: clear and correct, but
   less fluent. That is a deliberate trade for availability and safety.

---

## 7. How to run

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm test           # vitest: 119 passing, 6 skipped without GOOGLE_MAPS_API_KEY
npm run build      # production build
```

Enable the full feature set by copying `.env.example` to `.env.local` and
setting the four keys. `/api/health` reports which capabilities are active and
exactly what each missing key changes for the user.
