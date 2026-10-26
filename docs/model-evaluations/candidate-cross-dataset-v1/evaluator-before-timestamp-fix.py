"""Frozen candidate evaluation across sources, with explicit compatibility boundaries."""

import argparse
import gc
import json
import zipfile
from decimal import Decimal
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import select_authored_policy as policy
import train_authored_adaptation as first
import train_authored_residual as second
from catboost import CatBoostClassifier

from app.schemas.scenario import PaymentEvent
from ml.artifacts import ROOT, digest, write_json
from ml.features.upload_context import feature_frame
from ml.upload_precision_transfer import SPARKOV, sparkov_payments

REPORT = ROOT / "docs/model-evaluations/candidate-cross-dataset-v1"
WORK = ROOT / "training_data/candidate-cross-dataset-v1"


def read(path: Path) -> Any:
    return json.loads(path.read_text())


def freeze() -> None:
    REPORT.mkdir(parents=True, exist_ok=False)
    WORK.mkdir(parents=True, exist_ok=False)
    source = ROOT / "training_data/ml-general/data"
    write_json(
        REPORT / "protocol.json",
        {
            "version": "candidate-cross-dataset-v1",
            "code_sha256": digest(Path(__file__)),
            "candidate_freeze_sha256": digest(policy.REPORT / "frozen.json"),
            "candidate_code": {
                Path(m.__file__).name: digest(Path(m.__file__)) for m in (policy, first, second)
            },
            "source_hashes": {
                "sparkov_archive": digest(SPARKOV / "source.zip"),
                "ieee_transactions": digest(source / "train_transaction.csv"),
                "ieee_identity": digest(source / "train_identity.csv"),
            },
            "plan": {
                "ibm": "Recount all four frozen wide/short native prediction populations and "
                "two older-online diagnostics. Verify bytes and candidate dependency hashes. "
                "No rerun or reselection needed for unchanged predictions.",
                "authored": "Recount the1935-row customer-heldout slice only; fitting and "
                "selection rows excluded from accuracy claims. Independently rerun "
                "the saved head and verify probability equality.",
                "ieee": "Inspect actual source columns. This candidate has no valid direct "
                "adapter: no authoritative account/merchant identities, MCC, native "
                "chip/swipe/online channel or completion history. Do not invent them. "
                "Reproduce separately trained IEEE-v1 selected base-seed predictions "
                "and probability mapping, reporting as a different model, never as "
                "candidate transfer accuracy.",
                "sparkov": "First100000 fraudTrain.csv rows, no label sampling, ten10000-row "
                "uploads with state reset. Replay existing three assumed channels: "
                "Chip/Swipe/Online. MCC0000, empty merchant geography, completed=true, "
                "naive time treatedUTC, nominal amounts. Missing fields make this "
                "assumption sensitivity, not native compatibility or validated accuracy. "
                "Freeze predictions before extracting outcomes; do not pick best channel.",
                "authored_unlabeled": "All four existing generated-2400 input variants, preserving "
                "documented assigned channels/MCC/merchant identity. No labels: "
                "report score distributions and alert workload only.",
            },
            "metrics": "Fixed90% estimate cutoff and previously selected reference policies; "
            "precision/recall/counts, AP, ROC AUC, RMSE/Brier/logloss by class. "
            "No refit, calibration, threshold tuning, promotion or deployment.",
            "limitations": "Synthetic IBM/authored/Sparkov and already exposed evaluation sources. "
            "Views share rows. Sources differ in prevalence and available fields; "
            "do not pool them into one accuracy headline. IEEE model is separate.",
        },
    )


def checked() -> Any:
    protocol = read(REPORT / "protocol.json")
    assert digest(Path(__file__)) == protocol["code_sha256"]
    assert digest(policy.REPORT / "frozen.json") == protocol["candidate_freeze_sha256"]
    for module in (policy, first, second):
        assert (
            digest(Path(module.__file__)) == protocol["candidate_code"][Path(module.__file__).name]
        )
    return protocol


