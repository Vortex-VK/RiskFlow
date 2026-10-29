"""Frozen stack_d5 inference. No labels, fitting, or research imports at runtime."""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier, Pool

from ml.artifacts import digest
from ml.common import LOCK, ModelUnavailable
from ml.features.stack.compatibility import legacy_frame
from ml.features.stack.features import PORTABLE, build
from ml.features.stack.normalization import normalize

BUNDLE = Path(__file__).resolve().parents[1] / "model_artifacts/stack-d5"
MANIFEST_SHA256 = "672cc88772a0f878b4a3d631e94de920ef08687702eb1e90f4c516bb1d7909ff"
EXPERTS = [
    "v2",
    "rich",
    "relative",
    "pooled",
    "ibm_expert",
    "household_expert",
    "sparkov_expert",
    "handbook_expert",
]
REVIEW_FRACTION = 0.01


@dataclass(frozen=True)
class ScoredSnapshot:
    """Request-local scores and the exact inputs used to produce them.

    Callers treat the frames as read-only. Nothing is retained on the shared
    runtime, so a later request always builds its own payment history.
    """

    normalized: Any
    scores: dict[str, Any]
    selected: Any
    history: Any
    expert_frame: Any
    head_inputs: Any


def daily_queue(data: Any, scores: Any) -> Any:
    """Exact daily ceiling; ties use stable source payment IDs, ascending."""
    groups = data.day.to_numpy()
    ids = data.payment_id.astype(str).to_numpy()
    order = np.lexsort((ids, -scores, groups))
    selected = np.zeros(len(data), dtype=bool)
    if len(order):
        starts = np.r_[0, np.flatnonzero(groups[order][1:] != groups[order][:-1]) + 1]
        counts = np.diff(np.r_[starts, len(order)])
        ranks = np.arange(len(order)) - np.repeat(starts, counts)
        selected[order[ranks < np.repeat(np.ceil(counts * REVIEW_FRACTION), counts)]] = True
    return selected


