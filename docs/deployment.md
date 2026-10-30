# Container build and verification

Public deployment is deferred. Provider-specific deployment files and setup instructions have been removed. The local app runs its frontend and Python API together through the existing development proxy. The portable Docker setup remains available for future use; any future hosting must stay free.

## Container behavior

The root Dockerfile packages the frontend, Python API, and required hash-verified inference components. It serves the app and API from one origin on port 8000, runs as UID 10001, and defaults to `RISKFLOW_PUBLIC_DEMO=true`.

Public-demo mode keeps CSV workspaces and simulations transient:

- Saved-dataset routes return 404 and are omitted from the API schema. No server-side datasets or assessments are saved.
- One simulation runs at a time. A rolling minute admits at most 20 simulations and 60 total API writes. These limits are global per process. Busy responses use 429 with `Retry-After`.
- The transaction limit is 10,000 payments, with 3,000 total objects and 12,000 context associations. Accounts share the object budget with merchants, devices, and locations; there is no smaller account-specific cap. The 16 MiB JSON request and 5 MB browser CSV limits are unchanged.
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

## Linux capacity experiment

The workflow also runs fresh containers with 512 MiB / 1 CPU, 1 GiB / 1 CPU, and 512 MiB / 0.1 CPU. Each payload gets its own container, with swap disabled. On the dedicated CI runner, the earlier smoke-test container is stopped and the host file cache is cleared before each measurement, so file pages cannot remain charged to an earlier test container. The client runs outside the measured container. Payloads use the real frontend CSV importer: the 10,000-payment sample and a copy expanded to the maximum 3,000 objects and 12,000 associations. Each request includes API validation, response serialization and gzip compression. The 1-CPU profiles repeat simulations, explanations and comparisons three times per payload; the 0.1-CPU profile runs once per payload.

After building the image, run on a Linux Docker host:

```sh
cd frontend
node scripts/export-capacity-payloads.mjs ../.cache/capacity-payloads
cd ..
python3 scripts/measure_container_capacity.py --image riskflow:public
```

On a dedicated Linux test machine, use `sudo python3 scripts/measure_container_capacity.py --image riskflow:public --cold-cache` to reproduce CI's cold file-cache measurements. Stop other RiskFlow containers first. Do not clear the file cache on a shared or production host.

The `container-capacity` workflow artifact contains JSON measurements and server logs. Inspect `requests_succeeded`, `within_ui_timeout`, `container_state.OOMKilled`, memory events and peak memory in each report. A completed experiment can report a failed capacity profile; a green workflow alone is not proof that every profile fits. Measurements include Linux cgroup memory, including charged file cache, rather than only process RSS. The frontend request timeout is 30 seconds; the experiment permits 180 seconds so slow responses can be measured and reported as unsuitable for the UI.

### Measured results: October 30, 2026

The [cold-cache Linux run](https://github.com/Vortex-VK/RiskFlow/actions/runs/41087727231) tested application changes at commit `6818a3733d792839bee705277c12a95f3403da72`. All six fresh containers completed their requests, stayed healthy, and recorded zero OOM kills, with swap disabled.

| Container resources | Sample peak | Maximum-graph peak | Simulation time | Interpretation |
| --- | --- | --- | --- | --- |
| 512 MiB, 1 CPU | 512.0 MiB | 512.0 MiB | 7.2–8.0 s | Completed, but reached the memory ceiling and required cache reclamation |
| 1 GiB, 1 CPU | 545.7 MiB | 601.3 MiB | 7.2–8.0 s | Completed with memory headroom |
| 512 MiB, 0.1 CPU | 512.0 MiB | 512.0 MiB | 83.1–86.6 s | Completed under the experiment's extended timeout; exceeds the UI's 30 s timeout |

Keep the 10,000-payment limit. These workloads can run at 512 MiB with 1 CPU, but a free tier providing roughly 1 CPU and 1 GiB RAM is the better hosting target. A strict 0.1-CPU allocation is too slow for the largest uploads with the current UI timeout. This verifies the tested workloads, not every possible CSV or a particular hosting provider. The earlier warm-cache experiment undercounted charged file pages and is not the basis of this recommendation.

The historical [October 26 Linux check](https://github.com/Vortex-VK/RiskFlow/actions/runs/40398823801) recorded a 557.1 MiB peak across the entire test suite and processed its older 10,000-payment sample in about 11 seconds. That predates the current engine and sample changes and is not an isolated current-request measurement. Verify cold starts and latency on the actual service before hosting; no specific free host is currently configured or verified.
