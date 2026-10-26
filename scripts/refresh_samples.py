"""Refresh active-engine metrics without changing any curated sample CSV."""

import csv
import json

import numpy as np

from ml.adaptation_runtime import MANIFEST_SHA256, runtime
from ml.artifacts import ROOT, digest, write_json
from ml.features.upload_context import feature_frame
from ml.sample_inputs import payments


def refresh() -> None:
    from app.domain.engine import ENGINE_VERSION

    if ENGINE_VERSION != "engine-ml-upload-v9":
        raise ValueError("Install Upload-v9 before refreshing its active catalog")
    path = ROOT / "frontend/src/features/samples/catalog.json"
    catalog = json.loads(path.read_text())
    report = ROOT / "docs/sample-library/upload-v9"
    report.mkdir(parents=True, exist_ok=True)
    for sample in catalog["samples"]:
        source = ROOT / "frontend/public/samples/ibm" / sample["file"]
        if digest(source) != sample["sha256"]:
            raise ValueError("Sample CSV changed")
        with source.open(newline="", encoding="utf-8") as stream:
            rows = list(csv.DictReader(stream))
        frame = feature_frame(payments(rows))
        _, paths = runtime().predict(frame)
        labels = {
            f"CSV_{i + 2:03}": r["Is Fraud?"] == "Yes" for i, r in enumerate(rows)
        }
        truth = frame.id.map(labels).to_numpy(dtype=bool)
        detected = paths["alert"]
        counts = {
            "truePositive": int(np.sum(truth & detected)),
            "falsePositive": int(np.sum(~truth & detected)),
            "falseNegative": int(np.sum(truth & ~detected)),
            "trueNegative": int(np.sum(~truth & ~detected)),
        }
        original = json.loads(
            (ROOT / "docs/sample-library" / f"{sample['id']}.json").read_text()
        )
        lineage = {item["eventId"]: item for item in original}
        predictions = [
            {**lineage[identifier], "alert": bool(alert)}
            for identifier, alert in zip(frame.id, detected, strict=True)
        ]
        write_json(report / f"{sample['id']}.json", predictions)
        sample["metrics"] = counts
        sample["alertCount"] = int(detected.sum())
        print(json.dumps({"sample": sample["id"], **counts}), flush=True)
    catalog.update(
        version=max(6, catalog["version"]),
        model="Upload-v9",
        policy="mixed-source",
        bundleSha256=MANIFEST_SHA256,
        resultsDirectory="docs/sample-library/upload-v9",
    )
    write_json(path, catalog)
    write_json(report / "catalog.json", catalog)


if __name__ == "__main__":
    refresh()
