from datetime import datetime
from typing import Annotated, Literal, Self

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)
from pydantic.alias_generators import to_camel

from app.limits import MAX_ASSOCIATIONS, MAX_OBJECTS, MAX_PAYMENTS
from app.schemas.countries import COUNTRY_CODES


class WireModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, alias_generator=to_camel)


def validate_identifier(value: str) -> str:
    if value in {"__proto__", "prototype", "constructor"}:
        raise ValueError("Reserved identifiers are not allowed.")
    return value


def validate_timestamp(value: str) -> str:
    parsed = datetime.fromisoformat(value)
    if not 1900 <= parsed.year <= 2100:
        raise ValueError("Timestamp must be within years 1900 through 2100.")
    return value


def validate_name(value: str) -> str:
    if not value.strip():
        raise ValueError("A name cannot contain only whitespace.")
    return value


def validate_country(value: str) -> str:
    if value not in COUNTRY_CODES:
        raise ValueError("Use a supported ISO alpha-2 country code.")
    return value


Identifier = Annotated[
    str,
    StringConstraints(pattern=r"^[A-Za-z0-9_-]{1,64}$"),
    Field(json_schema_extra={"not": {"enum": ["__proto__", "prototype", "constructor"]}}),
    AfterValidator(validate_identifier),
]
Timestamp = Annotated[
    str,
    StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$"),
    AfterValidator(validate_timestamp),
]
Name = Annotated[str, Field(min_length=1, max_length=80), AfterValidator(validate_name)]
Note = Annotated[str, Field(max_length=500)]
CountryCode = Annotated[
    str,
    StringConstraints(pattern=r"^[A-Z]{2}$"),
    Field(json_schema_extra={"enum": sorted(COUNTRY_CODES)}),
    AfterValidator(validate_country),
]
Money = Annotated[int, Field(gt=0, le=100_000_000)]
VersionOne = Annotated[int, Field(ge=1, le=1)]
Category = Literal[
    "groceries", "retail", "dining", "transport", "utilities", "travel", "electronics", "other"
]
RuleId = Literal[
    "unusual_amount",
    "payment_velocity",
    "new_device",
    "unusual_location",
    "merchant_category_deviation",
    "shared_device_accounts",
]


class Node(WireModel):
    id: Identifier
    name: Name


class AccountNode(Node):
    type: Literal["account"]
    opened_at: Timestamp
    typical_amount_minor: Money
    usual_country_codes: Annotated[list[CountryCode], Field(min_length=1, max_length=249)]
    usual_merchant_categories: Annotated[list[Category], Field(min_length=1, max_length=8)]

    @model_validator(mode="after")
    def unique_baselines(self) -> Self:
        if len(set(self.usual_country_codes)) != len(self.usual_country_codes):
            raise ValueError("Usual countries must be unique.")
        if len(set(self.usual_merchant_categories)) != len(self.usual_merchant_categories):
            raise ValueError("Usual merchant categories must be unique.")
        return self


class MerchantNode(Node):
    type: Literal["merchant"]
    category: Category
    country_code: CountryCode


class DeviceNode(Node):
    type: Literal["device"]
    description: Note | None = None


class LocationNode(Node):
    type: Literal["location"]
    country_code: CountryCode
    region_label: Name | None = None


ScenarioNode = Annotated[
    AccountNode | MerchantNode | DeviceNode | LocationNode, Field(discriminator="type")
]


class ContextAssociation(WireModel):
    id: Identifier
    type: Literal["accountDevice", "accountLocation"]
    account_id: Identifier
    target_id: Identifier
    observed_at: Timestamp
    known_from: Timestamp | None


class ModelInput(WireModel):
    channel: Literal["Chip Transaction", "Online Transaction", "Swipe Transaction"]
    mcc: Annotated[str, Field(pattern=r"^[0-9]{4}$")]
    completed: bool
    merchant_state: Annotated[str, Field(max_length=80)] = ""
    merchant_city: Annotated[str, Field(max_length=80)] = ""
    merchant_zip: Annotated[str, Field(max_length=20)] = ""


class RankingInput(WireModel):
    time_precision: Literal["day", "second"]
    activity_type: Annotated[str, Field(max_length=40)]
    category: Annotated[str, Field(max_length=160)]
    channel: Annotated[str, Field(max_length=160)]
    completed: bool | None
    merchant_region: Annotated[str, Field(max_length=160)]
    merchant_city: Annotated[str, Field(max_length=160)]
    source_payment_id: Annotated[str, Field(min_length=1, max_length=512)]
    merchant_id_provided: bool


class PaymentEvent(WireModel):
    id: Identifier
    account_id: Identifier
    merchant_id: Identifier
    device_id: Identifier
    location_id: Identifier
    occurred_at: Timestamp
    amount_minor: Money
    category: Category | None = None
    source_category: Name | None = None
    model_input: ModelInput | None = None
    ranking_input: RankingInput | None = None
    unavailable_rules: Annotated[list[RuleId], Field(max_length=6)] = Field(default_factory=list)

    @model_validator(mode="after")
    def unique_unavailable_rules(self) -> Self:
        if len(set(self.unavailable_rules)) != len(self.unavailable_rules):
            raise ValueError("Unavailable rules must be unique.")
        return self


class DecisionPolicy(WireModel):
    version: VersionOne
    review_threshold: Annotated[int, Field(ge=1, le=100)]
    block_threshold: Annotated[int, Field(ge=1, le=100)]


class CostAssumptions(WireModel):
    approved_fraud_loss_bps: Annotated[int, Field(ge=0, le=10_000)]
    review_cost_minor: Annotated[int, Field(ge=0, le=100_000_000)]
    false_block_cost_minor: Annotated[int, Field(ge=0, le=100_000_000)]


class ScenarioDefinition(WireModel):
    schema_version: VersionOne
    id: Identifier
    name: Name
    description: Note | None = None
    source_template_id: Identifier | None = None
    source_template_version: Annotated[int, Field(ge=1)] | None = None
    scenario_start_at: Timestamp
    currency: Literal["USD"]
    nodes: Annotated[list[ScenarioNode], Field(max_length=MAX_OBJECTS)]
    associations: Annotated[list[ContextAssociation], Field(max_length=MAX_ASSOCIATIONS)]
    payments: Annotated[list[PaymentEvent], Field(max_length=MAX_PAYMENTS)]
    ground_truth: dict[Identifier, Literal["fraudulent", "legitimate"]]
    rule_set_version: Literal["rules-v1"]
    policy: DecisionPolicy
    cost_assumptions: CostAssumptions
    seed: None


Coordinate = Annotated[float, Field(allow_inf_nan=False, gt=-1_000_000, lt=1_000_000)]


class Position(WireModel):
    x: Coordinate
    y: Coordinate


class Viewport(Position):
    zoom: Annotated[float, Field(allow_inf_nan=False, ge=0.25, le=2)]


class ScenarioView(WireModel):
    positions: dict[Identifier, Position]
    viewport: Viewport


class ScenarioDocument(WireModel):
    scenario: ScenarioDefinition
    view: ScenarioView

    @model_validator(mode="after")
    def matching_positions(self) -> Self:
        if set(self.view.positions) != {node.id for node in self.scenario.nodes}:
            raise ValueError("View positions must match the scenario nodes exactly.")
        return self


class ScenarioRequest(WireModel):
    scenario: ScenarioDefinition
