from typing import Any

import numpy as np
import pandas as pd


def normalize(data: Any, domain: str = "purchase") -> tuple[Any, Any, list[str]]:
    if data.columns.duplicated().any():
        raise ValueError("Duplicate input columns")
    d = data.copy().reset_index(drop=True)
    issues: list[list[str]] = [[] for _ in range(len(d))]
    for c in ["payment_id", "account_id", "currency"]:
        if c not in d:
            d[c] = ""
        d[c] = d[c].fillna("").astype(str).str.strip()
        bad = d[c].str.lower().isin(["", "unknown", "none", "null", "nan", "n/a"])
        for i in np.flatnonzero(bad):
            issues[i].append("missing_" + c)
    for i in np.flatnonzero(d.payment_id.duplicated(keep=False)):
        issues[i].append("duplicate_payment_id")
    d["amount"] = pd.to_numeric(d.get("amount", pd.Series(np.nan, index=d.index)), errors="coerce")
    for i in np.flatnonzero(~np.isfinite(d.amount) | d.amount.le(0)):
        issues[i].append("unsupported_amount")
    if "merchant_id" not in d:
        d["merchant_id"] = d.get("counterparty_id", pd.Series("", index=d.index))
    d["merchant_id"] = d.merchant_id.fillna("").astype(str).str.strip()
    d.loc[
        d.merchant_id.str.lower().isin(["unknown", "none", "null", "nan", "n/a"]), "merchant_id"
    ] = ""
    if "namespace" not in d:
        d["namespace"] = "upload"
    if "event_time" in d and "time_unit" in d:
        d["event_time"] = pd.to_numeric(d.event_time, errors="coerce")
        valid_unit = d.time_unit.isin(["seconds", "step"])
        for i in np.flatnonzero(~valid_unit):
            issues[i].append("explicit_clock_unit_required")
        for c in ["calendar_hour", "calendar_weekday"]:
            if c not in d:
                d[c] = np.nan
        if d.get("precision", pd.Series("", index=d.index)).eq("day").any():
            seconds = d.time_unit.eq("seconds")
            d.loc[seconds, "event_time"] = np.floor(d.loc[seconds, "event_time"] / 86400) * 86400
            d.loc[seconds, ["calendar_hour", "calendar_weekday"]] = np.nan
    else:
        if "timestamp" not in d:
            d["timestamp"] = ""
        text = d.timestamp.astype(str)
        precision = d.get("precision", pd.Series("second", index=d.index))
        date_only = precision.eq("day") & text.str.fullmatch(r"\d{4}-\d\d-\d\d")
        zoned = text.str.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)")
        ts = pd.to_datetime(text, format="mixed", errors="coerce", utc=True)
        good = zoned | date_only
        d["event_time"] = ts.dt.as_unit("ns").astype("int64") / 1e9
        d.loc[~good | ts.isna(), "event_time"] = np.nan
        d["calendar_hour"] = ts.dt.hour.astype(float)
        d["calendar_weekday"] = ts.dt.day_of_week.astype(float)
        d["time_unit"] = "seconds"
        if date_only.any():
            d["event_time"] = np.floor(d.event_time / 86400) * 86400
            d[["calendar_hour", "calendar_weekday"]] = np.nan
    for i in np.flatnonzero(~np.isfinite(d.event_time)):
        issues[i].append("valid_explicit_clock_required")
    incompatible = d.time_unit.ne("seconds" if domain == "purchase" else "step")
    for i in np.flatnonzero(incompatible):
        issues[i].append("clock_outside_research_domain")
    d["day"] = np.where(d.time_unit.eq("seconds"), np.floor(d.event_time / 86400), d.event_time)
    if "category" not in d:
        d["category"] = d.get("mcc", pd.Series("", index=d.index))
    if "completed" not in d:
        status = d.get("status", pd.Series("", index=d.index)).astype(str).str.lower()
        d["completed"] = status.map(
            {"completed": 1.0, "posted": 1.0, "settled": 1.0, "failed": 0.0, "declined": 0.0}
        )
    d["completed"] = pd.to_numeric(d.completed, errors="coerce").where(lambda s: s.isin([0, 1]))
    if "merchant_region" not in d:
        d["merchant_region"] = d.get("merchant_state", pd.Series("", index=d.index))
    valid = np.array([not x for x in issues], bool)
    return d, valid, [";".join(x) for x in issues]
