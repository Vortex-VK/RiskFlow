"""Rebuild the selected fictional demonstrations and their current-model receipts."""

import json

from refresh_samples import refresh
from sample_scenarios import generate

from ml.artifacts import ROOT, digest, write_json


def main():
    receipt = json.loads(
        (ROOT / "docs/sample-library/scenario-selection-2026-10-29.json").read_text()
    )
    generator = ROOT / "scripts/sample_scenarios.py"
    if digest(generator) != receipt["generatorSha256"]:
        raise ValueError(
            "Generator changed; review selection before publishing new samples"
        )
    path = ROOT / "frontend/src/features/samples/catalog.json"
    catalog = json.loads(path.read_text())
    samples = [
        catalog["samples"][0]
    ]  # Retain the unchanged five-payment IBM walkthrough.
    for choice in receipt["selected"]:
        ledger = generate(choice["rows"], choice["family"], choice["seed"])
        relative = f"scenarios/{choice['id']}.csv"
        asset = ROOT / "frontend/public/samples" / relative
        asset.parent.mkdir(parents=True, exist_ok=True)
        ledger.to_csv(asset, index=False, lineterminator="\n")
        lineage_file = f"{catalog['resultsDirectory']}/sources/{choice['id']}.json"
        write_json(
            ROOT / lineage_file,
            [
                {
                    "eventId": row["transaction_id"],
                    "sourceFile": relative,
                    "sourceRow": i + 2,
                    "fraud": row["is_fraud"] == "1",
                }
                for i, row in enumerate(ledger.to_dict("records"))
            ],
        )
        samples.append(
            {
                "id": choice["id"],
                "file": relative,
                "title": choice["title"],
                "description": choice["description"],
                "rows": len(ledger),
                "accounts": int(ledger.account_id.nunique()),
                "merchants": int(ledger.merchant_id.nunique()),
                "fraudCount": int(ledger.is_fraud.astype(int).sum()),
                "alertCount": choice["review"],
                "metrics": {
                    "truePositive": choice["caught"],
                    "falsePositive": choice["falseAlerts"],
                    "falseNegative": choice["missed"],
                    "trueNegative": choice["rows"]
                    - choice["fraud"]
                    - choice["falseAlerts"],
                },
                "bytes": asset.stat().st_size,
                "sha256": digest(asset),
                "start": ledger.timestamp.min()[:10],
                "end": ledger.timestamp.max()[:10],
                "sourceName": "RiskFlow synthetic scenarios",
                "sourceUrl": "./samples/scenarios/README.txt",
                "attributionFile": "scenarios/ATTRIBUTION.txt",
                "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
                "lineageFile": lineage_file,
                "selection": (
                    f"Complete authored {choice['family']} ledger, seed {choice['seed']}. "
                    "Selected for detection quality and rendered graph structure; "
                    "no rows removed or relabeled after scoring."
                ),
                "guidance": (
                    "Explore shared shops and repeat visits, inspect the review queue, "
                    "then compare with the supplied scenario labels."
                ),
            }
        )
    catalog.update(
        version=9,
        samples=samples,
        source="IBM TabFormer and authored RiskFlow synthetic scenarios",
        selectionScope=(
            "Curated demonstrations selected using known outcomes and current automatic queue "
            "performance, not independent or representative validation. Authored scenarios "
            "illustrate mostly in-store spending followed by online card misuse; "
            "they do not represent all fraud types."
        ),
        assumptions=[
            "Authored accounts, merchants, amounts, UTC timestamps and incident labels are "
            "fictional; they are generated before scoring.",
            "Complete candidate ledgers are retained. "
            "No rows are removed or relabeled in response to scores.",
            "The chosen scenario family assumes mostly in-store spending, repeat shops, shared "
            "merchants and occasional online misuse. Rates are scenario assumptions, "
            "not measured population rates.",
            "Each CSV starts its own history; no hidden warmup or fraud feedback is supplied.",
            "Labels and scenario notes are used for evaluation only, never scoring.",
            "The original five-payment IBM walkthrough remains unchanged "
            "with its original attribution.",
        ],
    )
    write_json(path, catalog)
    refresh()


if __name__ == "__main__":
    main()
