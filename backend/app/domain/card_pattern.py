import math
from typing import Any

from app.domain.model_scores import probability_score
from app.schemas.simulation import CardPatternPriority, CardPatternReview, CardPatternScores
from ml.card_priority_runtime import MANIFEST_SHA256, runtime


def card_scores(frame: Any, model_alerts: Any) -> list[CardPatternScores | None]:
    reviewer = runtime()
    scores, flags = reviewer.predict(frame, model_alerts)
    priority_scores, priorities = reviewer.prioritize(frame, flags)
    return [
        CardPatternScores(
            bundle_sha256=MANIFEST_SHA256,
            pattern=probability_score(
                float(scores[i]), float(reviewer.manifest["threshold"]), "card_pattern"
            ),
            priority=probability_score(
                float(priority_scores[i]),
                float(reviewer.manifest["priority_threshold"]),
                "card_priority",
            ),
            history_count=int(row.history_samples),
            review_suggested=bool(flags[i]),
            prioritized=bool(priorities[i]),
        )
        if row.channel != "Online Transaction" and row.history_samples >= 10
        else None
        for i, row in frame.iterrows()
    ]


def reviews(
    frame: Any, model_alerts: Any, values: list[CardPatternScores | None] | None = None
) -> list[CardPatternReview | None]:
    values = card_scores(frame, model_alerts) if values is None else values
    result: list[CardPatternReview | None] = []
    for i, value in enumerate(values):
        if value is None or not value.review_suggested:
            result.append(None)
            continue
        row = frame.iloc[i]
        count = int(row.history_samples)
        attempts = int(row.attempts_1h)
        raw_percentile = float(row.amount_percentile)
        percentile = raw_percentile if math.isfinite(raw_percentile) else None
        observations = [
            f"{count} prior completed purchases in the submitted history.",
            f"{attempts} earlier attempts in the preceding hour.",
        ]
        if percentile is not None:
            observations.append(
                f"Amount at the {percentile * 100:.0f}th percentile of prior purchase amounts."
            )
        if row.last_channel_changed == 1:
            observations.append("Payment method differs from the previous attempt.")
        result.append(
            CardPatternReview(
                version="card-pattern-v5",
                bundle_sha256=MANIFEST_SHA256,
                margin=value.pattern.raw_margin,
                threshold=value.pattern.reference_threshold,
                history_count=count,
                prior_hour_attempts=attempts,
                amount_percentile=percentile,
                observations=observations,
                priority=CardPatternPriority(
                    level="prioritized" if value.prioritized else "exploratory",
                    margin=value.priority.raw_margin,
                    threshold=value.priority.reference_threshold,
                ),
            )
        )
    return result
