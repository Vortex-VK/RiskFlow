"""Versioned historical evidence indices and trained probability estimates."""

import math

from app.schemas.simulation import EvidenceScore, ScoreSource
from ml.probability_runtime import MANIFEST_SHA256, runtime

SCORE_VERSION = "margin-index-v1"


def evidence_score(margin: float, threshold: float, source: ScoreSource) -> EvidenceScore:
    distance = margin - threshold
    if not all(math.isfinite(v) for v in (margin, threshold, distance)):
        raise ValueError("Finite model margin and reference cutoff required")
    if distance >= 0:
        value = 100 / (1 + math.exp(-distance))
    else:
        exponential = math.exp(distance)
        value = 100 * exponential / (1 + exponential)
    return EvidenceScore(
        source=source,
        value=value,
        raw_margin=margin,
        reference_threshold=threshold,
        distance=distance,
    )


def probability_score(margin: float, threshold: float, source: ScoreSource) -> EvidenceScore:
    model = runtime()
    mapping = model.manifest["sources"][source]
    if threshold != mapping["raw_cutoff"]:
        raise ValueError("Probability model and reference policy do not match")
    return EvidenceScore(
        version="fraud-probability-v1",
        source=source,
        value=100 * model.probability(margin, source),
        raw_margin=margin,
        reference_threshold=threshold,
        distance=margin - threshold,
        reference_value=100 * mapping["reference_probability"],
        probability_available=True,
        probability_bundle_sha256=MANIFEST_SHA256,
        calibration_scope="ibm_synthetic",
    )


def adaptation_score(margin: float, source: ScoreSource) -> EvidenceScore:
    from ml.adaptation_runtime import MANIFEST_SHA256 as ADAPTATION_SHA
    from ml.adaptation_runtime import runtime as adaptation

    model = adaptation()
    mapping = model.manifest["sources"][source]
    threshold = float(mapping["raw_cutoff"])
    return EvidenceScore(
        version="fraud-probability-v2",
        source=source,
        value=100 * float(model.probability([margin])[0]),
        raw_margin=margin,
        reference_threshold=threshold,
        distance=margin - threshold,
        reference_value=100 * mapping["reference_probability"],
        probability_available=True,
        probability_bundle_sha256=ADAPTATION_SHA,
        calibration_scope="ibm_authored_synthetic",
    )