class Runtime:
    def __init__(self, directory: Path = BUNDLE) -> None:
        try:
            if digest(directory / "manifest.json") != MANIFEST_SHA256:
                raise ValueError("Stack manifest mismatch")
            self.manifest = json.loads((directory / "manifest.json").read_text())
            feature_dir = Path(__file__).resolve().parent / "features/stack"
            for name, expected in self.manifest["runtime_feature_sha256"].items():
                path = feature_dir / name
                if path.parent != feature_dir or digest(path) != expected:
                    raise ValueError("Stack numerical feature code mismatch")
            self.models = {}
            for name in [*EXPERTS, "stack_d5"]:
                entry = self.manifest["models"][name]
                path = directory / entry["file"]
                if path.parent != directory or digest(path) != entry["sha256"]:
                    raise ValueError("Stack model mismatch")
                model = CatBoostClassifier()
                model.load_model(str(path))
                if model.feature_names_ != entry["features"]:
                    raise ValueError("Stack feature contract mismatch")
                self.models[name] = model
            if digest(directory / "reference.npz") != self.manifest["reference_sha256"]:
                raise ValueError("Stack reference mismatch")
            with np.load(directory / "reference.npz", allow_pickle=False) as arrays:
                self.reference = [
                    (arrays[n + "_values"], arrays[n + "_cumulative"]) for n in EXPERTS
                ]
        except Exception as exc:
            raise ModelUnavailable("Stack-d5 package is missing or incompatible.") from exc

    def predict(self, data: Any) -> tuple[Any, dict[str, Any], Any, Any]:
        snapshot = self.score_snapshot(data)
        return snapshot.normalized, snapshot.scores, snapshot.selected, snapshot.history

    def score_snapshot(self, data: Any) -> ScoredSnapshot:
        """All rows must satisfy the purchase contract. Never silently drop a payment."""
        try:
            with LOCK:
                d, valid, _ = normalize(data, "purchase")
                if (
                    not valid.all()
                    or d.merchant_id.eq("").any()
                    or d.currency.ne("USD").any()
                    or d.amount.gt(1_000_000).any()
                    or not d.precision.isin(["second", "day"]).all()
                    or not d.activity_type.isin(["purchase", "charge", "authorization"]).all()
                ):
                    raise ValueError("Unsupported stack inputs")
                if d.empty:
                    return ScoredSnapshot(
                        d,
                        {},
                        np.zeros(0, dtype=bool),
                        np.zeros(0, dtype=int),
                        pd.DataFrame(),
                        pd.DataFrame(),
                    )
                clean = d.copy()
                for column in ["account_id", "merchant_id"]:
                    clean[column] = [
                        str((a, b)) for a, b in zip(clean.namespace, clean[column], strict=True)
                    ]
                portable = build(clean)
                legacy, good = legacy_frame(clean)
                if not good.all():
                    raise ValueError("Missing counterparty")
                frame = pd.concat([portable, legacy], axis=1)
                raw = {}
                z = {}
                for name, (values, cumulative) in zip(EXPERTS, self.reference, strict=True):
                    entry = self.manifest["models"][name]
                    raw[name] = np.asarray(
                        self.models[name].predict(
                            frame[entry["features"]],
                            prediction_type="RawFormulaVal",
                            thread_count=2,
                        )
                    )
                    q = np.clip(
                        np.interp(raw[name], values, cumulative, left=0, right=1), 1e-5, 1 - 1e-5
                    )
                    z["expert_" + name] = np.log(q / (1 - q))
                inputs = pd.concat(
                    [pd.DataFrame(z), portable[PORTABLE].reset_index(drop=True)], axis=1
                )[self.manifest["models"]["stack_d5"]["features"]]
                raw["stack_d5"] = np.asarray(
                    self.models["stack_d5"].predict(
                        inputs,
                        prediction_type="RawFormulaVal",
                        thread_count=2,
                    )
                )
                if not all(np.isfinite(value).all() for value in raw.values()):
                    raise ValueError("Nonfinite model output")
                return ScoredSnapshot(
                    d,
                    raw,
                    daily_queue(d, raw["stack_d5"]),
                    np.rint(np.expm1(portable.p_log_history_n)).astype(int).to_numpy(),
                    frame,
                    inputs,
                )
        except ModelUnavailable:
            raise
        except Exception as exc:
            raise ModelUnavailable("Stack-d5 inference failed; no fallback was produced.") from exc

    def explain(self, data: Any, index: int) -> tuple[Any, Any, Any, float, Any]:
        """Explain the frozen head using the inputs from this request's scoring pass."""
        try:
            with LOCK:
                snapshot = self.score_snapshot(data)
                normalized, scores = snapshot.normalized, snapshot.scores
                inputs = snapshot.head_inputs
                values = self.models["stack_d5"].get_feature_importance(
                    Pool(inputs.iloc[[index]]), type="ShapValues", thread_count=2
                )[0]
                raw = float(scores["stack_d5"][index])
                if not np.isfinite(values).all() or not np.isclose(values.sum(), raw, atol=1e-7):
                    raise ValueError("Stack explanation failed reconstruction")
                # Drill into the two strongest expert inputs without treating this nonlinear
                # composition as a single additive end-to-end feature explanation.
                expert_positions = sorted(
                    range(len(EXPERTS)), key=lambda i: abs(values[i]), reverse=True
                )[:2]
                expert_frame = snapshot.expert_frame
                explanations = []
                for position in expert_positions:
                    name = EXPERTS[position]
                    model = self.models[name]
                    features = self.manifest["models"][name]["features"]
                    selected = expert_frame[features].iloc[[index]]
                    shap = model.get_feature_importance(
                        Pool(selected, cat_features=model.get_cat_feature_indices()),
                        type="ShapValues",
                        thread_count=2,
                    )[0]
                    if not np.isfinite(shap).all() or not np.isclose(
                        shap.sum(), scores[name][index], atol=1e-7
                    ):
                        raise ValueError("Expert explanation failed reconstruction")
                    explanations.append((name, selected.iloc[0], shap, float(scores[name][index])))
                return normalized, inputs.iloc[index], values, raw, explanations
        except ModelUnavailable:
            raise
        except Exception as exc:
            raise ModelUnavailable("Stack explanation unavailable.") from exc


@lru_cache(maxsize=1)
def runtime() -> Runtime:
    with LOCK:
        return Runtime()
