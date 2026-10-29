"""Strictly prior, label-free, source-neutral history features for portable exports."""

from collections import Counter, deque
from itertools import groupby
from typing import Any

import numpy as np
import pandas as pd

STATIC = ["log_amount", "category", "channel", "hour", "weekday", "completed"]
HISTORY = [
    "history_count",
    "history_days",
    "log_mean",
    "log_std",
    "amount_z",
    "amount_rank",
    "merchant_frequency",
    "merchant_seen",
    "log_attempts_1d",
    "log_attempts_7d",
    "log_spend_7d",
    "log_gap_hours",
    "log_attempts_1h",
    "recent_category_frequency",
]
LEGACY = STATIC + HISTORY
EXTRA = [
    "hour_frequency",
    "weekday_frequency",
    "channel_frequency",
    "recent_failure_fraction",
    "unique_merchants_1d",
    "same_amount_1d",
    "spend_acceleration",
    "amount_change",
    "category_amount_z",
    "merchant_log_count_7d",
    "merchant_unique_accounts_7d",
    "merchant_amount_z",
    "merchant_new_account",
    "merchant_volume_acceleration",
    "date_only",
    "log_attempts_30d",
    "amount_z_7d",
    "new_category",
]
ENHANCED = LEGACY + EXTRA
RELATIVE = [
    f
    for f in ENHANCED
    if f
    not in [
        "log_amount",
        "category",
        "channel",
        "log_mean",
        "log_std",
        "log_spend_7d",
        "hour",
        "weekday",
        "completed",
    ]
]
CATS = ["category", "channel"]
OPTIONAL = [
    "category",
    "channel",
    "completed",
    "recent_category_frequency",
    "category_amount_z",
    "new_category",
    "channel_frequency",
    "recent_failure_fraction",
]


