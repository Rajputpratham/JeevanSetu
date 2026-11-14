# Deploying JeevanSetu on Render

JeevanSetu is a standard Next.js 15 (App Router) app: server-rendered pages plus
`/api/*` route handlers. It needs **no database, no secrets and no API keys**
(hospital data ships in-repo; maps are Leaflet + OpenStreetMap tiles).

- **Build:** `npm ci --include=dev && npm run build`
- **Start:** `npm run start` → `next start -H 0.0.0.0 -p ${PORT:-3000}` (Render injects `PORT`)
- **Health check:** `/api/health`

## Option A — Blueprint (recommended, one click)

The repo contains [`render.yaml`](./render.yaml), which declares the whole service.

1. Sign in at <https://dashboard.render.com> and connect your GitHub account.
2. **New → Blueprint**.
3. Choose the `Rajputpratham/JeevanSetu` repository (branch `main`) → **Connect**.
4. Render reads `render.yaml` and shows one web service, `jeevansetu`
   (Node, free plan, Singapore). Click **Apply**.
5. Watch the build. First deploy takes ~3–5 min; the service goes live at
   `https://jeevansetu.onrender.com` (name may get a suffix if taken).
6. Optional: after the URL exists, set `NEXT_PUBLIC_SITE_URL` to that URL in the
   service's **Environment** tab and redeploy, so canonical tags, `robots.txt`
   and `sitemap.xml` point at the live host instead of `www.jeevansetu.in`.

Note: the Blueprint file must be on the branch you deploy. It is merged to `main`;
to try it first, point the Blueprint at the feature branch and set `branch:` accordingly.

## Option B — Manual web service

**New → Web Service** → pick the repo, then:

| Field | Value |
| --- | --- |
| Language / Runtime | Node |
| Region | Singapore |
| Branch | `main` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run start` |
| Health Check Path | `/api/health` |
| Instance Type | Free |
| Env vars | `NODE_VERSION=22.22.3` (recommended) |

Do **not** set `PORT` — Render provides it and the start script picks it up.
Adding `NODE_ENV=production` is fine; `--include=dev` keeps Tailwind/TypeScript
installed so the build cannot fail on a missing dev dependency.

## Custom domain (www.jeevansetu.in)

Render supports custom domains on the free plan:

1. Service → **Settings → Custom Domains** → add `jeevansetu.in` and `www.jeevansetu.in`.
2. At your DNS provider add the `CNAME` / `ALIAS` records Render shows
   (apex `A`/`ALIAS` record + `CNAME` for `www`).
3. Render issues a managed TLS certificate once DNS resolves.
4. Leave `NEXT_PUBLIC_SITE_URL` unset in production so canonical URLs stay
   `https://www.jeevansetu.in`.

## Free-plan behaviour worth knowing

- The instance **sleeps after ~15 minutes of inactivity**; the next visitor waits
  ~30–60s for a cold start. Upgrade the plan (or add a periodic ping) to avoid this.
- 512 MB RAM / 0.1 CPU — plenty here, since all data is static and in-memory.
- No persistent disk is needed: the app writes nothing to the filesystem.

## Verification after deploy

```bash
curl https://<your-service>.onrender.com/api/health          # {"status":"ok",...}
curl -o /dev/null -w '%{http_code}\n' https://<your-service>.onrender.com/
curl https://<your-service>.onrender.com/robots.txt          # includes Sitemap: URL
curl https://<your-service>.onrender.com/sitemap.xml         # hospital pages listed
```

Then check `/`, `/hospitals`, `/cost-estimator`, `/compare`, `/emergency` in a
browser, including the map on `/hospitals` (Leaflet tiles load over HTTPS).
