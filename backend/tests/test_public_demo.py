import asyncio

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.responses import Response

from app.api.public_demo import PublicDemo


def demo_client():
    app = FastAPI()

    @app.api_route("/{path:path}", methods=["GET", "POST", "DELETE"])
    def endpoint(path: str):
        return {"path": path}

    app.add_middleware(PublicDemo)
    return TestClient(app)


@pytest.mark.parametrize("method", ["get", "post", "delete"])
@pytest.mark.parametrize(
    "path", ["/api/v2/datasets", "/api/v2/datasets/", "/api/v2/datasets/x/runs"]
)
def test_public_demo_never_reaches_saved_dataset_handlers(method, path):
    with demo_client() as client:
        assert getattr(client, method)(path).status_code == 404
        assert client.get("/api/v2/analysis-capabilities").status_code == 200


def test_simulation_budget_expires_and_cannot_be_bypassed_with_forwarding_headers(monkeypatch):
    now = [100.0]
    monkeypatch.setattr("app.api.public_demo.monotonic", lambda: now[0])
    with demo_client() as client:
        for i in range(20):
            assert client.post(
                "/api/v1/simulations", headers={"X-Forwarded-For": str(i)}
            ).is_success
        response = client.post("/api/v1/simulations/")
        assert response.status_code == 429
        assert response.headers["retry-after"] == "60"
        assert response.headers["cache-control"] == "no-store"
        assert response.json()["error"]["code"] == "demo_busy"
        assert client.post("/api/v1/explanations").status_code == 429
        assert client.post("/api/v1/explanations/compare").status_code == 429
        for path in ["/", "/samples/ibm/first-five.csv", "/api/v1/health"]:
            assert client.get(path).is_success
        now[0] += 60
        assert client.post("/api/v1/simulations").is_success


def test_all_api_writes_have_a_bounded_budget(monkeypatch):
    monkeypatch.setattr("app.api.public_demo.monotonic", lambda: 100.0)
    with demo_client() as client:
        for _ in range(60):
            assert client.post("/api/v1/scenarios/validate").is_success
        assert client.post("/api/v1/scenarios/validate").status_code == 429
        assert client.post("/api/v1/simulations").status_code == 429


@pytest.mark.parametrize("finish", ["success", "failure", "cancel"])
def test_concurrent_simulations_reject_without_queueing_and_release_on_exit(finish):
    async def exercise():
        entered = asyncio.Event()
        release = asyncio.Event()

        async def endpoint(scope, receive, send):
            entered.set()
            await release.wait()
            if finish == "failure":
                raise RuntimeError("Inference failed")
            await Response()(scope, receive, send)

        demo = PublicDemo(endpoint)

        async def request():
            messages = []

            async def receive():
                return {"type": "http.request", "body": b""}

            async def send(message):
                messages.append(message)

            await demo(
                {"type": "http", "path": "/api/v1/simulations", "method": "POST"},
                receive,
                send,
            )
            return messages[0]["status"]

        first = asyncio.create_task(request())
        await asyncio.wait_for(entered.wait(), timeout=2)
        assert await request() == 429
        if finish == "cancel":
            first.cancel()
            with pytest.raises(asyncio.CancelledError):
                await first
        else:
            release.set()
            if finish == "failure":
                with pytest.raises(RuntimeError):
                    await first
            else:
                assert await first == 200
        assert not demo.simulating

    asyncio.run(exercise())
