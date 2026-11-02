"""Portable, prior-only features on explicit numeric source clocks.

No currency conversion, invented calendar origin, target encoding or raw IDs.
Statistics use previous distinct timestamp batches, never the current batch.
"""

from typing import Any

import numpy as np
import pandas as pd

CORE = [
    "p_log_history_n",
    "p_log_std100",
    "p_log_ratio10",
    "p_log_ratio100",
    "p_z10",
    "p_z100",
    "p_log_gap_ratio",
    "p_log_count1h",
    "p_log_count1d",
    "p_log_count7d",
    "p_counterparty_known",
    "p_counterparty_seen",
    "p_counterparty_frequency",
    "p_log_distinct_counterparties",
    "p_log_counterparty_n",
    "p_log_counterparty_distinct_accounts",
    "p_counterparty_amount_z",
    "p_account_new_to_counterparty",
]
OPTIONAL = [
    "p_hour_sin",
    "p_hour_cos",
    "p_weekday_sin",
    "p_weekday_cos",
    "p_category_known",
    "p_category_frequency",
    "p_new_category",
    "p_channel_known",
    "p_channel_frequency",
    "p_region_known",
    "p_region_frequency",
    "p_new_region",
    "p_city_known",
    "p_city_frequency",
    "p_new_city",
]
PORTABLE = CORE + OPTIONAL
BALANCE = [
    "p_old_balance_ratio",
    "p_old_balance_negative",
    "p_recipient_old_balance_ratio",
    "p_recipient_old_balance_negative",
]


def _stats(d: Any, identity: str) -> Any:
    result = np.full((len(d), 10), np.nan, dtype=np.float64)
    result[:, 0] = 0
    seconds = d.time_unit.eq("seconds").to_numpy()
    result[seconds, 7:] = 0
    # Missing identities are never a shared entity.
    valid = d[identity].ne("")
    valid_indices = np.flatnonzero(valid.to_numpy())
    all_valid = bool(valid.all())
    times = d.event_time.to_numpy()
    amounts = d.amount.to_numpy()
    for indices in (
        d.loc[valid].groupby(["namespace", "currency", identity], sort=False).indices.values()
    ):
        # indices are relative to the filtered frame.
        ix = valid_indices[indices] if not all_valid else indices
        if len(ix) < 2:
            continue
        t = times[ix]
        order = np.argsort(t, kind="stable")
        ix = ix[order]
        t = t[order]
        logs = np.log(amounts[ix])
        unique, inv, counts = np.unique(t, return_inverse=True, return_counts=True)
        sums = np.bincount(inv, weights=logs)
        squares = np.bincount(inv, weights=logs * logs)
        cn = np.r_[0, np.cumsum(counts)]
        cs = np.r_[0.0, np.cumsum(sums)]
        cq = np.r_[0.0, np.cumsum(squares)]
        j = inv
        result[ix, 0] = np.log1p(cn[j])
        for window, ratio_col, z_col in [(10, 2, 4), (100, 3, 5)]:
            lo = np.maximum(0, j - window)
            n = cn[j] - cn[lo]
            mean = np.divide(cs[j] - cs[lo], n, out=np.zeros(len(n)), where=n > 0)
            variance = np.maximum(
                0, np.divide(cq[j] - cq[lo], n, out=np.zeros(len(n)), where=n > 0) - mean * mean
            )
            std = np.sqrt(variance)
            enough = n >= 5
            result[ix[enough], ratio_col] = (logs - mean)[enough]
            result[ix[enough], z_col] = ((logs - mean) / np.maximum(std, 0.25))[enough]
            if window == 100:
                result[ix[enough], 1] = std[enough]
        enough = j >= 2
        previous = unique[np.maximum(j - 1, 0)]
        mean_gap = np.divide(previous - unique[0], np.maximum(j - 1, 1))
        ratio = np.divide(t - previous, mean_gap, out=np.ones(len(t)), where=mean_gap > 0)
        result[ix[enough], 6] = np.clip(np.log(np.maximum(ratio[enough], 1e-12)), -30, 30)
        for col, horizon in [(7, 3600), (8, 86400), (9, 7 * 86400)]:
            lo = np.searchsorted(unique, t - horizon, side="left")
            count = cn[j] - cn[lo]
            mask = seconds[ix]
            result[ix[mask], col] = np.log1p(count[mask])
    return result


def _prior_count(d: Any, keys: list[str]) -> Any:
    if d.empty:
        return np.zeros(0)
    g = d.groupby(keys + ["event_time"], sort=True, dropna=False).size().rename("n").reset_index()
    g["prior"] = g.groupby(keys, sort=False, dropna=False).n.cumsum() - g.n
    return (
        d[keys + ["event_time"]]
        .merge(
            g[keys + ["event_time", "prior"]],
            on=keys + ["event_time"],
            how="left",
            sort=False,
            validate="many_to_one",
        )
        .prior.to_numpy(dtype=float)
    )


def _distinct(d: Any, identity: str, other: str) -> Any:
    out = np.zeros(len(d))
    valid = d[identity].ne("") & d[other].ne("")
    ixvalid = np.flatnonzero(valid.to_numpy())
    part = d.loc[valid]
    first = (
        part.groupby(["namespace", "currency", identity, other], sort=False)
        .event_time.min()
        .reset_index()
    )
    starts = {
        k: np.sort(g.event_time.to_numpy())
        for k, g in first.groupby(["namespace", "currency", identity], sort=False)
    }
    for key, ix in part.groupby(["namespace", "currency", identity], sort=False).indices.items():
        orig = ixvalid[ix]
        out[orig] = np.searchsorted(starts[key], d.event_time.to_numpy()[orig], side="left")
    return out