def candidate() -> tuple[Any, Any]:
    checked()
    spec = read(policy.REPORT / "frozen.json")["selected"]
    assert digest(policy.WORK / spec["file"]) == spec["sha256"]
    model = CatBoostClassifier()
    model.load_model(str(policy.WORK / spec["file"]))
    return model, spec


def metrics(y: Any, p: Any, cutoff: Any) -> dict[str, Any]:
    from sklearn.metrics import roc_auc_score

    y, p = np.asarray(y, dtype=bool), np.asarray(p, dtype=float)
    assert y.shape == p.shape and np.isfinite(p).all() and ((p >= 0) & (p <= 1)).all()
    result = first.summary(y, p, cutoff)
    if not (p >= cutoff).any():
        result["precision"] = None
    result["tn"] = len(y) - result["tp"] - result["fp"] - result["fn"]
    result["fraud_rmse_points"] = (
        float(100 * np.sqrt(np.mean((p[y] - 1) ** 2))) if y.any() else None
    )
    result["legitimate_rmse_points"] = (
        float(100 * np.sqrt(np.mean(p[~y] ** 2))) if (~y).any() else None
    )
    result["roc_auc"] = float(roc_auc_score(y, p)) if y.any() and (~y).any() else None
    return result


def compare(frame: Any, labels: Any) -> dict[str, Any]:
    return {
        "candidate_at_90": metrics(labels, frame.probability, 0.9),
        "v8_at_90": metrics(labels, frame.baseline_probability, 0.9),
        "candidate_frozen_policy": metrics(labels, frame.probability, frame.cutoff),
    }


def core() -> None:
    model, spec = candidate()
    output = REPORT / "native-authored.json"
    if output.exists():
        raise FileExistsError(output)
    previous = read(policy.REPORT / "evaluation.json")
    audit = read(policy.REPORT / "audit.json")
    groups = {**previous["populations"], **audit["additional_diagnostics"]}
    results = {}
    for tag, record in groups.items():
        path = policy.WORK / f"predictions-{tag}.parquet"
        assert digest(path) == record.get("prediction_sha256", record.get("sha256"))
        frame = pd.read_parquet(path)
        result = compare(frame, frame.label)
        for name in ("candidate_at_90", "v8_at_90"):
            for key in ("tp", "fp", "fn"):
                assert result[name][key] == record[name][key]
        result["source_prediction_sha256"] = digest(path)
        results[tag] = result
    frame = first.load("authored")
    frame = frame.loc[frame.fold.eq(0)].reset_index(drop=True)
    saved = pd.read_parquet(policy.WORK / "predictions-authored-heldout.parquet")
    assert frame.id.equals(saved.id)
    np.testing.assert_array_equal(second.calibrated(model, frame, spec), saved.probability)
    write_json(
        output,
        {
            "populations": results,
            "replayed_authored_head_exactly": True,
            "candidate_frozen_sha256": digest(policy.REPORT / "frozen.json"),
        },
    )
    print("Verified IBM and heldout authored results; exact saved-head replay passed.", flush=True)


