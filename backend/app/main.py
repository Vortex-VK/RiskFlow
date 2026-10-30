import logging
import os
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.middleware.gzip import GZipMiddleware
from starlette.responses import JSONResponse

from app.api.boundary import RequestBoundary, RequestLog, error_response
from app.api.frontend import mount_frontend
from app.api.public_demo import PublicDemo
from app.api.v2 import router as history_router
from app.domain.engine import ENGINE_VERSION, simulate
from app.domain.explanation import explain_payment
from app.domain.model_inputs import UnsupportedModelInput
from app.domain.stack_explanation import explain_comparison
from app.domain.validation import validate_scenario
from app.schemas.behavioral import AnalysisCapabilities
from app.schemas.explanation import (
    ExplanationRequest,
    PaymentExplanation,
    StackComparisonExplanation,
    StackComparisonRequest,
    StackPaymentExplanation,
)
from app.schemas.responses import ErrorResponse, HealthResponse, TemplateSummary, ValidationResult
from app.schemas.scenario import ScenarioDocument, ScenarioRequest
from app.schemas.simulation import RunResult
from app.templates.catalog import list_templates, load_template
from ml.common import ModelUnavailable
from ml.stack_runtime import MANIFEST_SHA256 as STACK_MANIFEST_SHA256
from ml.stack_runtime import runtime

app = FastAPI(
    title="RiskFlow API",
    version="0.1.0",
    responses={status: {"model": ErrorResponse} for status in (404, 413, 415, 422, 500)},
)
app.add_middleware(RequestBoundary)
public_demo = os.environ.get("RISKFLOW_PUBLIC_DEMO", "false").lower() == "true"
if public_demo:
    app.add_middleware(PublicDemo)
app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=5)
app.add_middleware(RequestLog)
logger = logging.getLogger("riskflow.api")


def issue_path(location: tuple[str | int, ...]) -> str:
    parts = list(location)
    if parts and parts[0] == "body":
        parts.pop(0)
    if parts and parts[0] == "scenario":
        parts.pop(0)
    path = ""
    for index, part in enumerate(parts):
        if (
            index == 2
            and parts[0] == "nodes"
            and isinstance(parts[1], int)
            and part in {"account", "merchant", "device", "location"}
        ):
            continue
        if isinstance(part, int):
            path += f"[{part}]"
        else:
            path += ("." if path else "") + part
    return path or "$"


@app.exception_handler(RequestValidationError)
async def handle_validation(request: Request, exc: RequestValidationError) -> JSONResponse:
    issues: list[dict[str, object]] = [
        {"path": issue_path(error["loc"]), "code": error["type"], "message": error["msg"]}
        for error in exc.errors()
    ]
    return error_response(
        422,
        "invalid_request",
        "The request does not match the scenario contract.",
        request.state.request_id,
        issues,
    )


@app.exception_handler(HTTPException)
async def handle_http_error(request: Request, exc: HTTPException) -> JSONResponse:
    return error_response(
        exc.status_code,
        "not_found" if exc.status_code == 404 else "http_error",
        str(exc.detail),
        request.state.request_id,
    )


@app.exception_handler(Exception)
async def handle_server_error(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Request %s failed", request.state.request_id, exc_info=exc)
    return error_response(
        500, "server_error", "The server could not complete the request.", request.state.request_id
    )


@app.exception_handler(UnsupportedModelInput)
async def handle_model_input(request: Request, exc: UnsupportedModelInput) -> JSONResponse:
    return error_response(422, "unsupported_model_input", str(exc), request.state.request_id)


@app.exception_handler(ModelUnavailable)
async def handle_model_unavailable(request: Request, exc: ModelUnavailable) -> JSONResponse:
    logger.error("Stack-d5 unavailable", exc_info=exc)
    return error_response(503, "model_unavailable", str(exc), request.state.request_id)


@app.get("/api/v1/health", response_model=HealthResponse, operation_id="getHealth")
def health() -> HealthResponse:
    runtime()
    return HealthResponse(status="ok", schemaVersion=1, engineVersion=ENGINE_VERSION)


@app.get("/api/v2/analysis-capabilities", operation_id="getAnalysisCapabilities")
def analysis_capabilities() -> AnalysisCapabilities:
    return AnalysisCapabilities(
        retained_modes=["model", "behavioral"], behavioral_currencies=["USD"]
    )


@app.get("/api/v1/templates", response_model=list[TemplateSummary], operation_id="listTemplates")
def templates() -> list[TemplateSummary]:
    return list_templates()


@app.get(
    "/api/v1/templates/{template_id}",
    response_model=ScenarioDocument,
    response_model_exclude_unset=True,
    operation_id="getTemplate",
)
def template(template_id: str) -> ScenarioDocument:
    try:
        return load_template(template_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Unknown scenario template.") from exc


@app.post(
    "/api/v1/scenarios/validate",
    response_model=ValidationResult,
    response_model_exclude_none=True,
    operation_id="validateScenario",
)
def validate(payload: ScenarioRequest) -> ValidationResult:
    issues = validate_scenario(payload.scenario)
    return ValidationResult(valid=not issues, issues=issues)


@app.post("/api/v1/simulations", response_model=RunResult, operation_id="simulateScenario")
def simulation(payload: ScenarioRequest, request: Request) -> RunResult | JSONResponse:
    issues = validate_scenario(payload.scenario)
    if issues:
        return error_response(
            422,
            "invalid_scenario",
            "Correct the scenario before simulating.",
            request.state.request_id,
            [issue.model_dump(by_alias=True, exclude_none=True) for issue in issues],
        )
    result = simulate(payload.scenario)
    return RunResult(
        **result.model_dump(by_alias=True),
        run_id=str(uuid4()),
        completed_at=datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    )


@app.post(
    "/api/v1/explanations",
    response_model=PaymentExplanation | StackPaymentExplanation,
    operation_id="explainPayment",
)
def explanation(payload: ExplanationRequest) -> PaymentExplanation | StackPaymentExplanation:
    if public_demo and payload.model_bundle_sha256 != STACK_MANIFEST_SHA256:
        raise HTTPException(409, "The public demo only explains the current model.")
    if validate_scenario(payload.scenario):
        raise HTTPException(422, "Correct the scenario before requesting an explanation.")
    return explain_payment(payload)


@app.post(
    "/api/v1/explanations/compare",
    response_model=StackComparisonExplanation,
    operation_id="comparePaymentChecks",
)
def comparison_explanation(payload: StackComparisonRequest) -> StackComparisonExplanation:
    if validate_scenario(payload.scenario):
        raise HTTPException(422, "Correct the scenario before requesting an explanation.")
    return explain_comparison(payload)


if not public_demo:
    app.include_router(history_router)

if frontend_directory := os.environ.get("RISKFLOW_FRONTEND_DIR"):
    mount_frontend(app, Path(frontend_directory).resolve())
