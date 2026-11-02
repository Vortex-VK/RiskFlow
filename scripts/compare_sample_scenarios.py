"""Score complete authored candidates without altering labels or the model.

Run from the project root with PYTHONPATH=backend. Candidate results stay local
unless explicitly chosen for the public selection receipt.
"""

import argparse
import json
from pathlib import Path

import numpy as np
from refresh_samples import automatic_queue, sample_inputs
from sample_scenarios import FAMILIES, SIZES, generate

from ml.stack_runtime import runtime


def evaluate(rows):
    frame, labels = sample_inputs(rows)
    ordered, raw, _, _ = runtime().predict(frame)
    selected = automatic_queue(raw["stack_d5"], ordered.payment_id)
    truth = ordered.payment_id.map(labels).to_numpy(bool)
    tp, fp, fn = (
        int(np.sum(mask))
        for mask in (truth & selected, ~truth & selected, truth & ~selected)
    )
    pairs = {(r["account_id"], r["merchant_id"]) for r in rows}
    merchant_accounts = {}
    for account, merchant in pairs:
        merchant_accounts.setdefault(merchant, set()).add(account)
    return {
        "rows": len(rows),
        "fraud": int(truth.sum()),
        "caught": tp,
        "falseAlerts": fp,
        "missed": fn,
        "review": int(selected.sum()),
        "precision": tp / max(1, tp + fp),
        "recall": tp / max(1, tp + fn),
        "f1": 2 * tp / max(1, 2 * tp + fp + fn),
        "accounts": len({r["account_id"] for r in rows}),
        "merchants": len(merchant_accounts),
        "distinctConnections": len(pairs),
        "repeatPaymentShare": 1 - len(pairs) / len(rows),
        "sharedMerchants": sum(
            len(accounts) > 1 for accounts in merchant_accounts.values()
        ),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seeds", type=int, default=8)
    parser.add_argument("--output", default=".cache/scenario-candidates.json")
    parser.add_argument("--families", nargs="+", choices=FAMILIES, default=FAMILIES)
    args = parser.parse_args()
    results = []
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        for family in args.families:
            for seed in range(100, 100 + args.seeds):
                result = {
                    "family": family,
                    "seed": seed,
                    **evaluate(generate(size, family, seed).to_dict("records")),
                }
                results.append(result)
                print(json.dumps(result), flush=True)
                output.write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
