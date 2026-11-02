import argparse
import csv
import hashlib
import json
from collections import Counter
from decimal import Decimal
from pathlib import Path


def prepare(source: Path, output: Path, start: str, end: str, users: int) -> dict:
    output.mkdir(parents=True, exist_ok=False)
    groups: dict[str, list[dict[str, str]]] = {"development": [], "holdout": []}
    labels: dict[str, list[dict[str, str]]] = {key: [] for key in groups}
    occurrences: Counter[str] = Counter()
    scanned = 0
    with source.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        for row in reader:
            scanned += 1
            user = int(row["User"])
            if user >= users * 2:
                continue
            date = f"{int(row['Year']):04}-{int(row['Month']):02}-{int(row['Day']):02}"
            if not start <= date < end:
                continue
            group = "development" if user < users else "holdout"
            payload = {key: value for key, value in row.items() if key != "Is Fraud?"}
            digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
            occurrences[digest] += 1
            identifier = f"ibm-{digest[:32]}-{occurrences[digest]}"
            amount = Decimal(row["Amount"].replace("$", ""))
            event = {
                "event_id": identifier,
                "account_id": f"ibm-user-{user}-card-{row['Card']}",
                "timestamp": f"{date}T{row['Time']}:00.000Z",
                "amount": str(amount),
                "currency": "USD",
                "direction": "credit" if amount < 0 else "debit",
                "transaction_type": "credit_adjustment" if amount < 0 else "purchase",
                "status": "failed" if row["Errors?"].strip() else "completed",
                "merchant_id": row["Merchant Name"],
                "merchant_category": f"MCC {row['MCC']}",
                "channel": row["Use Chip"],
                "merchant_state": row["Merchant State"],
                "merchant_city": row["Merchant City"],
                "merchant_zip": row["Zip"],
                "source_time_assumption": (
                    "Synthetic local clock treated as UTC; actual timezone unknown"
                ),
            }
            groups[group].append(event)
            if len(groups[group]) > 10000:
                raise ValueError("Selected group exceeds 10,000 records; choose a shorter period.")
            labels[group].append(
                {
                    "event_id": identifier,
                    "outcome": row["Is Fraud?"],
                    "timestamp": event["timestamp"],
                }
            )
    with source.open("rb") as stream:
        source_hash = hashlib.file_digest(stream, "sha256").hexdigest()
    manifest = {
        "source_file": source.name,
        "source_bytes": source.stat().st_size,
        "source_sha256": source_hash,
        "scanned_rows": scanned,
        "start_inclusive": start,
        "end_exclusive": end,
        "users_per_group": users,
        "selection_uses_labels": False,
        "assumptions": [
            "IBM synthetic data, not real customer transactions.",
            "User+Card identifies an instrument-scoped account, not a bank account or device.",
            "USD assumed for dollar-denominated source amounts; no conversion.",
            "Timezone absent: synthetic timestamps use UTC only as a reproducible "
            "clock convention.",
            "No source availability is invented; retrospective analysis only.",
            "No errors treated as completed purchase; errors treated as failed attempts "
            "(adapter assumption).",
            "Negative amounts are unclassified incoming adjustments, not invented linked refunds.",
            "Merchant geography is not customer location. Card/user demographics are not imported.",
            "Identity is content hash plus duplicate occurrence; "
            "source has no authoritative event IDs.",
            "Raw MCC vocabulary is preserved; MCC does not establish recurring-bill identity.",
            "Labels stay in separate files, never in assessment inputs.",
        ],
        "groups": {},
    }
    for group, rows in groups.items():
        if not rows or len(rows) > 10000:
            raise ValueError(f"{group} has {len(rows)} records; select a bounded nonempty period.")
        rows.sort(key=lambda row: (row["timestamp"], row["event_id"]))
        labels[group].sort(key=lambda row: (row["timestamp"], row["event_id"]))
        for name, values in ((group, rows), (f"{group}-labels", labels[group])):
            with (output / f"{name}.csv").open("w", encoding="utf-8", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=list(values[0]))
                writer.writeheader()
                writer.writerows(values)
        manifest["groups"][group] = {
            "rows": len(rows),
            "accounts": len({row["account_id"] for row in rows}),
            "sha256": hashlib.sha256((output / f"{group}.csv").read_bytes()).hexdigest(),
        }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("training_data/raw/ibm/credit_card_transactions-ibm_v2.csv"),
    )
    parser.add_argument("--output", type=Path, default=Path("training_data/imports/ibm"))
    parser.add_argument("--start", default="2018-01-01")
    parser.add_argument("--end", default="2018-07-01")
    parser.add_argument("--users", type=int, default=4)
    args = parser.parse_args()
    print(
        json.dumps(
            prepare(args.source, args.output, args.start, args.end, args.users),
            indent=2,
        )
    )
