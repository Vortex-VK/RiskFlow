import heapq
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from itertools import groupby
from typing import Any

from sortedcontainers import SortedKeyList, SortedList

DAY = 86400
VERSION = "purchase-features-v1"
STANDARD_FEATURES = [
    "log_amount",
    "category",
    "channel",
    "hour",
    "weekday",
    "attempts_1h",
    "attempts_24h",
    "attempts_7d",
    "log_spend_24h",
    "log_spend_7d",
    "log_mean_24h",
    "log_mean_7d",
    "merchant_recency_days",
    "history_samples",
    "history_span_days",
    "history_age_days",
]
PERSONAL_FEATURES = [
    "amount_percentile",
    "robust_amount_deviation",
    "category_amount_percentile",
    "category_robust_deviation",
    "category_fallback",
    "category_samples",
    "category_frequency",
    "channel_frequency",
    "merchant_frequency",
    "activity_ratio",
    "spend_ratio",
    "log_account_median",
    "log_category_median",
    "personal_history_available",
]
ALL_FEATURES = STANDARD_FEATURES + PERSONAL_FEATURES
CATEGORICAL = ["category", "channel"]


@dataclass(frozen=True, slots=True)
class Observation:
    id: str
    account: str
    timestamp: float
    available_at: float
    amount: int
    merchant: str
    category: str
    channel: str
    completed: bool


@dataclass(frozen=True, slots=True)
class PurchaseFeatures:
    id: str
    values: dict[str, float | str]
    support: dict[str, Any]


class Window:
    def __init__(self, seconds: int) -> None:
        self.seconds = seconds
        self.rows: Any = SortedKeyList(key=lambda e: (e.timestamp, e.id))
        self.amounts: Any = SortedList()
        self.total = 0
        self.categories: Counter[str] = Counter()
        self.channels: Counter[str] = Counter()
        self.merchants: dict[str, Any] = defaultdict(SortedList)

    def add(self, row: Observation) -> None:
        self.rows.add(row)
        self.amounts.add(row.amount)
        self.total += row.amount
        self.categories[row.category] += 1
        self.channels[row.channel] += 1
        self.merchants[row.merchant].add(row.timestamp)

    def expire(self, now: float) -> None:
        while self.rows and self.rows[0].timestamp < now - self.seconds:
            row = self.rows.pop(0)
            self.amounts.remove(row.amount)
            self.total -= row.amount
            self.categories[row.category] -= 1
            self.channels[row.channel] -= 1
            merchant = self.merchants[row.merchant]
            merchant.remove(row.timestamp)
            if not merchant:
                del self.merchants[row.merchant]

    def __len__(self) -> int:
        return len(self.rows)

    def quantile(self, fraction: float) -> float:
        return float(self.amounts[int((len(self.amounts) - 1) * fraction)])


