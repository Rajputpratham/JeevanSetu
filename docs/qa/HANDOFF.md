# JeevanSetu · implementation and release checks

**19 November 2026 · local production build, no provider credentials.** This is a verified set of improvements, not certification that every requested language, medical reference or live integration is release-ready.

[Before: homepage](before.jpg) · [After: homepage](after.jpg) · [Viewport results](layout.json) · [Performance conditions and measurements](performance.json)

## Baseline and diagnoses

The deployed URL could not be reached from the sandbox (TLS connection failed). The baseline was reproduced in Chromium against the unmodified checkout. AIIMS discovery stalled at “… hospitals found”; the UI skipped fetching and the API rejected requests without coordinates. The detail map displayed the browser key name. The review data file contained authored `isDemoSeed` records, not verified visits. Emergency's directory fallback sets every road distance and ETA to null; the “local road/ETA estimates” notice described calculations that did not exist.

## Completion matrix

Status applies to the **named test**, not every possible state of the route.

|Priority / route|Problem → expected behaviour|Implementation|Verification / status|
|---|---|---|---|
|P0 · `/hospitals`|No origin blocks browsing → return directory records, never guess distance|Optional, validated coordinate pair; skip travel provider without origin; cancellable, bounded, debounced fetches. Filters, removable chips and shareable URL state.|**Passed:** AIIMS, एम्स, aims, no match, ownership + query, reset, reload. Back initially lost sorting due to cached route props; restored history entry on mount and retested Back/Forward.|
|P0 · detail / rankings|Synthetic accounts influence score → use actual eligible reports only|Moved seeds to test fixtures; empty runtime store; exclude flagged demo records from prior and score. Require explicit review ratings. Explain composite and prior separately from clinical outcomes.|**Passed:** AIIMS without seeded score or provider setup notice; unit arithmetic/moderation tests. **Open:** review storage and rate limiting remain per server instance; not durable, shared moderation.|
|P0 · emergency|No location falsely implies network outage/local road ETAs → show usable static directory and 112|Corrected status, removed substitute hospital call action, retained emergency dial link and no invented routing.|**Passed:** directory and 112 link with no origin. No phone call made. **Open:** current regional helplines and all first-aid instructions need authoritative review.|
|P0 · recommendations|Required facilities acted as bonuses → enforce every requirement|Hard facility intersection, honest no-match message, red-flag escalation ahead of ordinary results, optional origin.|**Passed:** missing input, no matching facility combination, heart-attack escalation, direct API tests. Not diagnostic triage.|
|P0 · estimator|Invalid inputs silently priced; guarantees overstated → validate, show assumptions|Reject invalid API inputs, bound integer nights, cancel stale calculations, retain category-only tariff explanation, qualify scheme notes.|**Passed:** change delivery stay 1→2 nights; updated room line and total, API/unit tests, result visible in print media. **Open:** historic 2023–25 component estimates are not newly verified tariffs; package inclusions, missing values and scheme applicability need primary-source audit.|
|P0 · privacy / about / disclaimer|Server and third-party flows contradicted copy → explain optional sharing|Revised location, routing cache, geocoding, local storage, voice provider, assistant, contact and review explanations. Removed JSY free-delivery assertion.|**Inspected + rendered.** Hosting retention and complete review of every translated policy/medical statement not verified.|
|P1 · location / maps|Repeated blocking prompts and setup instructions → optional location, useful alternatives|Collapsible discovery controls, distinct PIN validation, city-centre label, disabled unconfigured traffic layer, external map directions and plain fallback.|**Passed:** denied/unsupported/unavailable/timeout callbacks, manual Pusa Road candidate selection, invalid PIN → address mode, permission granted with emulated GPS, live follow start/stop. **Blocked:** real mapped routes, traffic and Places.|
|P1 · saved / compare|Selections must survive reload and respect maximum → consistent shortlist|Deduplicated persisted IDs, saved-only empty state, retained all saved candidates regardless of radius, disabled full-tray additions, corrected compare add feedback, responsive print grid.|**Passed:** save/reload/unsave; 0→1→2→3, duplicate excluded, fourth refused, reload, Hindi origin action, print grid. Browser storage exceptions and physical printed output not manually tested.|
|P1 · assistant / voice|Fallback exposed keys; token minting called a live session → disclose actual transport|Lazy-loaded widget, rule-based source label, timeout/retry, Escape/focus return; device recognition and speech synthesis rather than claiming connected Gemini audio.|**Passed:** text comparison, deterministic response, 503/retry, stalled request timeout, unsupported/denied microphone with text alternative. **Blocked:** real Gemini response. Successful live microphone/audio not tested.|
|P1 · languages / access|Untranslated named controls and coverage claims → preserve route and disclose partial support|Hindi comparison label and language selector; partial-language labels; improved focus, responsive navigation and print styling.|**Passed:** switch all 11 options on same route, Hindi reload, Urdu RTL, mobile nav, assistant keyboard close. **Open:** full translation/localisation, mixed-script typography, screen-reader, 200% browser zoom and exhaustive keyboard audit.|
|P1 · contact|Opening email is not delivery → honest draft feedback|Retained native email flow, explicit draft status and validation.|**Passed:** short message rejected, valid local draft requested. No delivery attempted or claimed.|
|P2 · home / all requested routes|Crowded navigation and empty near-you area → compact useful entry point|Sage hero with existing representative imagery, responsive search and suggestions, optional location strip, compact tool links, forest-green navigation and visible emergency access.|**Passed:** every requested route at 320/390/768/1024/1440, including populated estimator and compare; no page-level horizontal overflow or uncaught page exceptions in final sweep. Not every internal link, sticky overlap or translated layout was exhaustively tested.|