def ieee() -> None:
    from ml.ieee import config, data, train

    protocol = checked()
    output = REPORT / "ieee.json"
    if output.exists():
        raise FileExistsError(output)
    cols = {}
    for kind in ("transaction", "identity"):
        path = config.SOURCE / f"train_{kind}.csv"
        expected = protocol["source_hashes"][
            f"ieee_{'transactions' if kind == 'transaction' else 'identity'}"
        ]
        assert digest(path) == expected
        cols[kind] = pd.read_csv(path, nrows=0).columns.tolist()
    name = read(config.REPORT / "nomination.json")["selected"]
    seed = config.SEEDS[0]
    freeze = read(config.REPORT / "prediction-freeze.json")
    assert digest(config.WORK / "predictions/manifest.json") == freeze["manifest_sha256"]
    receipt = next(
        r
        for r in read(config.WORK / "predictions/manifest.json")["runs"]
        if r["name"] == name and r["seed"] == seed
    )
    path = config.WORK / "predictions" / receipt["file"]
    assert digest(path) == receipt["sha256"]
    saved = pd.read_parquet(path)
    frame = data.load("final")
    model, model_receipt = train.read_model(name, seed)
    raw = train.score(model, name, frame, model_receipt["features"])
    assert frame.id.equals(saved.id)
    np.testing.assert_allclose(raw, saved.score, atol=1e-12, rtol=0)
    mapping = receipt["calibration"]
    p = 1 / (1 + np.exp(-(mapping["slope"] * raw + mapping["intercept"])))
    np.testing.assert_allclose(p, saved.probability, atol=1e-14, rtol=0)
    reference = 1 / (1 + np.exp(-(mapping["slope"] * receipt["threshold"] + mapping["intercept"])))
    predictions = frame[["id", "label", "day"]].copy()
    predictions["probability"] = p
    predictions.to_parquet(WORK / "ieee-separate-model.parquet", index=False)
    result = {
        "candidate_status": "not_applicable_missing_semantic_inputs",
        "candidate_metrics": None,
        "missing_contract": [
            "authoritative stable account identity",
            "merchant identity and MCC",
            "native chip/swipe/online channel",
            "completion outcome history",
            "absolute calendar semantics for hour/weekday",
        ],
        "available": "TransactionAmt, relative TransactionDT, anonymized card/address/identity "
        "and provider features; usable by a separately trained IEEE model.",
        "source_columns": cols,
        "separate_ieee_reference": {
            "model": name,
            "seed": seed,
            "model_sha256": receipt["model_sha256"],
            "at_90": metrics(frame.label, p, 0.9),
            "frozen_reference_cutoff": float(reference),
            "frozen_reference": metrics(frame.label, p, reference),
            "exact_replay": True,
            "predictions_sha256": digest(WORK / "ieee-separate-model.parquet"),
        },
    }
    write_json(output, result)
    print(json.dumps(result["separate_ieee_reference"]), flush=True)


def sparkov() -> None:
    protocol = checked()
    model, spec = candidate()
    output = REPORT / "sparkov.json"
    if output.exists() or (REPORT / "sparkov-predictions-frozen.json").exists():
        raise FileExistsError("Sparkov already evaluated or predictions frozen")
    archive_path = SPARKOV / "source.zip"
    assert digest(archive_path) == protocol["source_hashes"]["sparkov_archive"]
    with zipfile.ZipFile(archive_path) as archive, archive.open("fraudTrain.csv") as stream:
        raw = pd.read_csv(
            stream,
            usecols=["trans_date_trans_time", "cc_num", "merchant", "amt", "category"],
            nrows=100000,
            dtype=str,
        )
    raw["source_row"] = np.arange(len(raw))
    receipts = {}
    for channel in ("Chip Transaction", "Swipe Transaction", "Online Transaction"):
        parts = []
        for at in range(0, len(raw), 10000):
            frame = first.score_frame(
                feature_frame(
                    sparkov_payments(raw.iloc[at : at + 10000].to_dict("records"), channel)
                )
            )
            part = frame[["id", "account"]].copy()
            part["probability"] = second.calibrated(model, frame, spec)
            part["cutoff"] = policy.cutoffs(frame, spec)
            part["baseline_probability"], part["baseline_alert"] = (
                frame.baseline_probability,
                frame.baseline_alert,
            )
            parts.append(part)
            if (at + 10000) % 20000 == 0:
                print(channel, at + 10000, flush=True)
        saved = pd.concat(parts, ignore_index=True)
        assert saved.id.equals("sparkov-" + raw.source_row.astype(str))
        path = WORK / f"sparkov-{channel.split()[0].lower()}.parquet"
        saved.to_parquet(path, index=False)
        receipts[channel] = {"file": path.name, "sha256": digest(path)}
    write_json(REPORT / "sparkov-predictions-frozen.json", receipts)
    with zipfile.ZipFile(archive_path) as archive, archive.open("fraudTrain.csv") as stream:
        truth = pd.read_csv(stream, usecols=["is_fraud", "trans_num"], nrows=100000)
    assert truth.is_fraud.isin([0, 1]).all() and not truth.trans_num.duplicated().any()
    truth.to_parquet(WORK / "sparkov-labels.parquet", index=False)
    results = {}
    for channel, receipt in receipts.items():
        path = WORK / receipt["file"]
        assert digest(path) == receipt["sha256"]
        results[channel] = compare(pd.read_parquet(path), truth.is_fraud.astype(bool))
        print(json.dumps({channel: results[channel]}), flush=True)
    write_json(
        output,
        {
            "status": "unsupported_input_assumption_sensitivity",
            "populations": results,
            "source_sha256": protocol["source_hashes"]["sparkov_archive"],
            "labels_sha256": digest(WORK / "sparkov-labels.parquet"),
            "accounts": int(raw.cc_num.nunique()),
            "first": raw.trans_date_trans_time.min(),
            "last": raw.trans_date_trans_time.max(),
            "rows_shared_across_conditions": True,
        },
    )


