import json
import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Literal
from uuid import uuid4

from app.domain.assessment import assess_history, utc_now
from app.domain.identity import event_hash
from app.domain.lifecycle import reconcile_lifecycle
from app.domain.model_inputs import model_eligibility
from app.domain.reconciliation import preview_import
from app.schemas.assessments import AssessmentRun, RunSummary
from app.schemas.history import (
    CorrectionRequest,
    Dataset,
    DatasetCreate,
    EventPage,
    FinancialEvent,
    ImportPreview,
    ImportRequest,
    RetainedEvent,
)
from app.storage.migrations import migrate

NORMALIZER_VERSION = 5


class HistoryConflict(ValueError):
    pass


class HistoryStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as connection:
            migrate(connection)

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    @staticmethod
    def _dataset(connection: sqlite3.Connection, identifier: str) -> Dataset:
        row = connection.execute(
            "SELECT d.*, (SELECT count(DISTINCT id) FROM events "
            "WHERE dataset_id=d.id) AS event_count "
            "FROM datasets d WHERE id=?",
            (identifier,),
        ).fetchone()
        if row is None:
            raise KeyError("Dataset was not found.")
        return Dataset.model_validate(dict(row))

    def create(self, request: DatasetCreate) -> Dataset:
        with self.connection() as connection:
            identifier = str(uuid4())
            connection.execute(
                "INSERT INTO datasets VALUES (?, ?, ?, 0, ?)",
                (identifier, request.name, request.source_namespace, utc_now()),
            )
            return self._dataset(connection, identifier)

    def datasets(self) -> list[Dataset]:
        with self.connection() as connection:
            identifiers = connection.execute("SELECT id FROM datasets ORDER BY created_at, id")
            return [self._dataset(connection, row[0]) for row in identifiers.fetchall()]

    def dataset(self, identifier: str) -> Dataset:
        with self.connection() as connection:
            return self._dataset(connection, identifier)

    def snapshot(
        self, identifier: str, revision: int | None = None, knowledge_cutoff: str | None = None
    ) -> tuple[Dataset, list[FinancialEvent]]:
        with self.connection() as connection:
            connection.execute("BEGIN")
            dataset = self._dataset(connection, identifier)
            selected = dataset.revision if revision is None else revision
            if selected < 0 or selected > dataset.revision:
                raise ValueError("Dataset revision does not exist.")
            rows = self._versions(connection, identifier, selected, latest=knowledge_cutoff is None)
            latest: dict[str, FinancialEvent] = {}
            for row in rows:
                event = self._event(row)
                if knowledge_cutoff is not None:
                    if event.source_available_at is None or event.time_precision != "instant":
                        raise ValueError(
                            "As-known snapshots require precise event times and source "
                            "availability for every retained version."
                        )
                    if event.source_available_at < event.occurred_at:
                        raise ValueError(
                            "Source availability cannot precede event time in an as-known snapshot."
                        )
                    if event.source_available_at > knowledge_cutoff:
                        continue
                latest[event.id] = event
            events = list(latest.values())
            return dataset.model_copy(
                update={"revision": selected, "event_count": len(events)}
            ), events

    @staticmethod
    def _versions(
        connection: sqlite3.Connection, identifier: str, revision: int, latest: bool = False
    ) -> list[sqlite3.Row]:
        if latest:
            return connection.execute(
                "SELECT e.* FROM events e JOIN (SELECT id, MAX(accepted_revision) AS revision "
                "FROM events WHERE dataset_id=? AND accepted_revision<=? GROUP BY id) selected "
                "ON e.id=selected.id AND e.accepted_revision=selected.revision "
                "WHERE e.dataset_id=? "
                "ORDER BY e.accepted_revision, e.id",
                (identifier, revision, identifier),
            ).fetchall()
        return connection.execute(
            "SELECT * FROM events WHERE dataset_id=? AND accepted_revision<=? "
            "ORDER BY accepted_revision, id",
            (identifier, revision),
        ).fetchall()

    @staticmethod
    def _event(row: sqlite3.Row) -> FinancialEvent:
        event = FinancialEvent.model_validate_json(row["payload_json"])
        if event_hash(event) != row["payload_hash"]:
            raise ValueError("Stored event content does not match its recorded hash.")
        return event

    def preview(self, identifier: str, request: ImportRequest) -> ImportPreview:
        dataset, existing = self.snapshot(identifier)
        preview, additions = preview_import(dataset, existing, request)
        self._save_preview(dataset, request, preview, additions, None)
        return preview

    def _save_preview(
        self,
        dataset: Dataset,
        request: ImportRequest,
        preview: ImportPreview,
        additions: list[tuple[int, FinancialEvent]],
        correction_reason: str | None,
    ) -> None:
        with self.connection() as connection:
            connection.execute(
                "INSERT INTO imports VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)",
                (
                    preview.id,
                    dataset.id,
                    dataset.revision,
                    utc_now(),
                    request.model_dump_json(),
                    preview.model_dump_json(),
                    json.dumps([[line, event.model_dump()] for line, event in additions]),
                    correction_reason,
                    NORMALIZER_VERSION,
                ),
            )

    def resolve(
        self, identifier: str, import_id: str, resolution: CorrectionRequest
    ) -> ImportPreview:
        dataset, existing = self.snapshot(identifier)
        if dataset.revision != resolution.expected_revision:
            raise HistoryConflict("Dataset changed. Preview the corrections again.")
        with self.connection() as connection:
            row = connection.execute(
                "SELECT * FROM imports WHERE dataset_id=? AND id=?",
                (identifier, import_id),
            ).fetchone()
            if row is None:
                raise KeyError("Import preview was not found in this dataset.")
            original = ImportPreview.model_validate_json(row["preview_json"])
            if row["normalizer_version"] != NORMALIZER_VERSION:
                raise HistoryConflict(
                    "Import rules changed since preview. Preview this file again."
                )
            if (
                row["committed_revision"] is not None
                or original.expected_revision != dataset.revision
            ):
                raise HistoryConflict(
                    "Correction candidate is committed or stale. Preview the source again."
                )
            conflicts = {item.event_id for item in original.rows if item.disposition == "conflict"}
            selected = set(resolution.event_ids)
            if not selected <= conflicts or len(selected) != len(resolution.event_ids):
                raise ValueError("Select distinct conflicting event identities from this preview.")
            selected.update(
                item.event_id
                for item in original.rows
                if item.disposition == "corrected" and item.event_id
            )
            request = ImportRequest.model_validate_json(row["request_json"])
        preview, additions = preview_import(dataset, existing, request, selected, resolution.reason)
        self._save_preview(dataset, request, preview, additions, resolution.reason)
        return preview

    def commit(self, identifier: str, import_id: str) -> ImportPreview:
        with self.connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            dataset = self._dataset(connection, identifier)
            row = connection.execute(
                "SELECT * FROM imports WHERE dataset_id=? AND id=?",
                (identifier, import_id),
            ).fetchone()
            if row is None:
                raise KeyError("Import preview was not found in this dataset.")
            preview = ImportPreview.model_validate_json(row["preview_json"])
            if row["committed_revision"] is not None:
                return preview.model_copy(update={"committed_revision": row["committed_revision"]})
            if row["normalizer_version"] != NORMALIZER_VERSION:
                raise HistoryConflict(
                    "Import rules changed since preview. Preview this file again."
                )
            if not preview.can_commit:
                raise HistoryConflict(
                    "Resolve invalid/conflicting rows and preview again. Nothing was committed."
                )
            if dataset.revision != preview.expected_revision:
                raise HistoryConflict(
                    "Dataset changed since preview. Preview this file again before committing."
                )
            additions = json.loads(row["additions_json"])
            revision = dataset.revision + bool(additions)
            now = utc_now()
            corrected = {item.event_id for item in preview.rows if item.disposition == "corrected"}
            for line, payload in additions:
                event = FinancialEvent.model_validate(payload)
                connection.execute(
                    "INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        identifier,
                        event.id,
                        event.model_dump_json(),
                        event_hash(event),
                        revision,
                        now,
                        import_id,
                        line,
                        row["correction_reason"] if event.id in corrected else None,
                    ),
                )
            connection.execute("UPDATE datasets SET revision=? WHERE id=?", (revision, identifier))
            connection.execute(
                "UPDATE imports SET committed_revision=? WHERE id=? AND dataset_id=?",
                (revision, import_id, identifier),
            )
            return preview.model_copy(update={"committed_revision": revision})

    def events(
        self,
        identifier: str,
        revision: int | None,
        offset: int,
        limit: int,
        event_id: str | None = None,
    ) -> EventPage:
        with self.connection() as connection:
            connection.execute("BEGIN")
            dataset = self._dataset(connection, identifier)
            selected = dataset.revision if revision is None else revision
            if not 0 <= selected <= dataset.revision:
                raise ValueError("Dataset revision does not exist.")
            all_rows = (
                connection.execute(
                    "SELECT * FROM events WHERE dataset_id=? AND id=? AND accepted_revision<=? "
                    "ORDER BY accepted_revision",
                    (identifier, event_id, selected),
                ).fetchall()
                if event_id is not None
                else self._versions(connection, identifier, selected, latest=True)
            )
            decoded = [(row, self._event(row)) for row in all_rows]
            if event_id is not None:
                if not decoded:
                    raise KeyError("Event was not found in this dataset revision.")
            else:
                decoded.sort(key=lambda pair: (pair[1].occurred_at, pair[1].id))
            total = len(decoded)
            populations = (
                {
                    entry.event_id: entry
                    for entry in reconcile_lifecycle([event for _, event in decoded]).entries
                }
                if event_id is None
                else {}
            )
            items = []
            for row, event in decoded[offset : offset + limit]:
                reason = (
                    "Historical version; assess its revision for lifecycle eligibility."
                    if event_id is not None
                    else model_eligibility(event)
                    or (populations[event.id].reason if not populations[event.id].attempt else None)
                )
                items.append(
                    RetainedEvent(
                        event=event,
                        accepted_revision=row["accepted_revision"],
                        recorded_at=row["recorded_at"],
                        import_id=row["import_id"],
                        source_row=row["source_row"],
                        analytical_status="not_assessed" if reason else "eligible",
                        reason=reason,
                        correction_reason=row["correction_reason"],
                    )
                )
            return EventPage(items=items, total=total, offset=offset, limit=limit)

    def assess(
        self,
        identifier: str,
        revision: int,
        mode: Literal["retrospective", "as_known"] = "retrospective",
        knowledge_cutoff: str | None = None,
        analysis_mode: Literal["model", "v13", "behavioral"] = "model",
    ) -> AssessmentRun:
        if (mode == "as_known") != (knowledge_cutoff is not None):
            raise ValueError("As-known snapshots require a cutoff; retrospective runs do not.")
        dataset, events = self.snapshot(identifier, revision, knowledge_cutoff)
        if analysis_mode == "behavioral":
            from app.domain.behavioral_assessment import assess_behavioral

            run = assess_behavioral(dataset, events, mode, knowledge_cutoff)
        elif analysis_mode in ("model", "v13"):
            run = assess_history(dataset, events, mode, knowledge_cutoff)
        else:
            raise ValueError("Unsupported analysis mode.")
        with self.connection() as connection:
            connection.execute(
                "INSERT INTO runs VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    identifier,
                    run.id,
                    revision,
                    run.recorded_at,
                    len(run.assessments),
                    run.analysis_hash,
                    run.model_dump_json(by_alias=True),
                ),
            )
        return run

    def runs(self, identifier: str) -> list[RunSummary]:
        with self.connection() as connection:
            self._dataset(connection, identifier)
            rows = connection.execute(
                "SELECT id, revision, recorded_at, event_count, analysis_hash FROM runs "
                "WHERE dataset_id=? ORDER BY recorded_at DESC, id DESC",
                (identifier,),
            ).fetchall()
            return [RunSummary.model_validate(dict(row)) for row in rows]

    def run(self, identifier: str, run_id: str) -> AssessmentRun:
        with self.connection() as connection:
            row = connection.execute(
                "SELECT payload_json FROM runs WHERE dataset_id=? AND id=?",
                (identifier, run_id),
            ).fetchone()
            if row is None:
                raise KeyError("Assessment was not found in this dataset.")
            return AssessmentRun.model_validate_json(row[0])


def configured_store() -> HistoryStore:
    default = Path(__file__).resolve().parents[3] / ".data"
    directory = Path(os.environ.get("RISKFLOW_DATA_DIR", str(default)))
    return HistoryStore(directory / "riskflow.sqlite3")
