import hashlib
import json

from app.schemas.history import FinancialEvent


def canonical_hash(value: object) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def scoped_id(kind: str, *parts: str) -> str:
    return f"{kind}_{canonical_hash(parts)[:40]}"


def event_hash(event: FinancialEvent) -> str:
    payload = event.model_dump(exclude={"source_fields"})
    if event.lifecycle_kind == "unspecified":
        payload.pop("lifecycle_kind")
    if event.related_event_id is None:
        payload.pop("related_event_id")
    if event.device_trust_state == "unknown":
        payload.pop("device_trust_state")
    for field in ("device_trust_effective_at", "device_trust_provenance"):
        if payload[field] is None:
            payload.pop(field)
    return canonical_hash(payload)