def unlabeled() -> None:
    model, spec = candidate()
    output = REPORT / "authored-unlabeled.json"
    if output.exists():
        raise FileExistsError(output)
    folder = ROOT / "fixtures/evaluations/generated-2400"
    results = {}
    for path in sorted(folder.glob("assumed-*.csv")):
        raw = pd.read_csv(path, dtype=str, keep_default_na=False)
        events = [
            PaymentEvent.model_validate(
                {
                    "id": r["transaction_id"],
                    "accountId": r["account_id"],
                    "merchantId": r["merchant_id"],
                    "deviceId": "unknown",
                    "locationId": "unknown",
                    "occurredAt": r["timestamp"],
                    "amountMinor": int(Decimal(r["amount"]) * 100),
                    "modelInput": {
                        "channel": r["channel"],
                        "mcc": r["mcc"],
                        "completed": r["status"] == "completed",
                        "merchantState": r["merchant_state"],
                        "merchantCity": r["merchant_city"],
                        "merchantZip": "",
                    },
                }
            )
            for r in raw.to_dict("records")
        ]
        frame = first.score_frame(feature_frame(events))
        p = second.calibrated(model, frame, spec)
        saved = frame[["id", "account"]].copy()
        saved["probability"], saved["baseline_probability"] = p, frame.baseline_probability
        saved.to_parquet(WORK / f"{path.stem}.parquet", index=False)
        results[path.name] = {
            "rows": len(frame),
            "accounts": int(frame.account.nunique()),
            "source_sha256": digest(path),
            "candidate_at_90": int((p >= 0.9).sum()),
            "v8_at_90": int(frame.baseline_probability.ge(0.9).sum()),
            "candidate_frozen_policy": int((p >= policy.cutoffs(frame, spec)).sum()),
            "candidate_probability_percentiles": np.quantile(p, [0, 0.5, 0.9, 0.99, 1]).tolist(),
            "fraud_labels_available": False,
            "precision": None,
            "recall": None,
            "prediction_sha256": digest(WORK / f"{path.stem}.parquet"),
        }
    write_json(
        output,
        {
            "scope": "Unlabeled authored sensitivity only; all variants share transactions.",
            "assumptions": read(folder / "assumptions.json"),
            "populations": results,
        },
    )
    print(json.dumps(results), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=["freeze", "core", "ieee", "sparkov", "unlabeled"])
    args = parser.parse_args()
    {"freeze": freeze, "core": core, "ieee": ieee, "sparkov": sparkov, "unlabeled": unlabeled}[
        args.stage
    ]()
    gc.collect()