def build(data: Any) -> Any:
    required = ["payment_id", "event_time", "time_unit", "amount", "currency", "account_id"]
    if any(c not in data for c in required):
        raise ValueError("Missing explicit portable input fields")
    d = data.copy().reset_index(drop=True)
    if not d.payment_id.is_unique:
        raise ValueError("Duplicate payment IDs")
    if not np.isfinite(d.event_time.astype(float)).all():
        raise ValueError("Invalid event clock")
    if not d.time_unit.isin(["seconds", "step"]).all():
        raise ValueError("Unknown clock unit")
    if not np.isfinite(d.amount.astype(float)).all() or (d.amount.astype(float) <= 0).any():
        raise ValueError("Amounts must be positive and finite")
    for c, default in [
        ("namespace", "upload"),
        ("merchant_id", ""),
        ("category", ""),
        ("channel", ""),
        ("merchant_region", ""),
        ("merchant_city", ""),
    ]:
        if c not in d:
            d[c] = default
        d[c] = d[c].fillna("").astype(str).str.strip()
        d.loc[d[c].str.lower().isin(["unknown", "none", "null", "nan", "n/a"]), c] = ""
    if d.account_id.fillna("").eq("").any():
        raise ValueError("Stable account identity required")
    if d.currency.fillna("").eq("").any():
        raise ValueError("Explicit monetary-unit scope required")
    # Unit consistency is necessary for history windows and meaningful ratios.
    if (d.groupby(["namespace", "currency", "account_id"]).time_unit.nunique() > 1).any():
        raise ValueError("Mixed time units within an account")
    d["amount"] = d.amount.astype(float)
    d["event_time"] = d.event_time.astype(float)
    for c in ["merchant_region", "merchant_city"]:
        d[c] = d[c].str.upper()
        d.loc[d[c].eq("ONLINE"), c] = ""
    result = pd.DataFrame(np.nan, index=d.index, columns=PORTABLE + BALANCE, dtype=float)
    a = _stats(d, "account_id")
    result[CORE[:10]] = a
    known = d.merchant_id.ne("").to_numpy()
    result["p_counterparty_known"] = known.astype(float)
    pair = np.zeros(len(d))
    pair[known] = _prior_count(d.loc[known], ["namespace", "currency", "account_id", "merchant_id"])
    account_prior = np.expm1(a[:, 0])
    pairfreq = np.divide(pair, account_prior, out=np.zeros(len(d)), where=account_prior > 0)
    result.loc[known, "p_counterparty_seen"] = (pair[known] > 0).astype(float)
    result.loc[known, "p_counterparty_frequency"] = pairfreq[known]
    result["p_log_distinct_counterparties"] = np.log1p(_distinct(d, "account_id", "merchant_id"))
    result.loc[~known, "p_log_distinct_counterparties"] = np.nan
    if known.any():
        m = _stats(d, "merchant_id")
        result.loc[known, "p_log_counterparty_n"] = m[known, 0]
        result.loc[known, "p_counterparty_amount_z"] = m[known, 5]
        result.loc[known, "p_log_counterparty_distinct_accounts"] = np.log1p(
            _distinct(d, "merchant_id", "account_id")[known]
        )
        result.loc[known, "p_account_new_to_counterparty"] = (pair[known] == 0).astype(float)
    for source, period, label in [
        ("calendar_hour", 24, "hour"),
        ("calendar_weekday", 7, "weekday"),
    ]:
        if source in d:
            value = pd.to_numeric(d[source], errors="coerce")
            valid = value.ge(0) & value.lt(period)
            result.loc[valid, "p_" + label + "_sin"] = np.sin(2 * np.pi * value[valid] / period)
            result.loc[valid, "p_" + label + "_cos"] = np.cos(2 * np.pi * value[valid] / period)
    for c, label in [
        ("category", "category"),
        ("channel", "channel"),
        ("merchant_region", "region"),
        ("merchant_city", "city"),
    ]:
        valid = d[c].ne("").to_numpy()
        result["p_" + label + "_known"] = valid.astype(float)
        counts = np.zeros(len(d))
        counts[valid] = _prior_count(d.loc[valid], ["namespace", "currency", "account_id", c])
        freq = np.divide(counts, account_prior, out=np.zeros(len(d)), where=account_prior > 0)
        result.loc[valid, "p_" + label + "_frequency"] = freq[valid]
        if label != "channel":
            result.loc[valid, "p_new_" + label] = (counts[valid] == 0).astype(float)
    for source, ratio, negative in [
        ("old_balance", "p_old_balance_ratio", "p_old_balance_negative"),
        (
            "recipient_old_balance",
            "p_recipient_old_balance_ratio",
            "p_recipient_old_balance_negative",
        ),
    ]:
        if source in d:
            x = pd.to_numeric(d[source], errors="coerce")
            valid = x.notna()
            result.loc[valid, ratio] = np.log1p(x[valid].abs() / d.loc[valid, "amount"])
            result.loc[valid, negative] = (x[valid] < 0).astype(float)
    return result.astype("float32")
