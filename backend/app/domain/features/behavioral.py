import heapq
import math
from collections import Counter
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from decimal import Decimal
from itertools import groupby
from typing import Any, Literal

from sortedcontainers import SortedList

DAY = 86400
HORIZON = 30 * DAY
VERSION = "behavioral-features-v1"
CORE_FEATURES = [
    "log_amount",
    "history_count",
    "history_span_days",
    "history_age_days",
    "cold_start",
    "date_only",
    "count_1h",
    "count_24h",
    "count_7d",
    "log_mean_30d",
    "log_median_30d",
    "amount_ratio",
    "amount_percentile",
    "robust_deviation",
    "activity_ratio",
    "spend_ratio",
]
MERCHANT_FEATURES = [
    "merchant_missing",
    "merchant_visits_30d",
    "merchant_frequency",
    "merchant_age_days",
    "merchant_count_7d",
    "merchant_accounts_7d",
]
FEATURES = CORE_FEATURES + MERCHANT_FEATURES


@dataclass(frozen=True, slots=True)
class BehavioralObservation:
    id: str
    source: str
    account: str
    unit: str
    timestamp: float
    amount: Decimal
    merchant: str | None = None
    time_kind: Literal["instant", "date", "relative"] = "instant"
    available_at: float | None = None

    def __post_init__(self) -> None:
        if not all(s.strip() for s in (self.id, self.source, self.account, self.unit)):
            raise ValueError("Observation identity, source, account and unit must be explicit.")
        if not self.amount.is_finite() or not Decimal("1e-12") <= self.amount <= Decimal("1e12"):
            raise ValueError("Observed purchase amounts must be positive, finite and bounded.")
        if self.time_kind not in {"instant", "date", "relative"}:
            raise ValueError("Unsupported time representation.")
        if not math.isfinite(self.timestamp):
            raise ValueError("Observation time must be finite.")
        if self.time_kind == "date" and self.timestamp % DAY:
            raise ValueError("Date observations require a day boundary in the declared clock.")
        if self.available_at is not None and (
            not math.isfinite(self.available_at) or self.available_at < self.timestamp
        ):
            raise ValueError("Availability cannot precede occurrence.")

    @property
    def scope(self) -> tuple[str, str, str]:
        return self.source, self.account, self.unit

    @property
    def availability(self) -> float:
        return max(
            self.available_at if self.available_at is not None else self.timestamp,
            self.timestamp + DAY if self.time_kind == "date" else self.timestamp,
        )


@dataclass(frozen=True, slots=True)
class BehavioralFeatures:
    id: str
    values: dict[str, float]
    evidence: dict[str, Any]


class History:
    def __init__(self) -> None:
        self.rows: Any = SortedList(key=lambda r: (r.timestamp, r.id))
        self.amounts: Any = SortedList()
        self.total = Decimal(0)
        self.merchants: dict[str, Any] = {}

    def add(self, row: BehavioralObservation) -> None:
        self.rows.add(row)
        self.amounts.add(row.amount)
        self.total += row.amount
        if row.merchant:
            self.merchants.setdefault(row.merchant, SortedList()).add((row.timestamp, row.id))

    def expire(self, cutoff: float) -> None:
        while self.rows and self.rows[0].timestamp < cutoff:
            row = self.rows.pop(0)
            self.amounts.remove(row.amount)
            self.total -= row.amount
            if row.merchant:
                items = self.merchants[row.merchant]
                items.remove((row.timestamp, row.id))
                if not items:
                    del self.merchants[row.merchant]


