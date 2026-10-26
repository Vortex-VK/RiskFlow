import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.templates.catalog import FIXTURE_DIRECTORY


@pytest.fixture
def document() -> dict[str, Any]:
    return json.loads((FIXTURE_DIRECTORY / "shared-device-cluster.json").read_text())


@pytest.fixture
def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)
