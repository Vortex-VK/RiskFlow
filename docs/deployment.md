# Container build and verification

The portable Docker image serves the frontend and API together. No hosting provider is configured. Use the resource measurements below when choosing a service.

## Container behavior

The root Dockerfile packages the frontend, Python API, and required hash-verified inference components. It serves the app and API from one origin on port 8000, runs as UID 10001, and defaults to `RISKFLOW_PUBLIC_DEMO=true`.

Public-demo mode keeps CSV workspaces and simulations transient:

- Saved-dataset routes return 404 and are omitted from the API schema. No server-side datasets or assessments are saved.
- One HTTP write is admitted at a time, before its body is buffered. A rolling minute admits at most 20 inference requests (simulations or explanations) and 60 total writes, including unknown routes. These limits are global per process. Busy responses use 429 with `Retry-After`; stalled request bodies time out after 30 seconds.
- Explanations accept only the current Stack-d5 model. Historical explanations remain available in local mode.
- The transaction limit is 10,000 payments, with 3,000 total objects and 12,000 context associations. Accounts share the object budget with merchants, devices, and locations; there is no smaller account-specific cap. The 16 MiB JSON request and 5 MB browser CSV limits are unchanged.
- Run one worker and one instance for these in-memory limits. Multiple instances require a shared limiter.

Do not disable public-demo mode on an anonymous public service: local retained-history functionality uses shared SQLite without user authentication or ownership checks. Local development retains its existing saved-dataset functionality.

HTML and sample downloads revalidate; hashed assets cache for a year. API responses use `Cache-Control: no-store`. The production page restricts scripts and connections to its own origin and cannot be embedded in a frame. API request logs omit request bodies. See [security boundaries](../SECURITY.md).

## Verification

The **Public demo container** GitHub workflow verifies the container, model loading, HTTP boundaries, and real sample/import simulations on Linux. It uses 1 CPU and a 2 GB memory limit. Local Python checks alone do not establish container readiness.

With Docker available, from the repository root:

```sh
docker build -t riskflow:public .
docker run --rm --name riskflow --cpus=1 --memory=2g -p 8000:8000 riskflow:public
# In another terminal:
python scripts/verify_public_demo.py http://127.0.0.1:8000
cd frontend
npm ci
npx playwright install chromium
npx playwright test --config playwright.public.config.ts
```

Local browser checks use installed Chrome; CI uses Playwright Chromium. `RISKFLOW_TEST_URL` can override the container test target.

## Measured hosting capacity

The October 30, 2026 Linux experiment used fresh containers with swap disabled and cold file caches. It exercised the 10,000-payment sample and a variant with the maximum 3,000 objects and 12,000 associations, including simulations, explanations and comparisons.

| Container resources | Peak memory, sample / maximum graph | Simulation time |
| --- | --- | --- |
| 512 MiB, 1 CPU | 512 / 512 MiB | 7.2?8.0 s |
| 1 GiB, 1 CPU | 545.7 / 601.3 MiB | 7.2?8.0 s |
| 512 MiB, 0.1 CPU | 512 / 512 MiB | 83.1?86.6 s |

All tested requests completed without OOM kills. The 512 MiB containers reached their memory ceiling and reclaimed file cache. Target **1 CPU and 1 GiB RAM** for headroom; a strict 0.1-CPU allocation exceeded the frontend's 30-second request timeout. These measurements cover the tested inputs, not every possible CSV or a specific hosting provider. Verify cold-start latency on the chosen host.

The capacity experiment and its raw reports are local maintenance artifacts, not part of routine CI. The public workflow retains Docker, HTTP and browser smoke checks.
