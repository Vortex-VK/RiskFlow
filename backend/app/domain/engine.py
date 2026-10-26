from app.domain.card_pattern import card_scores, reviews
from app.domain.metrics import evaluate_metrics
from app.domain.model_scores import adaptation_score
from app.domain.validation import validate_scenario
from app.schemas.scenario import AccountNode, ScenarioDefinition
from app.schemas.simulation import (
    EventResult,
    Features,
    ModelEvaluation,
    ModelingWarning,
    SimulationResult,
)
from ml.adaptation_runtime import MANIFEST_SHA256, runtime
from ml.features.upload_context import feature_frame
from ml.runtime import ModelUnavailable

ENGINE_VERSION = "engine-ml-upload-v9"


def simulate(scenario: ScenarioDefinition) -> SimulationResult:
    if validate_scenario(scenario):
        raise ValueError("Scenario must pass validation before simulation.")
    snapshot = scenario.model_copy(deep=True)
    snapshot.nodes.sort(key=lambda node: node.id)
    for node in snapshot.nodes:
        if isinstance(node, AccountNode):
            node.usual_country_codes.sort()
            node.usual_merchant_categories.sort()
    snapshot.associations.sort(key=lambda a: a.id)
    snapshot.payments.sort(key=lambda p: (p.occurred_at, p.id))
    frame = feature_frame(snapshot.payments)
    scores, paths = runtime().predict(frame)
    review_warning = []
    try:
        card_values = card_scores(frame, paths["alert"])
        suggestions = reviews(frame, paths["alert"], card_values)
    except ModelUnavailable:
        suggestions = [None] * len(frame)
        card_values = [None] * len(frame)
        review_warning.append(
            ModelingWarning(
                code="card_pattern_unavailable",
                message="Card-pattern review is unavailable. Upload-v9 model results are complete; "
                "no additional review suggestions were produced.",
            )
        )
    events = [
        EventResult(
            event_id=p.id,
            sequence_index=index,
            occurred_at=p.occurred_at,
            amount_minor=p.amount_minor,
            account_id=p.account_id,
            merchant_id=p.merchant_id,
            device_id=p.device_id,
            location_id=p.location_id,
            features=Features(
                amount_minor=p.amount_minor,
                typical_amount_minor=None,
                five_minute_attempt_count=None,
                new_device=None,
                unusual_location=None,
                category_deviation=None,
                shared_device_account_count=None,
            ),
            rule_evaluations=[],
            raw_score=None,
            risk_score=None,
            decision="review" if paths["alert"][index] else "approve",
            card_pattern=suggestions[index],
            card_scores=card_values[index],
            model=ModelEvaluation(
                version="ml-upload-v9",
                policy="mixed-source",
                bundle_sha256=MANIFEST_SHA256,
                alert=bool(paths["alert"][index]),
                raw_scores={name: float(values[index]) for name, values in scores.items()},
                detection_paths=[
                    name for name, values in paths.items() if name != "alert" and values[index]
                ],
                history_count=int(frame.iloc[index]["history_samples"]),
                probability_available=True,
                score=adaptation_score(
                    float(
                        scores[
                            "adapted_online"
                            if p.model_input and p.model_input.channel == "Online Transaction"
                            else "adapted_card"
                        ][index]
                    ),
                    "adapted_online"
                    if p.model_input and p.model_input.channel == "Online Transaction"
                    else "adapted_card",
                ),
            ),
        )
        for index, p in enumerate(snapshot.payments)
    ]
    return SimulationResult(
        scenario_snapshot=snapshot,
        events=events,
        metrics=evaluate_metrics(events, snapshot.ground_truth, snapshot.cost_assumptions),
        warnings=review_warning
        + [
            ModelingWarning(
                code="probability_scope",
                message="Scores estimate fraud probability using a model trained on IBM and "
                "authored synthetic data. "
                "Calibration has not been validated for this upload's source. Each model's "
                "reference probability cutoff is shown separately; it is not necessarily 50%. "
                "Raw margins and the selected card/online policy are recorded. "
                "Probability threshold previews do not change saved decisions.",
            ),
            ModelingWarning(
                code="card_pattern_scope",
                message="Card-pattern suggestions are experimental behavioral reviews, separate "
                "from Upload-v9 alerts. They do not change model decisions or fraud metrics, "
                "and do not identify counterfeit cards or establish fraud.",
            ),
            ModelingWarning(
                code="model_scope",
                message="Upload-v9 is an experimental IBM/authored model using frozen thresholds.  "
                "Matching fields do not establish validity for this upload's source. "
                "Review means a model alert; approve means no alert, not a payment "
                "authorization. No automatic blocking. Raw model margins are not probabilities. "
                "Legacy rule thresholds and device/location baselines do not affect scoring.",
            ),
            ModelingWarning(
                code="incomplete_data",
                message="Features use only this submitted history. "
                "Confirmed delayed merchant-fraud feedback is unavailable and encoded as "
                "zero support. Short histories and missing merchant geography may reduce "
                "performance. Synthetic benchmark metrics do not describe this upload.",
            ),
            ModelingWarning(
                code="attempt_history",
                message="Features use strictly earlier events. "
                "Equal-time events cannot influence each other. Completion status updates "
                "future spending history; current labels are excluded from inference.",
            ),
        ],
    )
