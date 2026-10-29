"""Smoke-test an already-running public-demo container using only the standard library."""

import gzip
import hashlib
import json
import math
import re
import sys
import time
from http.client import HTTPException
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8000"


def request(path, payload=None, headers=None, timeout=60):
    data = None if payload is None else json.dumps(payload).encode()
    req = Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    with urlopen(req, timeout=timeout) as response:
        return response.read(), response.headers


def missing(path, payload=None):
    try:
        request(path, payload)
    except HTTPError as error:
        assert error.code == 404, (path, error.code)
    else:
        raise AssertionError(f"Expected 404: {path}")


def same_prediction(actual, expected):
    """Keep decisions exact; tolerate only numerical roundoff across OSes."""
    if isinstance(expected, float):
        assert math.isclose(actual, expected, rel_tol=1e-12, abs_tol=1e-12), (actual, expected)
    elif isinstance(expected, dict):
        assert actual.keys() == expected.keys()
        for key in expected:
            same_prediction(actual[key], expected[key])
    elif isinstance(expected, list):
        assert len(actual) == len(expected)
        for left, right in zip(actual, expected, strict=True):
            same_prediction(left, right)
    else:
        assert actual == expected, (actual, expected)


def main():
    started = time.monotonic()
    deadline = started + 120
    while time.monotonic() < deadline:
        try:
            health, _ = request("/api/v1/health", timeout=10)
            assert json.loads(health)["status"] == "ok"
            break
        except (URLError, TimeoutError, ConnectionError, HTTPException):
            time.sleep(1)
    else:
        raise RuntimeError("Public demo did not become ready")
    print(f"Readiness: {time.monotonic() - started:.2f}s", flush=True)
    html, headers = request("/")
    assert b'<div id="root"></div>' in html
    assert headers["Cache-Control"] == "no-cache"
    assert headers["X-Request-ID"]
    for asset in re.findall(rb'(?:src|href)="(/assets/[^\"]+)"', html):
        content, headers = request(asset.decode(), headers={"Accept-Encoding": "gzip"})
        assert headers["Cache-Control"] == "public, max-age=31536000, immutable"
        assert headers["Content-Encoding"] == "gzip"
        assert len(gzip.decompress(content)) > 1000

    catalog = json.loads((ROOT / "frontend/src/features/samples/catalog.json").read_text())
    for sample in catalog["samples"]:
        content, headers = request("/samples/" + sample["file"])
        assert len(content) == sample["bytes"]
        assert hashlib.sha256(content).hexdigest() == sample["sha256"]
        assert headers["Cache-Control"] == "no-cache"
    attribution_files = {sample["attributionFile"] for sample in catalog["samples"]}
    for asset in sorted(attribution_files | {"ibm/LICENSE.txt", "scenarios/README.txt"}):
        content, _ = request("/samples/" + asset)
        assert content

    templates, _ = request("/api/v1/templates")
    for template in json.loads(templates):
        document, _ = request("/api/v1/templates/" + template["id"])
        payload = {"scenario": json.loads(document)["scenario"]}
        validation, _ = request("/api/v1/scenarios/validate", payload)
        assert json.loads(validation)["valid"]
        started = time.monotonic()
        run, _ = request("/api/v1/simulations", payload)
        result = json.loads(run)
        assert len(result["events"]) == template["paymentCount"]
        assert result["engineVersion"] == "engine-ml-stack-d5"
        if template["id"] == "shared-device-cluster":
            expected = json.loads((ROOT / "fixtures/runtime/stack-d5/run.json").read_text())
            same_prediction(result["events"], expected["events"])
            same_prediction(result["metrics"], expected["metrics"])
        print(f"{template['id']}: {time.monotonic() - started:.2f}s", flush=True)

    schema, _ = request("/openapi.json")
    assert not any(p.startswith("/api/v2/datasets") for p in json.loads(schema)["paths"])
    for path in ["/api/v2/datasets", "/api/v2/datasets/anything/runs"]:
        missing(path)
        missing(path, {})
    for path in ["/api/v1/missing", "/samples/missing.csv", "/missing"]:
        missing(path)
    print(
        "Public demo passed: UI, assets, all sample downloads, templates, predictions, isolation."
    )


if __name__ == "__main__":
    main()
