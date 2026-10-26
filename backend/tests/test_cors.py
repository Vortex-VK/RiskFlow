import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.cors import configure_cors
from app.api.public_demo import PublicDemo


def client_for(origins):
    app = FastAPI()
    app.add_middleware(PublicDemo)
    configure_cors(app, origins)
    return TestClient(app)


def test_pages_preflight_and_public_boundary_responses():
    with client_for("https://riskflow.example/") as client:
        response = client.options(
            "/api/v1/simulations",
            headers={
                "Origin": "https://riskflow.example",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "https://riskflow.example"
        # Public-demo errors must remain readable by the authorized frontend.
        response = client.get(
            "/api/v2/datasets", headers={"Origin": "https://riskflow.example"}
        )
        assert response.status_code == 404
        assert response.headers["access-control-allow-origin"] == "https://riskflow.example"
        assert "access-control-allow-credentials" not in response.headers


@pytest.mark.parametrize("origins", ["", "https://riskflow.example"])
def test_other_origins_are_not_allowed(origins):
    with client_for(origins) as client:
        response = client.options(
            "/api/v1/simulations",
            headers={
                "Origin": "https://untrusted.example",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize(
    "origin", ["*", "https://*.pages.dev", "http://example.com", "https://example.com/path"]
)
def test_invalid_origins_fail_configuration(origin):
    with pytest.raises(ValueError, match="exact HTTPS origins"):
        configure_cors(FastAPI(), origin)
