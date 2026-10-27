import math

import numpy as np
from starlette.exceptions import HTTPException

from app.schemas.explanation import ExplanationRequest, FeatureContribution, PaymentExplanation
from ml.adaptation_runtime import MANIFEST_SHA256, runtime
from ml.features.upload_context import feature_frame


def explain_payment(payload: ExplanationRequest) -> PaymentExplanation:
    if payload.model_bundle_sha256 != MANIFEST_SHA256:
        raise HTTPException(409, "This saved result uses a different model version.")
    payment = next((p for p in payload.scenario.payments if p.id == payload.event_id), None)
    if payment is None:
        raise HTTPException(404, "Payment not found in this snapshot.")
    # Keep equal-time peers; feature construction excludes their influence, as in inference.
    payments = sorted(
        (p for p in payload.scenario.payments if p.occurred_at <= payment.occurred_at),
        key=lambda p: (p.occurred_at, p.id),
    )
    frame = feature_frame(payments)
    index = next(i for i, identifier in enumerate(frame.id) if identifier == payment.id)
    model = runtime()
    row, values, raw = model.explain(frame, index)
    if not math.isclose(raw, payload.expected_raw_margin, rel_tol=1e-7, abs_tol=1e-7):
        raise HTTPException(
            409, "This snapshot does not reproduce the saved score. Its original history is needed."
        )
    contributions = []
    for feature, value in zip(model.manifest["features"], values[:-1], strict=True):
        observed = row[feature]
        contributions.append(
            FeatureContribution(
                feature=feature,
                value=observed
                if isinstance(observed, str)
                else float(observed)
                if np.isfinite(observed)
                else None,
                contribution=float(value),
            )
        )
    return PaymentExplanation(
        event_id=payment.id,
        model_bundle_sha256=MANIFEST_SHA256,
        base_value=float(values[-1]),
        raw_margin=raw,
        probability=100 * float(model.probability([raw])[0]),
        contributions=contributions,
    )
