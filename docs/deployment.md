# Container build and verification

Public deployment is deferred. Provider-specific deployment files and setup instructions have been removed. The local app runs its frontend and Python API together through the existing development proxy. The portable Docker setup remains available for future use; any future hosting must stay free.

## Container behavior

The root Dockerfile packages the frontend, Python API, and required hash-verified inference components. It serves the app and API from one origin on port 8000, runs as UID 10001, and defaults to `RISKFLOW_PUBLIC_DEMO=true`.

Public-demo mode keeps CSV workspaces and simulations transient:

- Saved-dataset routes return 404 and are omitted from the API schema. No server-side datasets or assessments are saved.
- One simulation runs at a time. A rolling minute admits at most 20 simulations and 60 total API writes. These limits are global per process. Busy responses use 429 with `Retry-After`.
- The transaction limit is 25,000 payments. The 16 MiB JSON request and 5 MB browser CSV limits are unchanged.
- Run one worker and one instance for these in-memory limits. Multiple instances require a shared limiter.

Do not disable public-demo mode on an anonymous public service: local retained-history functionality uses shared SQLite without user authentication or ownership checks. Local development retains its existing saved-dataset functionality.

HTML and sample downloads revalidate; hashed assets cache for a year. API logs omit request bodies.

## Verification

The **Public demo container** GitHub workflow verifies the container, model loading, HTTP boundaries, and real sample/import simulations on Linux. It uses 1 CPU and a 2 GB memory limit. Docker is unavailable in the development workspace, so local Python checks alone do not establish container readiness.

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

For future hosting, verify memory, cold starts, and latency at the actual service. The earlier [Linux check](https://github.com/Vortex-VK/RiskFlow/actions/runs/40398823801) peaked at approximately 557 MiB and processed the 10,000-payment sample in about 11 seconds. The frontend simulation timeout is 30 seconds. No specific free host is currently configured or verified.
