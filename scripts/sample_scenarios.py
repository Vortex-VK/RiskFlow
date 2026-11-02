"""Reproducible, fictional purchase ledgers. Generation never reads model outputs.

Amounts, schedules and incident rates are scenario assumptions, not population
estimates. Whole generated ledgers may be compared for demonstration selection;
individual rows and labels must not be edited in response to their scores.
"""

from datetime import UTC, datetime, timedelta

import numpy as np
import pandas as pd

SIZES = {50: (6, 2), 250: (18, 4), 1000: (50, 7), 5000: (180, 16), 10000: (340, 24)}
FAMILIES = ("neighborhood", "commuter", "mixed", "routine", "in-store")
CATEGORIES = (
    ("Market", "5411", 48, 0.42),
    ("Cafe", "5812", 15, 0.45),
    ("Fuel", "5541", 43, 0.30),
    ("Pharmacy", "5912", 24, 0.48),
    ("Clothing", "5651", 65, 0.55),
    ("Home", "5200", 83, 0.55),
    ("Electronics", "5732", 190, 0.55),
    ("Hotel", "7011", 155, 0.40),
)
DISTRICTS = (
    "Maple",
    "Harbor",
    "Cedar",
    "Riverside",
    "Oak",
    "Hillcrest",
    "Park",
    "Lakeside",
)


