import gzip
import json
import os
import re
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

root = Path(__file__).resolve().parents[1]
with socket.socket() as probe:
    probe.bind(("127.0.0.1", 0))
    port = probe.getsockname()[1]
started = time.perf_counter()
process = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
    cwd=root,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
    env={**os.environ, "RISKFLOW_FRONTEND_DIR": str(root / "frontend" / "dist")},
    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
)
base = f"http://127.0.0.1:{port}/api/v1"
try:
    for _attempt in range(50):
        try:
            with urlopen(base + "/health", timeout=1) as response:
                assert json.load(response) == {
                    "status": "ok",
                    "schemaVersion": 1,
                    "engineVersion": "engine-ml-stack-d5",
                }
            break
        except (URLError, TimeoutError):
            if process.poll() is not None:
                raise RuntimeError("Server exited before readiness.") from None
            time.sleep(0.1)
    else:
        raise RuntimeError("Server did not become ready.")
    startup_ms = (time.perf_counter() - started) * 1000
    with urlopen(base + "/templates", timeout=3) as response:
        assert len(json.load(response)) == 4
    document = json.loads(
        (root / "fixtures/scenarios/shared-device-cluster.json").read_text(encoding="utf-8")
    )
    with urlopen(base + "/templates/shared-device-cluster", timeout=3) as response:
        assert json.load(response) == document
    request = Request(
        base + "/scenarios/validate",
        data=json.dumps({"scenario": document["scenario"]}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urlopen(request, timeout=3) as response:
        assert json.load(response) == {"valid": True, "issues": []}
    request = Request(
        base + "/simulations",
        data=json.dumps({"scenario": document["scenario"]}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urlopen(request, timeout=3) as response:
        result = json.load(response)
        assert result["events"][9]["model"]["version"] == "ml-stack-d5"
        assert result["events"][9]["riskScore"] is None
        frozen = json.loads(
            (root / "fixtures/runtime/stack-d5/run.json").read_text(encoding="utf-8")
        )
        assert result["events"] == frozen["events"]
        assert result["metrics"] == frozen["metrics"]
    with urlopen(f"http://127.0.0.1:{port}/", timeout=3) as response:
        assert "text/html" in response.headers["Content-Type"]
        assert response.headers["Cache-Control"] == "no-cache"
        assert response.headers["X-Request-ID"]
        html = response.read()
        assert b'<div id="root"></div>' in html
    for asset in re.findall(rb'(?:src|href)="(/assets/[^\"]+)"', html):
        with urlopen(
            Request(
                f"http://127.0.0.1:{port}" + asset.decode(),
                headers={"Accept-Encoding": "gzip"},
            ),
            timeout=3,
        ) as response:
            assert response.headers["Cache-Control"] == "public, max-age=31536000, immutable"
            assert response.headers["Content-Encoding"] == "gzip"
            assert len(gzip.decompress(response.read())) > 1000
    for missing in ("/api/v1/missing", "/assets/missing.js", "/missing"):
        try:
            urlopen(f"http://127.0.0.1:{port}" + missing, timeout=3)
        except HTTPError as error:
            assert error.code == 404
        else:
            raise AssertionError(f"Missing path returned success: {missing}")
    print(f"Production HTTP smoke passed; startup to readiness {startup_ms:.1f} ms.")
    print("Health, templates, validation, simulation, UI, caching/gzip and missing paths verified.")
finally:
    process.terminate()
    process.wait(timeout=5)
