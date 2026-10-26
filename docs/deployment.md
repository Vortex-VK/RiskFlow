# Public deployment

Hosting must stay free. The public frontend targets **Cloudflare Pages**, using static files and no Pages Functions, paid resources, database, or disk. The previous Render configuration and deployment links have been removed; no Render service was provisioned during setup.

## Cloudflare Pages

The Pages build serves a readable home page, guide, and recorded sample results without JavaScript. The interactive app lives at `/workspace/`. Search crawlers can read the public content; allowing crawlers does not guarantee indexing or appearance in ChatGPT search.

1. In Cloudflare, open **Workers & Pages**, create a **Pages** project, and connect GitHub. Authorize `Vortex-VK/RiskFlow` and choose production branch `main`.
2. Use these build settings:

   | Setting | Value |
   | --- | --- |
   | Framework preset | None |
   | Root directory | `frontend` |
   | Build command | `npm run build:pages` |
   | Build output directory | `dist-pages` |
   | Node version | `24.22.0` (also pinned in `.node-version`) |

3. Leave `VITE_API_ORIGIN` unset until an inference backend is available. Deploy to the free `pages.dev` address; a custom domain is optional.
4. Set production environment variable `VITE_SITE_URL` to the assigned stable HTTPS origin, for example `https://your-project.pages.dev`, and redeploy. This gives canonical links and the sitemap a stable destination. Before this is set, the build uses Cloudflare's deployment URL. Never use the example domain as a production value.
5. Check `/`, `/guide/`, `/sample-results/`, `/workspace/`, `/robots.txt`, and `/sitemap.xml` at the public URL. Check the Samples and CSV import journeys. A direct visit to an unknown path should return the custom 404.

GitHub-connected Pages automatically builds subsequent pushes to `main`. Preview branches are marked `noindex` and disallowed in robots.txt. The workspace itself is marked `noindex`; the readable public pages contain the material intended for search. Review Cloudflare's crawler settings if a crawler receives a challenge; robots.txt alone cannot override an account-level block. Roll back to a previous successful production deployment in the Pages dashboard if necessary.

Account authorization must happen in the owner's Cloudflare account. No account token belongs in GitHub, frontend environment variables, or chat. `VITE_*` values are public build settings, never secrets.

Official references: [GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/), [build settings](https://developers.cloudflare.com/pages/configuration/build-configuration/), [static routing](https://developers.cloudflare.com/pages/configuration/serving-pages/), [response headers](https://developers.cloudflare.com/pages/configuration/headers/).

## Live simulations need a separate backend

Cloudflare Pages hosts the frontend; it does not run this Python inference service. With no backend configured, graph editing, CSV import, bundled presets, and sample exploration work. Simulate is disabled with an explanation, and the tutorial skips unavailable simulation steps. Recorded sample results remain available. This is an exploration site until a backend is connected.

To enable the existing engine without changing its predictions:

1. Select and verify a separate **free** container host. Do not substitute a paid plan. The passing [Linux container check](https://github.com/Vortex-VK/RiskFlow/actions/runs/40398823801) used 1 CPU / 2 GB, peaked at approximately 557 MiB, and processed the 10,000-payment sample in about 11 seconds. A 512 MB service has not been demonstrated sufficient. Cold starts and the frontend's 30-second simulation timeout also matter.
2. Deploy the root `Dockerfile`, port `8000`, one worker and one instance, with readiness path `/api/v1/health`. Keep `RISKFLOW_PUBLIC_DEMO=true` (the image default).
3. Set the backend's `RISKFLOW_ALLOWED_ORIGINS` to the exact public Pages origin. Multiple explicitly authorized HTTPS origins can be comma-separated. Wildcards are rejected. This enables browser requests; it is not API authentication or an abuse-control boundary.
4. Set production `VITE_API_ORIGIN` in Pages to the backend HTTPS origin, without a path, and rebuild. Leave preview builds disconnected unless their exact origins are explicitly authorized. The normal local app continues to use its existing same-origin API proxy.
5. Verify a real sample and CSV simulation from the public Pages workspace, including health, preflight requests, errors, and the largest sample. Do not describe simulations as live until this succeeds.

## Public-demo API behavior

- Saved-dataset routes return 404 and are omitted from the API schema. Public workspaces are processed transiently; no server-side datasets or assessments are saved.
- One simulation runs at a time. A rolling minute admits at most 20 simulations and 60 total API writes. These limits are global per process. Busy responses use 429 with `Retry-After`.
- The existing 16 MiB JSON request, 5 MB browser CSV, and 10,000-payment limits remain unchanged.
- Run one worker and one instance for these in-memory limits. Multiple instances require a shared limiter. Provider-level traffic protection is still separate.

Do not disable public-demo mode on an anonymous public service: local retained-history functionality uses shared SQLite without user authentication or ownership checks.

## Verification

The **Cloudflare Pages build** GitHub workflow builds the static artifact, runs frontend unit checks, and verifies readable pages and backend-free import/sample journeys in Chromium. Its example sitemap origin is test-only and its artifact is not deployed. Cloudflare builds production using the account's configured origin.

Locally, from `frontend` with Node on PATH:

```sh
npm ci
npm run build:pages
npx playwright test --config playwright.pages.config.ts
```

The separate **Public demo container** workflow still verifies the existing engine, HTTP boundaries, and real sample/import simulations on Linux. Docker is unavailable in the development workspace; local Python checks alone are not proof of container readiness. The image includes all required hash-verified inference components and runs as UID 10001. HTML and samples revalidate, hashed assets cache for a year, and API logs omit request bodies.

With Docker available, from the repository root:

```sh
docker build -t riskflow:public .
docker run --rm --name riskflow --cpus=1 --memory=2g -p 8000:8000 riskflow:public
# In another terminal:
python scripts/verify_public_demo.py http://127.0.0.1:8000
cd frontend
npx playwright test --config playwright.public.config.ts
```

Local browser checks use installed Chrome; CI uses Playwright Chromium. `RISKFLOW_TEST_URL` can override the container test target. Actual hosting latency, resource limits, and cross-origin behavior must also be checked at the deployed URL.