def build(data: Any) -> Any:
    required = ["payment_id", "timestamp", "amount", "account_id", "merchant_id", "currency"]
    if any(c not in data for c in required):
        raise ValueError("Missing required canonical fields")
    if not data.payment_id.is_unique:
        raise ValueError("Duplicate payment IDs")
    source = (
        data[required + [c for c in ["category", "channel", "completed", "precision"] if c in data]]
        .copy()
        .reset_index(drop=True)
    )
    for c, default in [
        ("category", ""),
        ("channel", ""),
        ("completed", np.nan),
        ("precision", "second"),
    ]:
        if c not in source:
            source[c] = default
    source["timestamp"] = pd.to_datetime(source.timestamp, utc=True, format="mixed")
    # A date-only export has no defensible within-day order or hour/weekday origin.
    day = source.precision.eq("day")
    source.loc[day, "timestamp"] = source.loc[day, "timestamp"].dt.floor("D")
    source["seconds"] = source.timestamp.dt.as_unit("ns").astype("int64") / 1e9
    source["hour"] = source.timestamp.dt.hour
    source["weekday"] = source.timestamp.dt.day_of_week
    source["position"] = np.arange(len(source))
    numeric = [c for c in ENHANCED if c not in CATS]
    matrix = np.empty((len(source), len(numeric)), dtype="float32")
    categories = np.empty((len(source), 2), dtype=object)
    accounts: dict[Any, Any] = {}
    merchants: dict[Any, Any] = {}
    ordered = (
        r._asdict() for r in source.sort_values(["seconds", "payment_id"]).itertuples(index=False)
    )
    for now, batch_iter in groupby(ordered, key=lambda x: x["seconds"]):
        batch = list(batch_iter)
        for r in batch:
            ak = (r["account_id"], r["currency"])
            mk = (r["merchant_id"], r["currency"])
            state = accounts.setdefault(ak, {"events": deque(), "first": now, "last": None})
            mstate = merchants.setdefault(
                mk,
                {
                    "events": deque(),
                    "daily": deque(),
                    "accounts": Counter(),
                    "sum": 0.0,
                    "sum2": 0.0,
                },
            )
            merchant = mstate["events"]
            while state["events"] and state["events"][0][0] < now - 90 * 86400:
                state["events"].popleft()
            while merchant and merchant[0][0] < now - 7 * 86400:
                _, old, who = merchant.popleft()
                mstate["sum"] -= old
                mstate["sum2"] -= old * old
                mstate["accounts"][who] -= 1
                if not mstate["accounts"][who]:
                    del mstate["accounts"][who]
            while mstate["daily"] and mstate["daily"][0] < now - 86400:
                mstate["daily"].popleft()
            events = list(state["events"])
            n = len(events)
            # Prior account event includes time, amount, merchant, category, channel and status.
            logs = np.fromiter((e[1] for e in events), dtype=float, count=n)
            value = np.log1p(float(r["amount"]))
            mean = float(logs.mean()) if n else np.nan
            std = float(logs.std()) if n else np.nan
            recent = [e for e in events if e[0] >= now - 7 * 86400]
            daily = [e for e in recent if e[0] >= now - 86400]
            knowncat = bool(r["category"])
            knownchannel = bool(r["channel"])
            dateonly = r["precision"] == "day"
            mc = Counter(e[2] for e in events)
            cats = Counter(e[3] for e in recent)
            amount7 = np.array([e[1] for e in recent])
            categorylogs = np.array([e[1] for e in events if e[3] == r["category"]])
            maccounts = mstate["accounts"]
            mn = len(merchant)
            mmean = mstate["sum"] / mn if mn else 0
            mstd = np.sqrt(max(0, mstate["sum2"] / mn - mmean * mmean)) if mn else 0
            failures = [1 - e[5] for e in recent if np.isfinite(e[5])]
            oldspend = sum(np.expm1(e[1]) for e in events if e[0] < now - 7 * 86400)
            spend7 = sum(np.expm1(e[1]) for e in recent)
            olddays = max(1, min(90, (now - state["first"]) / 86400) - 7)

            def zscore(array: Any, value: float = value) -> Any:
                return (
                    float((value - array.mean()) / max(array.std(), 0.25))
                    if len(array) >= 5
                    else np.nan
                )

            rec = {
                "log_amount": value,
                "category": str(r["category"]) or "__MISSING__",
                "channel": str(r["channel"]) or "__MISSING__",
                "hour": np.nan if dateonly else r["hour"],
                "weekday": np.nan if dateonly else r["weekday"],
                "completed": r["completed"],
                "history_count": n,
                "history_days": min(90, (now - state["first"]) / 86400),
                "log_mean": mean,
                "log_std": std,
                "amount_z": (value - mean) / max(std, 0.25) if n >= 5 else np.nan,
                "amount_rank": float((logs <= value).mean()) if n >= 5 else np.nan,
                "merchant_frequency": mc[r["merchant_id"]] / n if n else np.nan,
                "merchant_seen": int(mc[r["merchant_id"]] > 0),
                "log_attempts_1d": np.log1p(len(daily)),
                "log_attempts_7d": np.log1p(len(recent)),
                "log_spend_7d": np.log1p(spend7),
                "log_gap_hours": np.log1p((now - state["last"]) / 3600)
                if state["last"] is not None
                else np.nan,
                "log_attempts_1h": np.log1p(sum(e[0] >= now - 3600 for e in daily))
                if not dateonly
                else np.nan,
                "recent_category_frequency": cats[r["category"]] / len(recent)
                if recent and knowncat
                else np.nan,
                "hour_frequency": sum(e[6] == r["hour"] for e in events) / n
                if n and not dateonly
                else np.nan,
                "weekday_frequency": sum(e[7] == r["weekday"] for e in events) / n
                if n and not dateonly
                else np.nan,
                "channel_frequency": sum(e[4] == r["channel"] for e in events) / n
                if n and knownchannel
                else np.nan,
                "recent_failure_fraction": float(np.mean(failures)) if failures else np.nan,
                "unique_merchants_1d": len(set(e[2] for e in daily)),
                "same_amount_1d": sum(abs(e[1] - value) < 1e-8 for e in daily),
                "spend_acceleration": np.log1p(spend7 / 7) - np.log1p(oldspend / olddays)
                if n >= 5
                else np.nan,
                "amount_change": value - events[-1][1] if n else np.nan,
                "category_amount_z": zscore(categorylogs) if knowncat else np.nan,
                "merchant_log_count_7d": np.log1p(len(merchant)),
                "merchant_unique_accounts_7d": len(maccounts),
                "merchant_amount_z": (value - mmean) / max(mstd, 0.25) if mn >= 5 else np.nan,
                "merchant_new_account": int(maccounts[r["account_id"]] == 0),
                "merchant_volume_acceleration": len(mstate["daily"]) / max(1, len(merchant) / 7),
                "date_only": int(dateonly),
                "log_attempts_30d": np.log1p(sum(e[0] >= now - 30 * 86400 for e in events)),
                "amount_z_7d": zscore(amount7),
                "new_category": int(not len(categorylogs)) if knowncat else np.nan,
            }
            matrix[r["position"]] = [rec[c] for c in numeric]
            categories[r["position"]] = [rec[c] for c in CATS]
        # Commit entire timestamp batch after scoring, including shared merchant state.
        for r in batch:
            value = np.log1p(float(r["amount"]))
            a = accounts[(r["account_id"], r["currency"])]
            a["events"].append(
                (
                    now,
                    value,
                    r["merchant_id"],
                    r["category"],
                    r["channel"],
                    r["completed"],
                    r["hour"],
                    r["weekday"],
                )
            )
            a["last"] = now
            m = merchants[(r["merchant_id"], r["currency"])]
            m["events"].append((now, value, r["account_id"]))
            m["daily"].append(now)
            m["sum"] += value
            m["sum2"] += value * value
            m["accounts"][r["account_id"]] += 1
    frame = pd.DataFrame(matrix, columns=numeric)
    for j, c in enumerate(CATS):
        frame[c] = categories[:, j]
    return frame[ENHANCED]
