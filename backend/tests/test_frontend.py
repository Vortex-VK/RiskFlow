from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.frontend import mount_frontend


def test_single_service_serves_assets_without_swallowing_api_or_unknown_paths(
    tmp_path: Path,
) -> None:
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>RiskFlow</html>")
    (tmp_path / "assets" / "app.js").write_text("document.title = 'RiskFlow';")
    application = FastAPI()

    @application.get("/api/v1/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    mount_frontend(application, tmp_path)
    with TestClient(application) as client:
        assert client.get("/").headers["content-type"].startswith("text/html")
        assert client.get("/").headers["cache-control"] == "no-cache"
        assert client.get("/assets/app.js").status_code == 200
        assert client.get("/assets/app.js").headers["cache-control"] == (
            "public, max-age=31536000, immutable"
        )
        assert client.get("/api/v1/health").json() == {"status": "ok"}
        for path in (
            "/api/v1/missing",
            "/missing",
            "/assets/missing.js",
            "/assets/%2e%2e/index.html",
        ):
            assert client.get(path).status_code == 404


def test_missing_production_build_fails_fast(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="Build the frontend"):
        mount_frontend(FastAPI(), tmp_path)
