# Local production verification and Stage 7 deployment

Public deployment is deferred by the user until the complete app is approved. There is no public URL, chosen provider, cloud account configuration, or claimed container verification.

## Serve the actual build locally

Install the locked dependencies using README, then run from the repository root:

```powershell
npm.cmd run --prefix frontend build
$env:RISKFLOW_FRONTEND_DIR = (Resolve-Path frontend/dist).Path
& backend/.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Open `http://127.0.0.1:8001`. This serves UI and API from one process without Vite. Ctrl+C stops it. `scripts/verify_api.py` starts and cleans up its own server on an available port; it verifies real template/simulation responses, HTML, gzip assets, caching and unknown routes. Run it after building.

For full production-browser verification, run from `frontend`:

```powershell
npm.cmd run test:browser -- --config playwright.release.config.ts
$env:RISKFLOW_BROWSER = 'firefox'
npm.cmd run test:browser -- --config playwright.release.config.ts tests/editor.spec.ts tests/experimentation.spec.ts tests/import.spec.ts tests/simulation.spec.ts tests/release.spec.ts
Remove-Item Env:RISKFLOW_BROWSER
```

Install the test engine with `npx playwright install firefox`. The recording additionally uses `npx playwright install ffmpeg`. Test configuration owns port 8123; do not run two suites concurrently on that port. The development launcher uses separate ports 8000/5173. The release configuration currently targets this Windows workspace.

HTML revalidates on each load. Content-hashed assets cache for one year. Gzip compresses responses over 1,000 bytes. API boundaries retain the 16 MiB JSON request limit; CSV parsing has its separate 5 MB browser limit. Request logs contain ID, HTTP method, status and duration, without bodies, filenames or query strings. The API does not retain scenarios. Responses expose `X-Request-ID` for troubleshooting.

## Container and public deployment gate

The Dockerfile builds the frontend in a Node stage and runs Python 3.13/Uvicorn as UID 10001 on port 8000. Canonical fixtures, built assets, ML runtime code and the frozen v13 model bundle are included. Readiness verifies and loads the bundle; missing or corrupted models fail explicitly. Explicit Datasets use SQLite in `RISKFLOW_DATA_DIR=/app/.data`; the image creates that directory with ownership for UID 10001. Local datasets and training data are excluded from the build context. Docker is absent here, so the following commands are preparation, not execution evidence:

```powershell
docker build -t riskflow:approved .
docker run --rm -p 8001:8000 --mount source=riskflow-data,target=/app/.data riskflow:approved
```

Stage 7 must verify the container first, then select an actual hosting account with the user. Use one HTTPS origin, port 8000, `/api/v1/health` readiness, and provider-level request throttling. Test `/`, asset caching/compression, the example CSV, all templates, invalid routes, both hero runs and import in a clean browser. Measure cold starts on the selected service against the UI request timeout; local timings do not predict hosted latency.

Retain the previous approved image and its digest. Deploy an immutable new image, wait for health, verify the clean-session journey, and roll back to the previous image if health or core journeys fail. Temporary sandbox drafts and runs remain session-only; explicit datasets and saved assessments require durable storage. Verify volume permissions and dataset creation/reopening in the container, back up SQLite data before upgrades, and check schema compatibility before rollback. CI/container automation is part of configuring the actual deployment repository in Stage 7.

Known local limits: one approximately 701 kB JavaScript chunk (206 kB gzip); Vite's advisory remains visible. Slower-device and hosted-network measurements should guide any later splitting, rather than suppressing the warning or claiming universal performance.
