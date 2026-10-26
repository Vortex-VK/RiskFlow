"""Capture current-engine API fixtures after an intentional contract or model change."""

import base64
import tempfile
from pathlib import Path

from app.domain.engine import simulate
from app.schemas.history import DatasetCreate, ImportRequest
from app.schemas.simulation import RunResult
from app.storage.history import HistoryStore
from app.templates.catalog import load_template
from ml.artifacts import ROOT, write_json


def fixtures() -> None:
    target = ROOT / "fixtures/runtime"
    for name in (
        "shared-device-cluster",
        "everyday-purchases",
        "stolen-card-burst",
        "account-takeover",
    ):
        result = simulate(load_template(name).scenario)
        run = RunResult(
            **result.model_dump(by_alias=True),
            run_id="v9-compatibility",
            completed_at="2026-10-25T00:00:00.000Z",
        )
        write_json(
            target / f"{name}-upload-v9.json",
            run.model_dump(mode="json", by_alias=True),
        )
        if name == "stolen-card-burst":
            write_json(
                target / "upload-v9-compatibility-run.json",
                run.model_dump(mode="json", by_alias=True),
            )
    with tempfile.TemporaryDirectory(prefix="riskflow-v9-fixture-") as directory:
        store = HistoryStore(Path(directory) / "history.sqlite3")
        dataset = store.create(
            DatasetCreate(name="V9 retained", source_namespace="v9-retained")
        )
        source = ROOT / "frontend/public/samples/card-pattern-demo.csv"
        preview = store.preview(
            dataset.id,
            ImportRequest(
                filename=source.name,
                content_base64=base64.b64encode(source.read_bytes()).decode(),
            ),
        )
        store.commit(dataset.id, preview.id)
        result = store.assess(dataset.id, 1)
        assert HistoryStore(store.path).run(dataset.id, result.id) == result
        write_json(
            target / "card-pattern-assessment-v9.json",
            result.model_dump(mode="json", by_alias=True),
        )
    print(
        "Captured V9 simulation and retained-assessment fixtures; historical fixtures unchanged."
    )


if __name__ == "__main__":
    fixtures()