class AccountHistory:
    def __init__(self) -> None:
        self.windows = {seconds: History() for seconds in (3600, DAY, 7 * DAY, HORIZON)}

    def add(self, row: BehavioralObservation) -> None:
        for history in self.windows.values():
            history.add(row)

    def features(self, row: BehavioralObservation) -> BehavioralFeatures:
        for seconds, window in self.windows.items():
            window.expire(row.timestamp - seconds)
        history = self.windows[HORIZON]
        count = len(history.rows)
        amount = float(row.amount)
        median = float(history.amounts[(count - 1) // 2]) if count else math.nan
        mean = float(history.total / count) if count else math.nan
        iqr = (
            float(
                history.amounts[int((count - 1) * 0.75)] - history.amounts[int((count - 1) * 0.25)]
            )
            if count
            else math.nan
        )
        dates = row.time_kind == "date"
        values = {
            "log_amount": math.log1p(amount),
            "history_count": float(count),
            "history_span_days": (row.timestamp - history.rows[0].timestamp) / DAY
            if count
            else math.nan,
            "history_age_days": (row.timestamp - history.rows[-1].timestamp) / DAY
            if count and not dates
            else math.nan,
            "cold_start": float(count == 0),
            "date_only": float(dates),
            "log_mean_30d": math.log1p(mean),
            "log_median_30d": math.log1p(median),
            "amount_ratio": amount / median if count else math.nan,
            "amount_percentile": history.amounts.bisect_right(row.amount) / count
            if count
            else math.nan,
            "robust_deviation": (amount - median) / max(iqr, median * 0.1)
            if count >= 4
            else math.nan,
            "activity_ratio": len(self.windows[DAY].rows) / (count / 30) if count else math.nan,
            "spend_ratio": float(self.windows[DAY].total / (history.total / 30))
            if count
            else math.nan,
        }
        for label, seconds in (("1h", 3600), ("24h", DAY), ("7d", 7 * DAY)):
            values[f"count_{label}"] = (
                math.nan if dates and seconds == 3600 else float(len(self.windows[seconds].rows))
            )
        visits = history.merchants.get(row.merchant or "", [])
        values.update(
            {
                "merchant_missing": float(row.merchant is None),
                "merchant_visits_30d": float(len(visits)) if row.merchant else math.nan,
                "merchant_frequency": len(visits) / count if count and row.merchant else math.nan,
                "merchant_age_days": (row.timestamp - visits[-1][0]) / DAY
                if visits and not dates
                else math.nan,
            }
        )
        return BehavioralFeatures(
            row.id,
            values,
            {
                "version": VERSION,
                "scope": list(row.scope),
                "unit": row.unit,
                "history_count": count,
                "horizon_days": 30,
                "median_amount": str(history.amounts[(count - 1) // 2]) if count else None,
                "mean_amount": str(history.total / count) if count else None,
                "prior_event_ids": [r.id for r in history.rows[-8:]],
                "evidence_truncated": count > 8,
                "semantics": "prior observed purchases, not settled spending",
            },
        )


class BehavioralState:
    def __init__(self, *, max_observations: int = 500_000) -> None:
        self.accounts: dict[tuple[str, str, str], AccountHistory] = {}
        self.merchants: Counter[tuple[str, str, str]] = Counter()
        self.merchant_accounts: dict[tuple[str, str, str], Counter[str]] = {}
        self.merchant_expiry: list[tuple[float, str, BehavioralObservation]] = []
        self.pending: list[tuple[float, str, BehavioralObservation]] = []
        self.expiry: list[tuple[float, str, BehavioralObservation]] = []
        self.ids: set[str] = set()
        self.last_time = -math.inf
        self.max_observations = max_observations

    def _advance(self, now: float) -> None:
        while self.expiry and self.expiry[0][0] < now:
            _, _, row = heapq.heappop(self.expiry)
            self.ids.remove(row.id)
            account = self.accounts.get(row.scope)
            if account:
                for seconds, window in account.windows.items():
                    window.expire(now - seconds)
                if not account.windows[HORIZON].rows:
                    del self.accounts[row.scope]
        while self.pending and self.pending[0][0] <= now:
            _, _, row = heapq.heappop(self.pending)
            if row.timestamp < now - HORIZON:
                continue
            self.accounts.setdefault(row.scope, AccountHistory()).add(row)
            if row.merchant:
                key = row.source, row.unit, row.merchant
                self.merchants[key] += 1
                self.merchant_accounts.setdefault(key, Counter())[row.account] += 1
                heapq.heappush(self.merchant_expiry, (row.timestamp + 7 * DAY, row.id, row))
        while self.merchant_expiry and self.merchant_expiry[0][0] < now:
            _, _, row = heapq.heappop(self.merchant_expiry)
            key = row.source, row.unit, row.merchant or ""
            self.merchants[key] -= 1
            accounts = self.merchant_accounts[key]
            accounts[row.account] -= 1
            if not accounts[row.account]:
                del accounts[row.account]
            if not self.merchants[key]:
                del self.merchants[key]
                del self.merchant_accounts[key]

    def batch(self, rows: list[BehavioralObservation]) -> list[BehavioralFeatures]:
        if not rows:
            return []
        now = rows[0].timestamp
        if now <= self.last_time or any(row.timestamp != now for row in rows):
            raise ValueError("Supply complete, strictly increasing equal-time batches.")
        ids = [row.id for row in rows]
        if len(set(ids)) != len(ids) or self.ids.intersection(ids):
            raise ValueError("Duplicate observations are not additional history.")
        if len(self.ids) + len(rows) > self.max_observations:
            expired = sum(1 for timestamp, _, _ in self.expiry if timestamp < now)
            if len(self.ids) - expired + len(rows) > self.max_observations:
                raise ValueError("Behavioral state observation budget exceeded.")
        self._advance(now)
        output = []
        for row in rows:
            result = self.accounts.get(row.scope, AccountHistory()).features(row)
            key = row.source, row.unit, row.merchant or ""
            result.values.update(
                {
                    "merchant_count_7d": float(self.merchants[key]) if row.merchant else math.nan,
                    "merchant_accounts_7d": float(len(self.merchant_accounts.get(key, {})))
                    if row.merchant
                    else math.nan,
                }
            )
            output.append(result)
        for row in rows:
            self.ids.add(row.id)
            heapq.heappush(self.pending, (row.availability, row.id, row))
            heapq.heappush(
                self.expiry, (max(row.timestamp + HORIZON, row.availability), row.id, row)
            )
        self.last_time = now
        return output


def behavioral_rows(
    observations: Iterable[BehavioralObservation],
    state: BehavioralState | None = None,
) -> Iterator[BehavioralFeatures]:
    state = state or BehavioralState()
    for _, group in groupby(observations, key=lambda row: row.timestamp):
        yield from state.batch(list(group))
