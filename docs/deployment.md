# Public demo deployment

RiskFlow serves the React build and Python inference API from one Docker service. The public demo keeps CSV imports and simulations transient. No external model API or model key is required; all inference bundles ship in the image.

## Free hosting constraint

Hosting must stay free. No paid service has been provisioned. Do not substitute paid resources if a free deployment fails. The Render template selects `plan: free`; it is preparation, not evidence that the full app fits that plan.

Render Free currently provides 512 MB RAM and 0.1 CPU. Our successful [Linux container check](https://github.com/Vortex-VK/RiskFlow/actions/runs/40398823801) used 1 CPU / 2 GB, with peak memory of 584,212,480 bytes (about 557 MiB) and an approximately 11-second request for 10,000 payments. That workload exceeds the free memory budget, and the much smaller CPU allowance may exceed the frontend's 30-second simulation timeout. Verify or improve those limits before launching the full demo on Render Free; do not silently remove samples or lower upload limits.

Free web services sleep after 15 idle minutes and can take about a minute to wake. Monthly usage limits also apply. Without a payment method, Render suspends free services or builds when applicable usage allowances are exhausted instead of billing overages. Keep the account on free resources and review usage settings. Sources: [compute allocations](https://render.com/docs/compute-plans), [free-tier limits](https://render.com/docs/free).

## Render setup (after free-tier verification)

1. Check that the target commit's **Public demo container** GitHub Actions run passed, and separately verify the workload under free-tier resource limits. The existing workflow tests the image and functionality with 1 CPU / 2 GB; a green result alone does not verify Render Free compatibility.
2. Open [Deploy to Render](https://render.com/deploy?repo=https://github.com/Vortex-VK/RiskFlow), select your Render workspace, and confirm the service uses the Free compute plan.
3. `render.yaml` specifies Docker, port 8000, `/api/v1/health` readiness, public-demo mode, and one free instance. No disk or database is provisioned.
4. Wait for health, then repeat the sample/import/simulate journey at the assigned HTTPS URL. A custom domain is optional. Record the deployed Git commit and the URL.

Preparing this repository does not provision hosting or incur a Render charge. Automatic deployment is off, so a push alone does not change a running public site. To update, deploy a verified commit manually. Roll back to the preceding verified deploy in Render if readiness or core journeys fail.

Provider references: [Docker services](https://render.com/docs/docker), [Blueprint settings](https://render.com/docs/blueprint-spec), [pricing](https://render.com/pricing).

## Public-demo behavior

`RISKFLOW_PUBLIC_DEMO=true` is the Docker default and is explicitly set by Render:

- `/api/v2/datasets` and every child route return 404, for reads and writes. These routes are also omitted from the API schema. Removing a UI button alone would not protect stored data.
- No server-side datasets, imports or assessments are saved by the public demo. Temporary workspaces are submitted to the inference endpoint for processing.
- One simulation can run at a time. Excess concurrent requests are rejected immediately rather than queued.
- A rolling 60-second window admits at most 20 simulations and 60 total API writes. These are global per-process limits, not per-visitor allowances. The service returns 429, a retry message and `Retry-After` when busy; assets, samples and readiness stay available.
- The existing 16 MiB JSON request limit, 5 MB browser CSV limit and 10,000-payment limit remain in effect.

Run exactly one worker and one instance with these in-memory limits. Forwarding headers do not determine quota identity, and Uvicorn does not trust them. Multi-instance deployment needs a shared limiter. The current limits bound inference work; they are not a substitute for provider-level protection against network floods.

Do not disable public-demo mode on an anonymous public service. Local retained-history functionality uses shared SQLite without user authentication or ownership checks. Enabling it publicly requires authentication, per-user authorization and durable storage first.

## Verification

The image runs as UID 10001, includes all hash-verified model components, and serves `/`, `/assets` and `/samples`. HTML and sample downloads revalidate; hashed assets cache for one year. API logging records request IDs, methods, status codes and durations, not request bodies.

Docker is not installed in the development workspace. The GitHub Actions workflow provides Linux container verification; inspect its outcome rather than treating a successful local Python run as proof of container readiness. It runs with 1 CPU and a 2 GB memory limit and records container memory use, peak memory and logs.

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

For local browser checks the config uses installed Chrome; set `CI=true` to use Playwright's bundled Chromium. `RISKFLOW_TEST_URL` can override the target URL. Tests issue real simulations; run them serially against an otherwise idle demo.

For a local production-server check without Docker, build the frontend, set `PYTHONPATH=backend`, `RISKFLOW_FRONTEND_DIR` to the absolute `frontend/dist` path, and `RISKFLOW_PUBLIC_DEMO=true`, then start `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --no-proxy-headers` using the backend environment. Run the same HTTP and browser checks against it.

The frontend simulation timeout is 30 seconds. Container CI checks the largest sample against this budget, but hosted latency and concurrent traffic still need measurement at the actual service. The existing roughly 724 kB JavaScript bundle remains a known optimization opportunity.
