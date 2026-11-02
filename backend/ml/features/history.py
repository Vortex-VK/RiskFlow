import heapq
import math
from itertools import groupby

from app.domain.features.purchase import (
    ALL_FEATURES as HARD_FEATURES,
)
from app.domain.features.purchase import (
    DAY,
    STANDARD_FEATURES,
    AccountState,
    Observation,
    PurchaseFeatures,
    Window,
)

ADAPTIVE_FEATURES = [
    "ew_account_log_mean",
    "ew_account_log_std",
    "ew_account_support",
    "ew_category_support",
    "category_shrink_weight",
    "shrunk_log_amount_z",
    "account_log_amount_z",
    "shrunk_category_log_mean",
    "recent_log_mean_shift",
    "merchant_frequency_soft",
    "category_frequency_soft",
    "channel_frequency_soft",
]

SOFT_FEATURES = STANDARD_FEATURES + ADAPTIVE_FEATURES + ["activity_ratio", "spend_ratio"]

ALL_FEATURES = list(dict.fromkeys(HARD_FEATURES + SOFT_FEATURES))

__all__ = ["HARD_FEATURES", "SOFT_FEATURES", "ALL_FEATURES", "feature_rows", "DecayWindow"]


class DecayWindow(Window):
    def __init__(self) -> None:
        super().__init__(90 * DAY)
        self.clock: float | None = None
        self.mass = 0.0
        self.first = 0.0
        self.second = 0.0

    def advance(self, now: float) -> None:
        if self.clock is not None:
            if now < self.clock:
                raise ValueError("Decay clock cannot move backwards.")
            decay = 2 ** (-(now - self.clock) / (30 * DAY))
            self.mass *= decay
            self.first *= decay
            self.second *= decay
        self.clock = now
        for row in self.rows:
            if row.timestamp >= now - self.seconds:
                break
            weight = 2 ** (-(now - row.timestamp) / (30 * DAY))
            value = math.log1p(row.amount)
            self.mass -= weight
            self.first -= weight * value
            self.second -= weight * value * value
        self.expire(now)
        if not len(self):
            self.mass = self.first = self.second = 0.0

    def observe(self, row: Observation, now: float) -> None:
        self.advance(now)
        if row.timestamp < now - self.seconds:
            return
        weight = 2 ** (-(now - row.timestamp) / (30 * DAY))
        value = math.log1p(row.amount)
        self.mass += weight
        self.first += weight * value
        self.second += weight * value * value
        self.add(row)

    def moments(self) -> tuple[float, float]:
        if not len(self):
            return math.nan, math.nan
        mean = self.first / self.mass
        return mean, max(0.0, self.second / self.mass - mean * mean)


class AdaptiveState:
    def __init__(self) -> None:
        self.account = DecayWindow()
        self.categories: dict[str, DecayWindow] = {}

    def advance(self, now: float) -> None:
        self.account.advance(now)
        self.categories = {
            key: value
            for key, value in self.categories.items()
            if len(value) and value.rows[-1].timestamp >= now - 90 * DAY
        }

    def observe(self, row: Observation, now: float) -> None:
        if row.completed:
            self.account.observe(row, now)
            self.categories.setdefault(row.category, DecayWindow()).observe(row, now)

    def features(self, row: Observation, ordinary: AccountState) -> dict[str, float]:
        mean, variance = self.account.moments()
        category = self.categories.get(row.category)
        if category:
            category.advance(row.timestamp)
        mass = category.mass if category else 0.0
        weight = mass / (mass + 8)
        category_mean, category_variance = category.moments() if category else (mean, variance)
        combined_mean = weight * category_mean + (1 - weight) * mean
        combined_variance = weight * (category_variance + (category_mean - combined_mean) ** 2) + (
            1 - weight
        ) * (variance + (mean - combined_mean) ** 2)
        amount = math.log1p(row.amount)
        history = ordinary.spending[90 * DAY]
        recent = ordinary.spending[7 * DAY]
        count = len(history)
        return {
            "ew_account_log_mean": mean,
            "ew_account_log_std": math.sqrt(variance) if count else math.nan,
            "ew_account_support": self.account.mass,
            "ew_category_support": mass,
            "category_shrink_weight": weight,
            "shrunk_log_amount_z": (amount - combined_mean) / max(0.1, math.sqrt(combined_variance))
            if count
            else math.nan,
            "account_log_amount_z": (amount - mean) / max(0.1, math.sqrt(variance))
            if count
            else math.nan,
            "shrunk_category_log_mean": combined_mean,
            "recent_log_mean_shift": math.log1p(recent.total / len(recent)) - mean
            if len(recent)
            else math.nan,
            "merchant_frequency_soft": len(history.merchants.get(row.merchant, [])) / count
            if count
            else math.nan,
            "category_frequency_soft": history.categories[row.category] / count
            if count
            else math.nan,
            "channel_frequency_soft": history.channels[row.channel] / count if count else math.nan,
        }


def feature_rows(observations: list[Observation]) -> list[PurchaseFeatures]:
    if len({row.id for row in observations}) != len(observations):
        raise ValueError("Duplicate feature identities.")
    if len({row.account for row in observations}) > 1:
        raise ValueError("Feature batches require one scoped account.")
    ordinary, adaptive = AccountState(), AdaptiveState()
    pending: list[tuple[float, str, Observation]] = []
    result = []
    for timestamp, batch in groupby(
        sorted(observations, key=lambda e: (e.timestamp, e.id)), key=lambda e: e.timestamp
    ):
        adaptive.advance(timestamp)
        while pending and pending[0][0] <= timestamp:
            prior = heapq.heappop(pending)[2]
            ordinary.observe(prior)
            adaptive.observe(prior, timestamp)
        current = list(batch)
        for row in current:
            if row.amount <= 0:
                continue
            existing = ordinary.features(row)
            values = {**existing.values, **adaptive.features(row, ordinary)}
            support = {
                **existing.support,
                "version": "purchase-soft-history-v2",
                "half_life_days": 30,
                "category_prior_mass": 8,
                "category_shrink_weight": values["category_shrink_weight"],
                "effective_account_mass": values["ew_account_support"],
            }
            result.append(PurchaseFeatures(row.id, values, support))
        for row in current:
            if row.amount > 0:
                heapq.heappush(pending, (max(row.timestamp, row.available_at), row.id, row))
    return result
