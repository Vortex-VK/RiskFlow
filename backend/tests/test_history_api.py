import base64
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.storage.history import configured_store

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures/evaluations/simulator-v2"


@pytest.fixture
def history_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("RISKFLOW_DATA_DIR", str(tmp_path))
    return TestClient(app, raise_server_exceptions=False)


def test_retained_api_roundtrip_isolation_and_model_health(history_client: TestClient) -> None:
    client = history_client
    created = client.post(
        "/api/v2/datasets", json={"name": "API history", "sourceNamespace": "bank"}
    )
    assert created.status_code == 200
    dataset = created.json()["id"]
    base = f"/api/v2/datasets/{dataset}"
    preview = client.post(
        base + "/imports/preview",
        json={
            "filename": "burst.csv",
            "contentBase64": base64.b64encode((FIXTURES / "burst.csv").read_bytes()).decode(),
        },
    )
    assert preview.status_code == 200
    assert preview.json()["canCommit"] is True
    token = preview.json()["id"]
    assert client.post(base + f"/imports/{token}/commit", json={}).json()["committedRevision"] == 1
    assert client.get(base).json()["eventCount"] == 8
    assert client.get(base + "/document").json()["scenario"]["id"] == dataset
    page = client.get(base + "/events?limit=2&offset=2").json()
    assert page["total"] == 8
    assert [item["event"]["sourceEventId"] for item in page["items"]] == [
        "TXN-RFSIM-2026-002096",
        "TXN-RFSIM-2026-002097",
    ]
    response = client.post(base + "/runs", json={"revision": 1})
    assert response.status_code == 200, response.text
    run = response.json()
    assert [item["score"] for item in run["assessments"]] == [None] * 8
    assert run["schemaVersion"] == 2
    assert run["simulation"] is None
    assert all(item["recommendation"] == "not_assessed" for item in run["assessments"])
    assert client.get(base + f"/runs/{run['id']}").json() == run
    assert configured_store().run(dataset, run["id"]).model_dump(by_alias=True) == run
    assert client.get(base + "/runs").json()[0]["analysisHash"] == run["analysisHash"]
    other = client.post(
        "/api/v2/datasets", json={"name": "Other", "sourceNamespace": "other"}
    ).json()["id"]
    assert client.get(f"/api/v2/datasets/{other}/runs/{run['id']}").status_code == 404
    assert (
        client.post(f"/api/v2/datasets/{other}/imports/{token}/commit", json={}).status_code == 404
    )
    assert client.post(base + "/runs", json={"revision": 1, "mode": "as_known"}).status_code == 422
    assert client.post(base + "/runs", json={"revision": 99}).status_code == 422
    assert client.get(base + "/events?limit=0").status_code == 422
    assert client.get("/api/v1/health").json()["engineVersion"] == "engine-ml-upload-v9"


def test_api_rejects_conflicting_preview_without_mutation(history_client: TestClient) -> None:
    client = history_client
    dataset = client.post(
        "/api/v2/datasets", json={"name": "Conflict", "sourceNamespace": "bank"}
    ).json()["id"]
    base = f"/api/v2/datasets/{dataset}"
    contents = (FIXTURES / "burst.csv").read_text()
    request = {
        "filename": "burst.csv",
        "contentBase64": base64.b64encode(contents.encode()).decode(),
    }
    preview = client.post(base + "/imports/preview", json=request).json()
    assert client.post(base + f"/imports/{preview['id']}/commit", json={}).status_code == 200
    request["contentBase64"] = base64.b64encode(
        contents.replace("19.75", "999.00").encode()
    ).decode()
    conflict = client.post(base + "/imports/preview", json=request).json()
    assert conflict["rows"][0]["disposition"] == "conflict"
    assert client.post(base + f"/imports/{conflict['id']}/commit", json={}).status_code == 409
    assert client.get(base).json()["revision"] == 1
    assert client.get(base).json()["eventCount"] == 8
    assert (
        client.post(base + "/imports/preview", json={"path": "C:/private.csv"}).status_code == 422
    )
