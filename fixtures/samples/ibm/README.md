# Historical IBM compatibility fixtures

These five CSVs are retained for frozen coverage-model decisions, CSV adapters,
browser imports and explanation regression tests. They are no longer advertised
or shipped as public sample downloads. Their bytes and SHA-256 hashes are unchanged.

`*.lineage.json` records original source rows and historical decisions; those
decisions do not describe the current Stack-d5 queue. `selection.json` records
the original curation. The active five-payment walkthrough remains under
`frontend/public/samples/ibm/first-five.csv` and is shared with compatibility tests.

These are IBM TabFormer synthetic transactions. The existing
[attribution](../../../frontend/public/samples/ibm/ATTRIBUTION.txt) and
[Apache-2.0 license](../../../frontend/public/samples/ibm/LICENSE.txt) apply.
Current demonstration results are documented in the
[sample library](../../../docs/sample-library/README.md).