## Reproduce

```sh
npm ci
npm run lint && npm run typecheck && npm test
npm run build && npm start
# In a second terminal, with the no-key local instance running on port 3000:
npx playwright install --with-deps chromium
node scripts/browser-qa.mjs
node scripts/browser-history.mjs
node scripts/browser-failures.mjs
```

For development use `npm run dev`. For the Arena embedded preview only, `ARENA_PREVIEW=1` was set for build and start. Normal deployments keep their frame restrictions. Browser scripts also accept `CHROME_PATH` and JSON `CHROME_ARGS`; the sandbox used Playwright with actual headless Chromium 153, not MCP. Permission-denial/timeout cases use test doubles; no fabricated reviews were submitted.

**Regression:** lint, TypeScript and production build passed. Vitest: **130 passed, 6 skipped** (Google Routes live suite). All three browser scripts passed on the final build. A follow-up on Back navigation and another on the populated estimator caught issues that initial render checks missed. Both were fixed and the suites rerun.

**Performance:** local production homepage, Lighthouse 13.6, mobile 412 × 823, DPR 1.75, simulated 150 ms RTT / 1.6 Mbps / 4× CPU slowdown. **97 performance, 100 automated accessibility**, FCP 0.8 s, LCP 2.5 s, TBT 0 ms, CLS 0. One lab run, not field data or an app-wide accessibility result. An earlier run failed to collect filmstrip screenshots; the reported result is from the successful rerun.

## External integration gates and remaining verification

Configure `GOOGLE_MAPS_API_KEY` (server, Routes), `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (separate domain-restricted browser key, Maps JavaScript), `GOOGLE_PLACES_API_KEY` (server, Places), `GEMINI_API_KEY` and a supported `GEMINI_TEXT_MODEL` on staging. See `.env.example`. Rebuild after changing a public key. Enable billing/APIs and verify actual responses, allowed origins, quota/permission failures, accurate destination matching and reported source before release. No credentials are needed for basic browsing. The UI uses browser speech; a voice-token endpoint alone does not implement Gemini Live streaming.

Remaining independent work includes complete translations, per-field hospital citations and verified dates, independent handset and assistive-technology QA, end-to-end PDF pagination, exhaustive facility/filter/sorting and saved-storage failure scenarios, a durable review backend and editorial validation of treatment packages and emergency guidance. No verification dates, hospital reviews, new prices or live provider successes were inferred to fill these gaps. No production deployment was performed.
