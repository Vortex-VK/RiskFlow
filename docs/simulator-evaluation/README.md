# Evaluation evidence

This directory contains completed experiment reports and the accepted-model registry. Version numbers identify experimental evidence, not maintained Python packages.

- [Current ML guide, findings and verification command](../ml.md)
- [Accepted model pointer](current-model.json)
- [Accepted v13 record](accepted-model-v13.json)
- [V13 findings](ml-v13/report.md)
- [V14 findings: no improvement over v13](ml-v14/report.md)
- [Current accepted-model replay verification](../maintenance/accepted-model-verification.json)

Earlier reports and manifests remain unchanged as historical evidence. Their versioned source paths and old runner commands were retired during the authorized cleanup. Use `python -m ml.verify` from `backend` to verify the accepted model with the maintained code. Local model packages and feature caches are required for that replay.
