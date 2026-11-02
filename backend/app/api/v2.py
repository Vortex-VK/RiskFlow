from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.domain.projections import project_history
from app.schemas.assessments import AssessmentRequest, AssessmentRun, RunSummary
from app.schemas.history import (
    CorrectionRequest,
    Dataset,
    DatasetCreate,
    EventPage,
    ImportPreview,
    ImportRequest,
)
from app.schemas.scenario import ScenarioDocument
from app.storage.history import HistoryConflict, HistoryStore, configured_store

router = APIRouter(prefix="/api/v2/datasets", tags=["Retained history"])
Store = Annotated[HistoryStore, Depends(configured_store)]


def checked[T](action: Callable[[], T]) -> T:
    try:
        return action()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc.args[0])) from exc
    except HistoryConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("", operation_id="listDatasets")
def datasets(store: Store) -> list[Dataset]:
    return store.datasets()


@router.post("", operation_id="createDataset")
def create_dataset(request: DatasetCreate, store: Store) -> Dataset:
    return store.create(request)


@router.get("/{dataset_id}", operation_id="getDataset")
def dataset(dataset_id: str, store: Store) -> Dataset:
    return checked(lambda: store.dataset(dataset_id))


@router.post("/{dataset_id}/imports/preview", operation_id="previewDatasetImport")
def preview(dataset_id: str, request: ImportRequest, store: Store) -> ImportPreview:
    return checked(lambda: store.preview(dataset_id, request))


@router.post("/{dataset_id}/imports/{import_id}/commit", operation_id="commitDatasetImport")
def commit(dataset_id: str, import_id: str, store: Store) -> ImportPreview:
    return checked(lambda: store.commit(dataset_id, import_id))


@router.post("/{dataset_id}/imports/{import_id}/resolve", operation_id="previewDatasetCorrections")
def resolve(
    dataset_id: str, import_id: str, request: CorrectionRequest, store: Store
) -> ImportPreview:
    return checked(lambda: store.resolve(dataset_id, import_id, request))


@router.get("/{dataset_id}/events/{event_id}/versions", operation_id="listEventVersions")
def versions(
    dataset_id: str,
    event_id: str,
    store: Store,
    revision: Annotated[int | None, Query(ge=0)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> EventPage:
    return checked(lambda: store.events(dataset_id, revision, offset, limit, event_id))


@router.get("/{dataset_id}/events", operation_id="listDatasetEvents")
def events(
    dataset_id: str,
    store: Store,
    revision: Annotated[int | None, Query(ge=0)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> EventPage:
    return checked(lambda: store.events(dataset_id, revision, offset, limit))


@router.get("/{dataset_id}/document", operation_id="getDatasetDocument")
def document(
    dataset_id: str,
    store: Store,
    revision: Annotated[int | None, Query(ge=0)] = None,
) -> ScenarioDocument:
    return checked(lambda: project_history(*store.snapshot(dataset_id, revision)))


@router.post("/{dataset_id}/runs", operation_id="assessDataset")
def assess(dataset_id: str, request: AssessmentRequest, store: Store) -> AssessmentRun:
    return checked(
        lambda: store.assess(
            dataset_id,
            request.revision,
            request.mode,
            request.knowledge_cutoff,
            request.analysis_mode,
        )
    )


@router.get("/{dataset_id}/runs", operation_id="listDatasetRuns")
def runs(dataset_id: str, store: Store) -> list[RunSummary]:
    return checked(lambda: store.runs(dataset_id))


@router.get("/{dataset_id}/runs/{run_id}", operation_id="getDatasetRun")
def run(dataset_id: str, run_id: str, store: Store) -> AssessmentRun:
    return checked(lambda: store.run(dataset_id, run_id))
