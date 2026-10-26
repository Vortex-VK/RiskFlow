import asyncio
import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from starlette.types import Message

from app.api.boundary import MAX_BODY_BYTES, RequestBoundary
from app.main import app
from app.templates import catalog
from app.templates.catalog import load_template


def test_health_reports_the_installed_engine(client: TestClient) -> None:
    assert client.get("/api/v1/health").json() == {
        "status": "ok",
        "schemaVersion": 1,
        "engineVersion": "engine-ml-upload-v9",
    }


def test_template_catalog_and_documents_match_canonical_fixtures(client: TestClient) -> None:
    response = client.get("/api/v1/templates")
    assert response.status_code == 200
    entries = response.json()
    assert [entry["id"] for entry in entries] == list(catalog.TEMPLATE_IDS)
    assert sum(entry["paymentCount"] for entry in entries) == 38
    assert entries[0]["nodeCount"] == 15
    for entry in entries:
        document = client.get(f"/api/v1/templates/{entry['id']}")
        expected = json.loads((catalog.FIXTURE_DIRECTORY / f"{entry['id']}.json").read_bytes())
        assert document.status_code == 200
        assert document.json() == expected


def test_templates_are_independent_copies_and_ignore_working_directory(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.chdir(tmp_path)
    first = catalog.load_template("shared-device-cluster")
    first.scenario.payments.clear()
    assert len(catalog.load_template("shared-device-cluster").scenario.payments) == 16


def test_unknown_templates_and_routes_have_normalized_errors(client: TestClient) -> None:
    for route in ("/api/v1/templates/missing", "/api/v1/missing"):
        response = client.get(route)
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"
        assert response.json()["error"]["issues"] == []
        assert len(response.json()["error"]["requestId"]) == 36


def test_validation_distinguishes_schema_errors_from_invalid_drafts(
    client: TestClient,
    document: dict[str, Any],
) -> None:
    scenario = document["scenario"]
    assert client.post("/api/v1/scenarios/validate", json={"scenario": scenario}).json() == {
        "valid": True,
        "issues": [],
    }
    scenario["payments"][0]["deviceId"] = "missing"
    response = client.post("/api/v1/scenarios/validate", json={"scenario": scenario})
    assert response.status_code == 200
    assert response.json()["valid"] is False
    assert response.json()["issues"][0] == {
        "path": "payments[0].deviceId",
        "code": "missing_node",
        "message": "The referenced device does not exist.",
        "entityId": scenario["payments"][0]["id"],
    }
    scenario["payments"][0]["amountMinor"] = True
    response = client.post("/api/v1/scenarios/validate", json={"scenario": scenario})
    assert response.status_code == 422
    assert response.json()["error"]["issues"][0]["path"] == "payments[0].amountMinor"
    assert response.json()["error"]["issues"][0]["code"] == "int_type"


@pytest.mark.parametrize(
    "headers,body,status,code",
    [
        ({"content-type": "text/plain"}, b"{}", 415, "unsupported_media_type"),
        (
            {"content-type": "application/json", "content-encoding": "gzip"},
            b"{}",
            415,
            "unsupported_encoding",
        ),
        ({"content-type": "application/json"}, b"{broken", 422, "invalid_request"),
    ],
)
def test_bad_transport_and_json_are_normalized(
    client: TestClient,
    headers: dict[str, str],
    body: bytes,
    status: int,
    code: str,
) -> None:
    response = client.post("/api/v1/scenarios/validate", content=body, headers=headers)
    assert response.status_code == status
    assert response.json()["error"]["code"] == code


def test_body_limit_counts_chunks_without_content_length(client: TestClient) -> None:
    def chunks() -> Iterator[bytes]:
        yield b" " * (MAX_BODY_BYTES // 2)
        yield b" " * (MAX_BODY_BYTES // 2 + 1)

    response = client.post(
        "/api/v1/scenarios/validate", content=chunks(), headers={"content-type": "application/json"}
    )
    assert "content-length" not in response.request.headers
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"
    assert response.json()["error"]["message"] == "Request bodies must not exceed 16 MiB."


def test_stream_limit_stops_before_calling_application() -> None:
    messages = iter(
        [
            {"type": "http.request", "body": b" " * MAX_BODY_BYTES, "more_body": True},
            {"type": "http.request", "body": b"x", "more_body": True},
        ]
    )
    sent: list[Message] = []

    async def receive() -> Message:
        return next(messages)

    async def send(message: Message) -> None:
        sent.append(message)

    async def forbidden_app(*args: object) -> None:
        pytest.fail("Oversized body reached the application")

    asyncio.run(
        RequestBoundary(forbidden_app)(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/v1/scenarios/validate",
                "headers": [(b"content-type", b"application/json")],
            },
            receive,
            send,
        )
    )
    assert sent[0]["status"] == 413


def test_internal_failure_is_safe_and_has_request_id(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(catalog, "FIXTURE_DIRECTORY", tmp_path)
    response = client.get("/api/v1/templates")
    assert response.status_code == 500
    assert response.json()["error"]["message"] == "The server could not complete the request."
    assert str(tmp_path) not in response.text
    assert len(response.json()["error"]["requestId"]) == 36


def test_openapi_describes_strict_nodes_and_complete_simulation() -> None:
    schema = app.openapi()
    scenario = schema["components"]["schemas"]["ScenarioDefinition"]
    assert scenario["additionalProperties"] is False
    assert scenario["properties"]["nodes"]["items"]["discriminator"]["propertyName"] == "type"
    assert schema["paths"]["/api/v1/simulations"]["post"]["operationId"] == "simulateScenario"


def test_simulation_http_is_complete_and_rejects_semantically_invalid_drafts(
    client: TestClient,
) -> None:
    scenario = load_template("shared-device-cluster").scenario.model_dump(by_alias=True)
    first = client.post("/api/v1/simulations", json={"scenario": scenario})
    assert first.status_code == 200
    body = first.json()
    assert body["engineVersion"] == "engine-ml-upload-v9" and len(body["events"]) == 16
    assert body["events"][9]["riskScore"] is None
    assert body["events"][9]["model"]["version"] == "ml-upload-v9"
    assert body["metrics"]["decisions"]["block"]["count"] == 0
    second = client.post("/api/v1/simulations", json={"scenario": scenario}).json()
    assert body.pop("runId") != second.pop("runId")
    assert body.pop("completedAt").endswith("Z") and second.pop("completedAt").endswith("Z")
    assert body == second
    scenario["payments"][0]["deviceId"] = "missing"
    response = client.post("/api/v1/simulations", json={"scenario": scenario})
    assert (
        response.status_code == 422
        and response.json()["error"]["issues"][0]["code"] == "missing_node"
    )
