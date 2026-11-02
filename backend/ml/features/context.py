import heapq
import math
from collections import Counter
from collections.abc import Iterable, Iterator
from itertools import groupby

from sortedcontainers import SortedKeyList

from app.domain.features.purchase import DAY, Observation

SEQUENCE_FEATURES = [
    "attempts_5m",
    "same_merchant_attempts_5m",
    "distinct_merchants_1h",
    "distinct_categories_1h",
    "prior_failure_fraction_1h",
    "last_channel_changed",
    "last_merchant_changed",
    "log_amount_over_previous_completed",
    "hour_frequency_90d",
]

MERCHANT_FEATURES = [
    "merchant_attempts_1h",
    "merchant_attempts_7d",
    "merchant_distinct_accounts_1h",
    "merchant_distinct_accounts_7d",
    "merchant_failure_fraction_1h",
    "merchant_rate_ratio",
    "merchant_log_amount_z_7d",
    "merchant_account_novel_7d",
]

CONTEXT_FEATURES = SEQUENCE_FEATURES + MERCHANT_FEATURES


class Window:
    def __init__(self, seconds: int) -> None:
        self.seconds = seconds
        self.rows: SortedKeyList[Observation] = SortedKeyList(key=lambda r: (r.timestamp, r.id))
        self.merchants: Counter[str] = Counter()
        self.categories: Counter[str] = Counter()
        self.accounts: Counter[str] = Counter()
        self.hours: Counter[int] = Counter()
        self.completed = 0
        self.total = 0.0
        self.squared = 0.0

    def change(self, row: Observation, sign: int) -> None:
        for counts, key in (
            (self.merchants, row.merchant),
            (self.categories, row.category),
            (self.accounts, row.account),
        ):
            counts[key] += sign
            if counts[key] == 0:
                del counts[key]
        if row.completed:
            value = math.log1p(row.amount)
            self.completed += sign
            self.total += sign * value
            self.squared += sign * value * value
            self.hours[int(row.timestamp // 3600) % 24] += sign

    def advance(self, now: float) -> None:
        while self.rows and self.rows[0].timestamp < now - self.seconds:
            self.change(self.rows.pop(0), -1)

    def add(self, row: Observation, now: float) -> None:
        self.advance(now)
        if row.timestamp >= now - self.seconds:
            self.rows.add(row)
            self.change(row, 1)

    def failure_fraction(self) -> float:
        return 1 - self.completed / len(self.rows) if self.rows else math.nan


class Context:
    def __init__(self) -> None:
        self.accounts: dict[str, tuple[Window, Window]] = {}
        self.merchants: dict[str, tuple[Window, Window]] = {}

    def windows(self, row: Observation) -> tuple[Window, Window, Window, Window]:
        if row.account not in self.accounts:
            self.accounts[row.account] = (Window(3600), Window(90 * DAY))
        if row.merchant not in self.merchants:
            self.merchants[row.merchant] = (Window(3600), Window(7 * DAY))
        return (*self.accounts[row.account], *self.merchants[row.merchant])

    def add(self, row: Observation, now: float) -> None:
        for window in self.windows(row):
            window.add(row, now)

    def features(self, row: Observation) -> dict[str, float]:
        short, history, merchant_hour, merchant_week = self.windows(row)
        for window in (short, history, merchant_hour, merchant_week):
            window.advance(row.timestamp)
        recent = [r for r in short.rows if r.timestamp >= row.timestamp - 300]
        previous = history.rows[-1] if history.rows else None
        completed = next((r for r in reversed(history.rows) if r.completed), None)
        latest = (
            list(history.rows.irange_key((previous.timestamp, ""), (previous.timestamp, "\uffff")))
            if previous
            else []
        )
        channels = {r.channel for r in latest}
        merchants = {r.merchant for r in latest}
        amounts = (
            {
                r.amount
                for r in history.rows.irange_key(
                    (completed.timestamp, ""), (completed.timestamp, "\uffff")
                )
                if r.completed
            }
            if completed
            else set()
        )
        count = merchant_week.completed
        mean = merchant_week.total / count if count else math.nan
        variance = max(0.0, merchant_week.squared / count - mean * mean) if count else math.nan
        return {
            "attempts_5m": len(recent),
            "same_merchant_attempts_5m": sum(r.merchant == row.merchant for r in recent),
            "distinct_merchants_1h": len(short.merchants),
            "distinct_categories_1h": len(short.categories),
            "prior_failure_fraction_1h": short.failure_fraction(),
            "last_channel_changed": float(next(iter(channels)) != row.channel)
            if len(channels) == 1
            else math.nan,
            "last_merchant_changed": float(next(iter(merchants)) != row.merchant)
            if len(merchants) == 1
            else math.nan,
            "log_amount_over_previous_completed": math.log1p(row.amount)
            - math.log1p(completed.amount)
            if completed and len(amounts) == 1
            else math.nan,
            "hour_frequency_90d": history.hours[int(row.timestamp // 3600) % 24] / history.completed
            if history.completed
            else math.nan,
            "merchant_attempts_1h": len(merchant_hour.rows),
            "merchant_attempts_7d": len(merchant_week.rows),
            "merchant_distinct_accounts_1h": len(merchant_hour.accounts),
            "merchant_distinct_accounts_7d": len(merchant_week.accounts),
            "merchant_failure_fraction_1h": merchant_hour.failure_fraction(),
            "merchant_rate_ratio": (len(merchant_hour.rows) + 1)
            / ((len(merchant_week.rows) - len(merchant_hour.rows)) / 167 + 1),
            "merchant_log_amount_z_7d": (math.log1p(row.amount) - mean)
            / max(0.1, math.sqrt(variance))
            if count
            else math.nan,
            "merchant_account_novel_7d": float(row.account not in merchant_week.accounts)
            if merchant_week.rows
            else math.nan,
        }

    def prune(self, now: float) -> None:
        for key, windows in list(self.merchants.items()):
            for window in windows:
                window.advance(now)
            if not windows[1].rows:
                del self.merchants[key]


def context_rows(observations: Iterable[Observation]) -> Iterator[tuple[str, dict[str, float]]]:
    state = Context()
    pending: list[tuple[float, str, Observation]] = []
    last_time = -math.inf
    processed = 0
    for now, batch in groupby(observations, key=lambda r: r.timestamp):
        if now < last_time:
            raise ValueError("Context requires chronological source ordering.")
        last_time = now
        while pending and pending[0][0] <= now:
            prior = heapq.heappop(pending)[2]
            state.add(prior, now)
        current = [row for row in batch if row.amount > 0]
        for row in current:
            yield row.id, state.features(row)
        for row in current:
            heapq.heappush(pending, (max(row.available_at, now), row.id, row))
        processed += len(current)
        if processed % 100000 < len(current):
            state.prune(now)
