# JeevanSetu — Connecting People to Better Healthcare

JeevanSetu is a free, rural-first healthcare discovery and assistance platform for India. It helps families answer six questions:

1. **Where is the nearest hospital?** — location-aware discovery with map + list views (`/hospitals`)
2. **Which hospital suits my needs?** — speciality, budget and facility-aware recommendations (`/recommendations`)
3. **How much might treatment cost?** — itemised ₹ estimator, government vs private (`/cost-estimator`)
4. **Which hospital is the better choice?** — side-by-side comparison, up to 3 hospitals (`/compare`)
5. **What does a particular hospital offer?** — detailed pages with honestly labelled data (`/hospitals/[id]`)
6. **Where do I get emergency help?** — verified 24×7 emergency hospitals + national 112 helpline (`/emergency`)

No sign-up. Hindi + English UI. Works on low-end Android phones.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Leaflet + OpenStreetMap (no API keys) · data shipped as typed in-repo datasets (`data/hospitals.ts`, `data/treatments.ts`) behind server-side API routes (`/api/hospitals`, `/api/recommendations`, `/api/estimate`, `/api/emergency`).

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve production build (honours PORT)
```

Set `NEXT_PUBLIC_SITE_URL` (see `.env.example`) when the app is served from a
non-production host, so canonical tags, `robots.txt` and `sitemap.xml` match.

## Deploy

**Render** — the repo ships a [`render.yaml`](./render.yaml) Blueprint (Node web
service, free plan, Singapore region, `/api/health` check). Steps, manual setup,
custom domains and free-tier caveats: **[DEPLOY.md](./DEPLOY.md)**.

## Honesty policy

- Hospital names/addresses are from public listings. Verification status is shown per field: **Verified / Unverified / Not listed**.
- Cost figures are indicative ranges compiled from public CGHS / PM-JAY / state-scheme / published-tariff references. They are **not quotes**. Missing pricing data is shown as “not available”, never invented.
- JeevanSetu is not medical advice. In an emergency call **112**.

See `/disclaimer` in the app for full sourcing and `/privacy` for data handling.
