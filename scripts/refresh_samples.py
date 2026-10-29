"""Reproduce sample receipts using Stack-d5 and the UI's automatic upload queue.

CSV hashes are verified; this script never selects samples or edits their rows.
"""

import csv
import json
import math

import numpy as np
import pandas as pd
from app.domain.stack_inputs import scenario_frame
from ml.artifacts import ROOT, digest, write_json
from ml.sample_inputs import payments
from ml.stack_runtime import MANIFEST_SHA256, runtime


def sample_inputs(rows):
    if "User" in rows[0]:
        return scenario_frame(payments(rows)), {
            f"CSV_{i + 2:03}": row["Is Fraud?"] == "Yes" for i, row in enumerate(rows)
        }
    # Normalized sample columns match the browser's CSV ranking adapter.
    frame = pd.DataFrame(
        {
            "payment_id": [r["transaction_id"] for r in rows],
            "namespace": "scenario",
            "account_id": [r["account_id"] for r in rows],
            "merchant_id": [r["merchant_id"] for r in rows],
            "amount": [float(r["amount"]) for r in rows],
            "currency": [r["currency"] for r in rows],
            "activity_type": "purchase",
            "timestamp": [r["timestamp"] for r in rows],
            "precision": "second",
            "category": [r.get("mcc") or r["merchant_category"] for r in rows],
            "channel": [r.get("channel", "") for r in rows],
            "completed": [
                1.0
                if r.get("status", "").lower() in {"completed", "posted", "settled"}
                else 0.0
                if r.get("status", "").lower() in {"failed", "declined"}
                else np.nan
                for r in rows
            ],
            "merchant_region": [r.get("merchant_state", "") for r in rows],
            "merchant_city": [r.get("merchant_city", "") for r in rows],
        }
    )
    return frame, {r["transaction_id"]: r["is_fraud"] == "1" for r in rows}


def automatic_queue(scores, ids):
    if not len(scores) or np.min(scores) == np.max(scores):
        count = 0
    elif len(scores) < 20:
        count = math.ceil(len(scores) * 0.01)
    else:
        q1, q3 = np.quantile(scores, [0.25, 0.75], method="linear")
        count = int(np.sum(scores > q3 + 1.5 * (q3 - q1)))
    selected = np.zeros(len(scores), dtype=bool)
    selected[np.lexsort((np.asarray(ids, dtype=str), -scores))[:count]] = True
    return selected


def refresh() -> None:
    from app.domain.engine import ENGINE_VERSION

    if ENGINE_VERSION != "engine-ml-stack-d5":
        raise ValueError("Install Stack-d5 before refreshing its active catalog")
    path = ROOT / "frontend/src/features/samples/catalog.json"
    catalog = json.loads(path.read_text())
    report = ROOT / catalog["resultsDirectory"]
    report.mkdir(parents=True, exist_ok=True)
    for sample in catalog["samples"]:
        source = ROOT / "frontend/public/samples" / sample["file"]
        if digest(source) != sample["sha256"]:
            raise ValueError(f"Sample CSV changed: {sample['id']}")
        with source.open(newline="", encoding="utf-8") as stream:
            rows = list(csv.DictReader(stream))
        frame, labels = sample_inputs(rows)
        frame, margins, _, _ = runtime().predict(frame)
        scores = margins["stack_d5"]
        detected = automatic_queue(scores, frame.payment_id)
        truth = frame.payment_id.map(labels).to_numpy(dtype=bool)
        counts = {
            "truePositive": int(np.sum(truth & detected)),
            "falsePositive": int(np.sum(~truth & detected)),
            "falseNegative": int(np.sum(truth & ~detected)),
            "trueNegative": int(np.sum(~truth & ~detected)),
        }
        original = json.loads((ROOT / sample["lineageFile"]).read_text())
        lineage = {item["eventId"]: item for item in original}
        predictions = [
            {**lineage[identifier], "alert": bool(alert), "rawMargin": float(score)}
            for identifier, alert, score in zip(
                frame.payment_id, detected, scores, strict=True
            )
        ]
        write_json(report / f"{sample['id']}.json", predictions)
        sample["metrics"] = counts
        sample["alertCount"] = int(detected.sum())
        print(
            json.dumps(
                {"sample": sample["id"], "review": sample["alertCount"], **counts}
            ),
            flush=True,
        )
    catalog.update(
        model="Stack-d5", policy="upload-score-tail", bundleSha256=MANIFEST_SHA256
    )
    write_json(path, catalog)
    write_json(report / "catalog.json", catalog)


if __name__ == "__main__":
    refresh()
