from typing import Any

import numpy as np
import pandas as pd

from .legacy_features import build as legacy_build
from .legacy_geo import build_geo


def legacy_frame(d: Any) -> tuple[Any, Any]:
    """Feature-level diagnostic only, outside v2 CLI's supported currency contract.

    Epoch conversion below is internal arithmetic, never a claimed source date.
    Unavailable calendar signals are masked before model scoring.
    """
    good = d.merchant_id.fillna("").ne("").to_numpy()
    out = pd.DataFrame(index=d.index)
    if not good.any():
        return out, good
    x = d.loc[good].copy().reset_index(drop=True)
    x["timestamp"] = pd.to_datetime(x.event_time, unit="s", utc=True)
    x["precision"] = np.where(
        x.get("calendar_hour", pd.Series(np.nan, index=x.index)).isna(), "day", "second"
    )
    f = pd.concat([legacy_build(x), build_geo(x)], axis=1)
    for c, cols in [
        ("calendar_weekday", ["weekday", "weekday_frequency"]),
        ("calendar_hour", ["hour", "hour_frequency"]),
    ]:
        unknown = x.get(c, pd.Series(np.nan, index=x.index)).isna().to_numpy()
        f.loc[unknown, cols] = np.nan
    out = pd.DataFrame(np.nan, index=d.index, columns=f.columns)
    # String columns must retain their categorical dtype rather than cast into floats.
    for c in ["category", "channel"]:
        out[c] = "__MISSING__"
    out.loc[good, f.columns] = f.to_numpy()
    for c in out.columns:
        if c not in ["category", "channel"]:
            out[c] = pd.to_numeric(out[c])
    return out, good