class AccountState:
    def __init__(self) -> None:
        self.attempts = {n: Window(n) for n in (3600, DAY, 7 * DAY)}
        self.spending = {n: Window(n) for n in (DAY, 7 * DAY, 90 * DAY)}
        self.categories: dict[str, Window] = {}

    def observe(self, row: Observation) -> None:
        for window in self.attempts.values():
            window.add(row)
        if row.completed:
            for window in self.spending.values():
                window.add(row)
            self.categories.setdefault(row.category, Window(90 * DAY)).add(row)

    def expire(self, now: float) -> None:
        for window in [*self.attempts.values(), *self.spending.values(), *self.categories.values()]:
            window.expire(now)
        self.categories = {key: window for key, window in self.categories.items() if len(window)}

    def features(self, row: Observation) -> PurchaseFeatures:
        now = row.timestamp
        self.expire(now)
        history = self.spending[90 * DAY]
        category = self.categories.get(row.category, Window(90 * DAY))
        count = len(history)
        age = (now - history.rows[-1].timestamp) / DAY if count else math.nan
        available = count >= 10 and age <= 30
        category_available = len(category) >= 10 and (now - category.rows[-1].timestamp <= 30 * DAY)
        reference = category if category_available else history
        reference_available = category_available or available
        merchant_times = history.merchants.get(row.merchant, [])
        date = datetime.fromtimestamp(now, tz=UTC)
        values: dict[str, float | str] = {
            "log_amount": math.log1p(row.amount),
            "category": row.category,
            "channel": row.channel or "__missing__",
            "hour": float(date.hour),
            "weekday": float(date.weekday()),
            "merchant_recency_days": (now - merchant_times[-1]) / DAY
            if merchant_times
            else math.nan,
            "history_samples": float(count),
            "history_span_days": (history.rows[-1].timestamp - history.rows[0].timestamp) / DAY
            if count
            else math.nan,
            "history_age_days": age,
            "category_fallback": float(not category_available),
            "category_samples": float(len(category)),
            "personal_history_available": float(available),
            "category_frequency": history.categories[row.category] / count
            if available
            else math.nan,
            "channel_frequency": history.channels[row.channel] / count if available else math.nan,
            "merchant_frequency": len(merchant_times) / count if available else math.nan,
        }
        for label, seconds in (("1h", 3600), ("24h", DAY), ("7d", 7 * DAY)):
            values[f"attempts_{label}"] = float(len(self.attempts[seconds]))
        for label, seconds in (("24h", DAY), ("7d", 7 * DAY)):
            window = self.spending[seconds]
            values[f"log_spend_{label}"] = math.log1p(window.total)
            values[f"log_mean_{label}"] = (
                math.log1p(window.total / len(window)) if len(window) else math.nan
            )
        for prefix, window, usable in (
            ("", history, available),
            ("category_", reference, reference_available),
        ):
            values[f"{prefix}amount_percentile"] = (
                window.amounts.bisect_right(row.amount) / len(window) if usable else math.nan
            )
            values["robust_amount_deviation" if not prefix else "category_robust_deviation"] = (
                (row.amount - window.quantile(0.5))
                / max(1.0, window.quantile(0.75) - window.quantile(0.25))
                if usable
                else math.nan
            )
            values["log_account_median" if not prefix else "log_category_median"] = (
                math.log1p(window.quantile(0.5)) if usable else math.nan
            )
        reference_attempts = len(self.attempts[7 * DAY]) - len(self.attempts[DAY])
        reference_spend = self.spending[7 * DAY].total - self.spending[DAY].total
        values["activity_ratio"] = (
            len(self.attempts[DAY]) / (reference_attempts / 6 + 1)
            if reference_attempts
            else math.nan
        )
        values["spend_ratio"] = (
            self.spending[DAY].total / (reference_spend / 6 + 1) if reference_spend else math.nan
        )
        return PurchaseFeatures(
            row.id,
            values,
            {
                "version": VERSION,
                "account": row.account,
                "cutoff": now,
                "population": "prior_available_completed_positive_purchases",
                "category_population": "category"
                if category_available
                else "account"
                if available
                else "unavailable",
                "history_samples": count,
                "category_samples": len(category),
                "window_days": 90,
                "minimum_samples": 10,
                "freshness_days": 30,
            },
        )


def feature_rows(observations: list[Observation]) -> list[PurchaseFeatures]:
    if len({row.id for row in observations}) != len(observations):
        raise ValueError("Duplicate feature identities.")
    state = AccountState()
    result = []
    pending: list[tuple[float, str, Observation]] = []
    accounts = {row.account for row in observations}
    if len(accounts) > 1:
        raise ValueError("Feature batches must contain exactly one scoped account.")
    for timestamp, batch in groupby(
        sorted(observations, key=lambda e: (e.timestamp, e.id)), key=lambda e: e.timestamp
    ):
        while pending and pending[0][0] <= timestamp:
            state.observe(heapq.heappop(pending)[2])
        current = list(batch)
        for row in current:
            if row.amount > 0:
                result.append(state.features(row))
        for row in current:
            if row.amount > 0:
                heapq.heappush(pending, (max(row.timestamp, row.available_at), row.id, row))
    return result
