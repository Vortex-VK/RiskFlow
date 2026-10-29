RiskFlow synthetic purchase scenarios

These are fictional, curated demonstrations, not records from a bank or independent
model benchmarks. They depict mostly in-store shopping, repeat visits, shared shops
and occasional online card misuse. Prices, schedules, incident rates and labels are
authored scenario assumptions. Some legitimate purchases are expensive or unfamiliar;
some fraudulent purchases are small. Misses and false alerts are retained.

Every candidate is generated before scoring. The complete candidates were compared
using the installed Stack-d5 model, the app's unchanged automatic review capacity,
and the rendered graph. Selection favors useful demonstrations and therefore does
not estimate performance on arbitrary uploads. No user uploads or training rows
were copied into these scenarios. No model or threshold was changed for them.

Reproduction in the RiskFlow repository:
  scripts/sample_scenarios.py: deterministic ledger generator
  scripts/compare_sample_scenarios.py: candidate scoring
  scripts/export_sample_scenarios.py: selected CSVs and score receipts
  docs/sample-library/scenario-selection-2026-10-29.json: comparison and seeds
  docs/sample-library/stack-d5-auto/: current model results and row provenance

Fields use USD and UTC. merchant_category is a readable spending category; mcc is
the numeric merchant classification used by scoring. is_fraud and scenario_note
describe the authored incident and never enter scoring. Missing device and location
details remain unknown. Each file starts with its own visible history.

The generated CSV data are dedicated to the public domain under CC0 1.0.
https://creativecommons.org/publicdomain/zero/1.0/
