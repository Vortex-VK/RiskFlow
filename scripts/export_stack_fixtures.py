"""Export reproducible current API examples without modifying historical fixtures."""

import base64
import json
from pathlib import Path

from app.domain.assessment import assess_history
from app.domain.engine import simulate
from app.domain.explanation import explain_payment
from app.domain.ingestion import read_import
from app.schemas.explanation import ExplanationRequest
from app.schemas.history import Dataset, ImportRequest
from app.templates.catalog import load_template

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "fixtures/runtime/stack-d5"
NOW = "2026-10-28T00:00:00.000Z"


def main():
    document = load_template("shared-device-cluster")
    result = simulate(document.scenario).model_dump(by_alias=True)
    result.update(runId="stack-example", completedAt=NOW)
    (DEST / "run.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    event = max(result["events"], key=lambda e: e["model"]["ranking"]["rawMargin"])
    explanation = explain_payment(
        ExplanationRequest.model_validate(
            {
                "scenario": document.scenario,
                "eventId": event["eventId"],
                "modelBundleSha256": event["model"]["bundleSha256"],
                "expectedRawMargin": event["model"]["ranking"]["rawMargin"],
            }
        )
    )
    (DEST / "explanation.json").write_text(
        explanation.model_dump_json(by_alias=True, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    source = ROOT / "frontend/public/samples/card-pattern-demo.csv"
    _, _, parsed, failures = read_import(
        ImportRequest(
            filename=source.name, content_base64=base64.b64encode(source.read_bytes()).decode()
        ),
        "stack-demo",
    )
    assert not failures
    events = [event for _, event in parsed]
    dataset = Dataset(
        id="stack-demo",
        name="Stack example",
        source_namespace="stack-demo",
        revision=1,
        event_count=len(events),
        created_at=NOW,
    )
    run = assess_history(dataset, events).model_dump(by_alias=True)
    run.update(id="stack-assessment", recordedAt=NOW)
    run["simulation"].update(runId="stack-assessment", completedAt=NOW)
    (DEST / "assessment.json").write_text(json.dumps(run, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
