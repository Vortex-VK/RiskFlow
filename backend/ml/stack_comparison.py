"""Exact grouped Shapley decomposition of differences in final-head attribution.

The game value is one final-head SHAP contribution, not an expert's raw score.
Three changed expert observations form individual groups. The remaining expert
observations AND all other head inputs form a fourth, explicit context group.
All coalitions (at most 16 per check) are evaluated; no sampling or proportional
allocation of expert scores is used. This is explanatory feature substitution,
not a simulation of feasible payment histories or a causal claim.
"""

import math
from typing import Any

import numpy as np
import pandas as pd
from catboost import Pool

from ml.common import LOCK, ModelUnavailable
from ml.features.stack.compatibility import legacy_frame
from ml.features.stack.features import PORTABLE, build
from ml.stack_runtime import EXPERTS, runtime


def grouped_shapley(values: list[float], count: int) -> list[float]:
    if len(values) != 1 << count or not all(math.isfinite(v) for v in values):
        raise ValueError("Invalid coalition scores")
    result = []
    for feature in range(count):
        value = 0.0
        for mask in range(1 << count):
            if mask & (1 << feature):
                continue
            size = mask.bit_count()
            weight = math.factorial(size) * math.factorial(count - size - 1) / math.factorial(count)
            value += weight * (values[mask | (1 << feature)] - values[mask])
        result.append(value)
    if not math.isclose(sum(result), values[-1] - values[0], abs_tol=1e-7):
        raise ValueError("Comparison does not reconstruct the check difference")
    return result


def _different(left: Any, right: Any) -> bool:
    if pd.isna(left) and pd.isna(right):
        return False
    return bool(left != right)


def _observed(value: Any) -> str | float | None:
    return value if isinstance(value, str) else float(value) if np.isfinite(value) else None


def compare_checks(
    data: Any, selected: int, reference: int
) -> tuple[float, float, list[dict[str, Any]]]:
    try:
        with LOCK:
            engine = runtime()
            normalized, scores, _, _ = engine.predict(data)
            clean = normalized.copy()
            for column in ["account_id", "merchant_id"]:
                clean[column] = [
                    str((a, b)) for a, b in zip(clean.namespace, clean[column], strict=True)
                ]
            portable = build(clean)
            legacy, _ = legacy_frame(clean)
            expert_frame = pd.concat([portable, legacy], axis=1)
            z = {}
            for name, (values, cumulative) in zip(EXPERTS, engine.reference, strict=True):
                q = np.clip(
                    np.interp(scores[name], values, cumulative, left=0, right=1), 1e-5, 1 - 1e-5
                )
                z["expert_" + name] = np.log(q / (1 - q))
            names = engine.manifest["models"]["stack_d5"]["features"]
            inputs = pd.concat(
                [pd.DataFrame(z), portable[PORTABLE].reset_index(drop=True)], axis=1
            )[names]
            head = engine.models["stack_d5"]
            pair = head.get_feature_importance(
                Pool(inputs.iloc[[reference, selected]]), type="ShapValues", thread_count=2
            )
            if not np.isfinite(pair).all() or not np.allclose(
                pair.sum(axis=1), scores["stack_d5"][[reference, selected]], atol=1e-7, rtol=0
            ):
                raise ValueError("Comparison does not match the recorded scores")
            differences = pair[1, :-1] - pair[0, :-1]
            positions = sorted(range(len(names)), key=lambda i: (-abs(differences[i]), names[i]))[
                :4
            ]
            checks = []
            for position in positions:
                feature = names[position]
                if not feature.startswith("expert_"):
                    continue
                name = feature.removeprefix("expert_")
                model = engine.models[name]
                features = engine.manifest["models"][name]["features"]
                observed = expert_frame[features].iloc[[reference, selected]].reset_index(drop=True)
                native = model.get_feature_importance(
                    Pool(observed, cat_features=model.get_cat_feature_indices()),
                    type="ShapValues",
                    thread_count=2,
                )
                changed = [
                    i
                    for i, f in enumerate(features)
                    if _different(observed.iloc[0][f], observed.iloc[1][f])
                ]
                strongest = sorted(
                    changed, key=lambda i: (-abs(native[1, i] - native[0, i]), features[i])
                )[:3]
                individual = [features[i] for i in strongest]
                groups = [[f] for f in individual] + [[f for f in features if f not in individual]]
                count = len(groups)
                hybrids = pd.concat([observed.iloc[[0]]] * (1 << count), ignore_index=True)
                head_inputs = pd.concat(
                    [inputs.iloc[[reference]]] * (1 << count), ignore_index=True
                )
                for mask in range(1 << count):
                    for bit, columns in enumerate(groups):
                        if mask & (1 << bit):
                            for column in columns:
                                hybrids.at[mask, column] = observed.iloc[1][column]
                    if mask & (1 << (count - 1)):
                        head_inputs.iloc[mask] = inputs.iloc[selected]
                raw = model.predict(hybrids, prediction_type="RawFormulaVal", thread_count=2)
                values, cumulative = engine.reference[EXPERTS.index(name)]
                q = np.clip(np.interp(raw, values, cumulative, left=0, right=1), 1e-5, 1 - 1e-5)
                head_inputs[feature] = np.log(q / (1 - q))
                # Confirm the full/empty coalitions reproduce the real endpoints.
                if not np.allclose(
                    head_inputs.iloc[[0, -1]].to_numpy(dtype=float),
                    inputs.iloc[[reference, selected]].to_numpy(dtype=float),
                    atol=1e-7,
                    rtol=0,
                    equal_nan=True,
                ):
                    raise ValueError("Comparison endpoints changed")
                games = head.get_feature_importance(
                    Pool(head_inputs), type="ShapValues", thread_count=2
                )[:, position]
                if not np.allclose(games[[0, -1]], pair[:, position], atol=1e-7, rtol=0):
                    raise ValueError("Head attribution endpoints changed")
                contributions = grouped_shapley([float(v) for v in games], count)
                observations = [
                    {
                        "feature": f,
                        "value": _observed(observed.iloc[1][f]),
                        "reference_value": _observed(observed.iloc[0][f]),
                        "contribution": contributions[i],
                    }
                    for i, f in enumerate(individual)
                ]
                observations.append(
                    {
                        "feature": "other_context",
                        "value": None,
                        "reference_value": None,
                        "contribution": contributions[-1],
                    }
                )
                checks.append(
                    {
                        "feature": feature,
                        "contribution": float(differences[position]),
                        "observations": observations,
                    }
                )
            return float(scores["stack_d5"][selected]), float(scores["stack_d5"][reference]), checks
    except ModelUnavailable:
        raise
    except Exception as exc:
        raise ModelUnavailable("Comparative explanation unavailable.") from exc