def generate(size: int, family: str, seed: int) -> pd.DataFrame:
    if family not in FAMILIES:
        raise ValueError(family)
    rng = np.random.default_rng(seed)
    account_count, district_count = SIZES[size]
    # Different family structures are fixed in advance, independent of scoring.
    shared_rate = {
        "neighborhood": 0.04,
        "commuter": 0.13,
        "mixed": 0.09,
        "routine": 0.06,
        "in-store": 0.06,
    }[family]
    explore_rate = {
        "neighborhood": 0.12,
        "commuter": 0.19,
        "mixed": 0.27,
        "routine": 0.15,
        "in-store": 0.15,
    }[family]
    stores_per_district = max(8, round(account_count / district_count * 2.2))
    merchants = []
    for district in range(district_count):
        for j in range(stores_per_district):
            cat = j % len(CATEGORIES)
            kind, mcc, median, spread = CATEGORIES[cat]
            merchants.append(
                (
                    district,
                    cat,
                    f"{DISTRICTS[district % 8]} {kind} {district + 1}-{j // 8 + 1}",
                    mcc,
                    median,
                    spread,
                )
            )
    local_count = len(merchants)
    for j, name in enumerate(
        (
            "Metro Grocery",
            "City Coffee",
            "Transit Fuel",
            "Online Pharmacy",
            "Web Outfitters",
            "Home Delivery",
            "Digital Store",
            "Station Hotel",
        )
    ):
        kind, mcc, median, spread = CATEGORIES[j]
        merchants.append((-1, j, name, mcc, median, spread))
    homes = np.arange(account_count) % district_count
    rng.shuffle(homes)
    scales = rng.lognormal(0, 0.3, account_count)
    activity = rng.lognormal(0, 0.48, account_count)
    favorites = []
    for home in homes:
        candidates = np.arange(
            home * stores_per_district, (home + 1) * stores_per_district
        )
        if family in {"routine", "in-store"}:
            favorites.append(
                np.array(
                    [
                        rng.choice(
                            candidates[candidates % stores_per_district % 8 == c]
                        )
                        for c in [0, 1, 2, 3, int(rng.integers(4, 8))]
                    ]
                )
            )
        else:
            favorites.append(
                rng.choice(candidates, min(5, len(candidates)), replace=False)
            )
    fraud_count = max(2, round(size * 0.018))
    normal_count = size - fraud_count
    # Guarantee an ordinary opening purchase for every account, then vary activity.
    accounts = np.concatenate(
        (
            np.arange(account_count),
            rng.choice(
                account_count, normal_count - account_count, p=activity / activity.sum()
            ),
        )
    )
    duration = max(12, round(size / account_count * 1.7))
    days = np.concatenate(
        (
            rng.uniform(0, 2, account_count),
            rng.uniform(2, duration, normal_count - account_count),
        )
    )
    start = datetime(2026, 3, 1, tzinfo=UTC)
    records = []

    def emit(account, merchant, moment, amount, channel, fraud, incident):
        _, category, name, mcc, _, _ = merchants[merchant]
        records.append(
            {
                "timestamp": moment.isoformat(timespec="seconds").replace(
                    "+00:00", "Z"
                ),
                "account_id": f"A{account + 1:04d}",
                "account_name": f"Account {account + 1:03d}",
                "merchant_id": f"M{merchant + 1:04d}",
                "merchant_name": name,
                "merchant_category": (
                    "groceries",
                    "dining",
                    "transport",
                    "other",
                    "retail",
                    "retail",
                    "electronics",
                    "travel",
                )[category],
                "mcc": mcc,
                "amount": f"{max(1, amount):.2f}",
                "currency": "USD",
                "channel": channel,
                "status": "completed",
                "is_fraud": str(int(fraud)),
                "scenario_note": incident,
            }
        )

    for a, day in zip(accounts, days, strict=True):
        p = rng.random()
        if p < shared_rate:
            merchant = local_count + int(
                rng.choice(8, p=[0.25, 0.22, 0.15, 0.08, 0.12, 0.08, 0.06, 0.04])
            )
        elif p < shared_rate + explore_rate:
            home = (
                int(homes[a])
                if rng.random() < 0.85
                else int(rng.integers(district_count))
            )
            if family in {"routine", "in-store"}:
                category = int(
                    rng.choice(8, p=[0.27, 0.22, 0.16, 0.12, 0.10, 0.07, 0.04, 0.02])
                )
                options = [j for j in range(stores_per_district) if j % 8 == category]
                merchant = home * stores_per_district + int(rng.choice(options))
            else:
                merchant = home * stores_per_district + int(
                    rng.integers(stores_per_district)
                )
        else:
            merchant = int(rng.choice(favorites[a], p=[0.36, 0.26, 0.18, 0.12, 0.08]))
        _, category, _, _, median, spread = merchants[merchant]
        amount = rng.lognormal(np.log(median * scales[a]), spread)
        # Legitimate expensive and unfamiliar purchases remain in the ledger.
        if rng.random() < 0.012:
            amount *= rng.uniform(2, 4)
        online_rate = (
            0.36 if family == "mixed" else 0.035 if family == "in-store" else 0.16
        )
        channel = (
            "Online Transaction" if rng.random() < online_rate else "Chip Transaction"
        )
        moment = start + timedelta(
            days=int(day),
            hours=int(rng.integers(7, 23)),
            seconds=int(rng.integers(3600)),
        )
        emit(int(a), merchant, moment, amount, channel, False, "ordinary purchase")

    # Incidents occur after some visible history, with multiple related payments.
    incident_size = 3 if size >= 250 else 2
    for i in range(0, fraud_count, incident_size):
        a = int(rng.integers(account_count))
        day = int(rng.integers(max(3, int(duration * 0.6)), duration))
        onset = start + timedelta(
            days=day,
            hours=int(rng.choice([1, 2, 3, 13, 21])),
            minutes=int(rng.integers(60)),
        )
        merchant = local_count + int(rng.choice([4, 6]))
        for j in range(min(incident_size, fraud_count - i)):
            # A mix of high-value misuse and smaller purchases; not every fraud
            # is an amount outlier and not every amount outlier is fraud.
            small = (i + j) % 7 == 0
            amount = rng.uniform(18, 85) if small else rng.lognormal(np.log(920), 0.30)
            emit(
                a,
                merchant,
                onset + timedelta(seconds=j * int(rng.integers(80, 460))),
                amount,
                "Online Transaction",
                True,
                "card misuse: small purchase"
                if small
                else "card misuse: purchase burst",
            )
    records.sort(key=lambda r: (r["timestamp"], r["account_id"]))
    for i, row in enumerate(records):
        row["transaction_id"] = f"DEMO-{size}-{i + 1:05d}"
    frame = pd.DataFrame(records)
    return frame[
        ["transaction_id", *[c for c in frame.columns if c != "transaction_id"]]
    ]
