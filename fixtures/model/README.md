# Frozen model regression receipts

These compact JSON files were extracted from the existing frozen research outputs before generated training caches were removed. Expected values were not recomputed using the cleaned implementation.

- `authored-holdout.json`: exact probabilities, channel cutoffs and outcomes for the selected model's customer holdout. Tests rebuild features from the original 10,000-row authored CSV, retain the full preceding history, and compare the held-out rows exactly.
- `card-scenarios-alerts.json`: original base-model alert identities for that authored input.
- `coverage-samples.json`: original coverage-component alert identities and row counts for all six checked IBM samples.

Runtime tests also verify causality, label independence, artifact integrity and persistence. These receipts are regression evidence, not a fresh model evaluation. The source reports remain under `docs/model-evaluations/`.
