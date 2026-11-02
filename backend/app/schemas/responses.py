from typing import Annotated, Literal

from pydantic import Field

from app.limits import MAX_OBJECTS, MAX_PAYMENTS
from app.schemas.scenario import Identifier, Name, Note, VersionOne, WireModel


class ValidationIssue(WireModel):
    path: str
    code: str
    message: str
    entity_id: str | None = None


class ValidationResult(WireModel):
    valid: bool
    issues: list[ValidationIssue]


class ErrorDetail(WireModel):
    code: str
    message: str
    issues: list[ValidationIssue]
    request_id: str


class ErrorResponse(WireModel):
    error: ErrorDetail


class HealthResponse(WireModel):
    status: Literal["ok"]
    schema_version: VersionOne
    engine_version: str | None


class TemplateSummary(WireModel):
    id: Identifier
    version: Annotated[int, Field(ge=1)]
    title: Name
    narrative: Note
    node_count: Annotated[int, Field(ge=0, le=MAX_OBJECTS)]
    payment_count: Annotated[int, Field(ge=0, le=MAX_PAYMENTS)]
