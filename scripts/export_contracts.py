import json
from pathlib import Path

from app.domain.model_scores import SCORE_VERSION
from app.main import app
from ml.adaptation_runtime import MANIFEST_SHA256 as ADAPTATION_SHA
from ml.adaptation_runtime import runtime as adaptation_runtime
from ml.artifacts import digest
from ml.card_priority_runtime import BUNDLE as REVIEW
from ml.card_priority_runtime import MANIFEST_SHA256 as REVIEW_SHA
from ml.coverage_runtime import BUNDLE as CARD
from ml.coverage_runtime import MANIFEST_SHA256 as CARD_SHA
from ml.precision_runtime import BUNDLE as V8
from ml.precision_runtime import MANIFEST_SHA256 as V8_SHA
from ml.probability_runtime import MANIFEST_SHA256 as PROBABILITY_SHA
from ml.probability_runtime import runtime as probability_runtime
from ml.stack_runtime import BUNDLE as STACK_BUNDLE
from ml.stack_runtime import EXPERTS, REVIEW_FRACTION
from ml.stack_runtime import MANIFEST_SHA256 as STACK_SHA

destination = Path(__file__).resolve().parents[1] / "contracts" / "openapi.json"
destination.parent.mkdir(exist_ok=True)
destination.write_text(json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
(destination.parent / "adaptation-spec.json").write_text(
    json.dumps(
        {**adaptation_runtime().manifest, "bundle_sha256": ADAPTATION_SHA}, indent=2, sort_keys=True
    )
    + "\n",
    encoding="utf-8",
)
print(f"Exported {destination.name}")

(destination.parent / "stack-spec.json").write_text(
    json.dumps(
        {
            "bundle_sha256": STACK_SHA,
            "experts": EXPERTS,
            "review_fraction": REVIEW_FRACTION,
            "review_policy": "daily",
            "explanation_features": json.loads((STACK_BUNDLE / "manifest.json").read_text())[
                "models"
            ]["stack_d5"]["features"],
            "expert_features": {
                name: entry["features"]
                for name, entry in json.loads((STACK_BUNDLE / "manifest.json").read_text())[
                    "models"
                ].items()
                if name in EXPERTS
            },
        },
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)

manifests = {}
for name, directory, expected in (
    ("review", REVIEW, REVIEW_SHA),
    ("v8", V8, V8_SHA),
    ("card", CARD, CARD_SHA),
):
    assert digest(directory / "manifest.json") == expected
    manifests[name] = json.loads((directory / "manifest.json").read_text())
spec = {
    "version": SCORE_VERSION,
    "formula": "100 / (1 + exp(-(raw_margin - reference_threshold)))",
    "referenceValue": 50,
    "probabilityAvailable": False,
    "interpretation": "Monotone model evidence index. Compare within a route, not across models. "
    "Use exact raw margins for ranking metrics. Not a calibrated fraud probability.",
    "thresholds": {
        "coverage": manifests["card"]["threshold"],
        "online_specialist": manifests["v8"]["threshold"],
        "card_pattern": manifests["review"]["threshold"],
        "card_priority": manifests["review"]["priority_threshold"],
    },
}
(destination.parent / "score-spec.json").write_text(
    json.dumps(spec, indent=2, sort_keys=True) + "\n", encoding="utf-8"
)
(destination.parent / "probability-spec.json").write_text(
    json.dumps(
        {**probability_runtime().manifest, "bundle_sha256": PROBABILITY_SHA},
        indent=2,
        sort_keys=True,
    )
    + "\n",
    encoding="utf-8",
)
