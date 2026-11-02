from collections import Counter, deque
from itertools import groupby
from typing import Any

import numpy as np
import pandas as pd

GEO = [
    "geo_history_count",
    "geo_region_frequency",
    "geo_city_frequency",
    "geo_new_region",
    "geo_new_city",
    "geo_region_change",
    "geo_regions_1d",
    "geo_available",
]


def build_geo(data: Any) -> Any:
    d = data.copy().reset_index(drop=True)
    for col in ["merchant_region", "merchant_city"]:
        if col not in d:
            d[col] = ""
        d[col] = d[col].fillna("").astype(str).str.strip().str.upper()
        d.loc[d[col].isin(["", "ONLINE", "UNKNOWN", "NAN", "NONE", "NULL"]), col] = ""
    d["t"] = (
        pd.to_datetime(d.timestamp, utc=True, format="mixed").dt.as_unit("ns").astype("int64") / 1e9
    )
    if "precision" in d:
        d.loc[d.precision.eq("day"), "t"] = (
            np.floor(d.loc[d.precision.eq("day"), "t"] / 86400) * 86400
        )
    d["pos"] = np.arange(len(d))
    states: dict[Any, Any] = {}
    result = np.full((len(d), len(GEO)), np.nan, dtype="float32")
    ordered = d.sort_values(["t", "payment_id"])[
        ["account_id", "currency", "merchant_region", "merchant_city", "t", "pos"]
    ].itertuples(index=False, name=None)
    for now, batch_iter in groupby(ordered, key=lambda r: r[4]):
        batch = list(batch_iter)
        for account, currency, region, city, _, pos in batch:
            h = states.setdefault((account, currency), deque())
            while h and h[0][0] < now - 90 * 86400:
                h.popleft()
            regions = Counter(r[1] for r in h if r[1])
            cities = Counter(r[2] for r in h if r[2])
            n = sum(regions.values())
            nc = sum(cities.values())
            known = bool(region)
            result[pos] = [
                n,
                regions[region] / n if known and n else np.nan,
                cities[city] / nc if city and nc else np.nan,
                int(region not in regions) if known else np.nan,
                int(city not in cities) if city else np.nan,
                int(region != h[-1][1]) if known and h and h[-1][1] else np.nan,
                len(set(r[1] for r in h if r[0] >= now - 86400 and r[1])),
                int(known),
            ]
        for account, currency, region, city, _, _pos in batch:
            states[(account, currency)].append((now, region, city))
    return pd.DataFrame(result, columns=GEO)
