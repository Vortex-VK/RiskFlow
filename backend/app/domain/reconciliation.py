import json
from typing import Literal
from uuid import uuid4

from pydantic import ValidationError

from app.domain.identity import event_hash
from app.domain.ingestion import read_import
from app.domain.lifecycle import reconcile_lifecycle
from app.domain.model_inputs import model_eligibility
from app.domain.projections import project_history
from app.schemas.history import (
    Dataset,
    FieldChange,
    FinancialEvent,
    ImportPreview,
    ImportRequest,
    ImportRow,
)


def preview_import(
    dataset: Dataset,
    existing: list[FinancialEvent],
    request: ImportRequest,
    corrections: set[str] | None = None,
    correction_reason: str | None = None,
) -> tuple[ImportPreview, list[tuple[int, FinancialEvent]]]:
    source_hash, mapping, incoming, rows = read_import(request, dataset.source_namespace)
    by_id = {event.id: event for event in existing}
    additions: list[tuple[int, FinancialEvent]] = []
    corrected: set[str] = set()
    observed: set[str] = set()
    for line, event in incoming:
        previous = by_id.get(event.id)
        coverage_reason = model_eligibility(event)
        reason = coverage_reason
        changes: list[FieldChange] = []
        disposition: Literal["added", "duplicate", "conflict", "corrected"] = "added"
        if previous:
            disposition = "duplicate" if event_hash(previous) == event_hash(event) else "conflict"
            if disposition == "conflict":
                before = previous.model_dump(exclude={"source_fields"})
                after = event.model_dump(exclude={"source_fields"})
                changes = [
                    FieldChange(
                        field=field,
                        before=json.dumps(before[field], sort_keys=True),
                        after=json.dumps(value, sort_keys=True),
                    )
                    for field, value in after.items()
                    if before[field] != value
                ]
                reason = "Same event identity with changed content. Nothing was overwritten."
                if corrections and event.id in corrections and event.id not in observed:
                    if (
                        previous.source_available_at is not None
                        and event.source_available_at is not None
                        and event.source_available_at <= previous.source_available_at
                    ):
                        reason = "Correction availability must be later than the previous version."
                    else:
                        disposition = "corrected"
                        reason = correction_reason
                        corrected.add(event.id)
                        by_id[event.id] = event
                        additions.append((line, event))
        else:
            by_id[event.id] = event
            additions.append((line, event))
        observed.add(event.id)
        rows.append(
            ImportRow(
                row=line,
                source_event_id=event.source_event_id,
                disposition=disposition,
                analytical_status="eligible" if coverage_reason is None else "not_assessed",
                reason=reason,
                event_id=event.id,
                changes=changes,
            )
        )
    errors: list[str] = []
    if corrections and corrected != corrections:
        errors.append(
            "Every correction must resolve an existing changed event with valid provenance."
        )
    try:
        if len(by_id) > 20_000:
            raise ValueError("Retained datasets currently support at most 20,000 source events.")
        project_history(dataset, list(by_id.values()))
        populations = {
            item.event_id: item for item in reconcile_lifecycle(list(by_id.values())).entries
        }
        rows = [
            row.model_copy(
                update={
                    "analytical_status": "not_assessed",
                    "reason": row.reason or populations[row.event_id].reason,
                }
            )
            if row.event_id in populations
            and not populations[row.event_id].attempt
            and row.disposition != "invalid"
            else row
            for row in rows
        ]
    except (ValueError, ValidationError) as exc:
        if isinstance(exc, ValidationError):
            errors.append(
                "Complete history exceeds the supported graph/analysis contract: "
                + "; ".join(
                    f"{'.'.join(map(str, error['loc']))}: {error['msg']}" for error in exc.errors()
                )
            )
        else:
            errors.append(str(exc))
    preview = ImportPreview(
        id=str(uuid4()),
        dataset_id=dataset.id,
        expected_revision=dataset.revision,
        source_hash=source_hash,
        filename=request.filename,
        mapping=mapping,
        rows=sorted(rows, key=lambda row: row.row),
        errors=errors,
        can_commit=not errors
        and not any(row.disposition in {"invalid", "conflict"} for row in rows),
    )
    return preview, additions
