import os
from pathlib import Path

from app.domain.validation import validate_scenario
from app.schemas.responses import TemplateSummary
from app.schemas.scenario import ScenarioDocument

TEMPLATE_IDS = (
    "shared-device-cluster",
    "everyday-purchases",
    "stolen-card-burst",
    "account-takeover",
)
FIXTURE_DIRECTORY = Path(
    os.environ.get(
        "RISKFLOW_FIXTURES_DIR", Path(__file__).resolve().parents[3] / "fixtures" / "scenarios"
    )
).resolve()


def load_template(template_id: str) -> ScenarioDocument:
    if template_id not in TEMPLATE_IDS:
        raise KeyError(template_id)
    document = ScenarioDocument.model_validate_json(
        (FIXTURE_DIRECTORY / f"{template_id}.json").read_bytes()
    )
    if validate_scenario(document.scenario):
        raise ValueError(f"Template {template_id} violates scenario integrity.")
    if document.scenario.source_template_id != template_id:
        raise ValueError(f"Template {template_id} has mismatched provenance.")
    return document


def list_templates() -> list[TemplateSummary]:
    summaries = []
    for template_id in TEMPLATE_IDS:
        scenario = load_template(template_id).scenario
        if scenario.source_template_version is None:
            raise ValueError(f"Template {template_id} has no version.")
        summaries.append(
            TemplateSummary(
                id=template_id,
                version=scenario.source_template_version,
                title=scenario.name,
                narrative=scenario.description or "",
                nodeCount=len(scenario.nodes),
                paymentCount=len(scenario.payments),
            )
        )
    return summaries
