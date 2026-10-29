# Public repository contents

The public project contains application code, dependency locks, API contracts,
inference bundles, synthetic demo/test fixtures, sample provenance and compact
integration receipts. A public checkout can serve and test the frozen engine;
it does not reproduce training or the private research process.

## Local-only material

`.gitignore` excludes raw datasets, uploads, database files, research projects,
notebooks, training outputs, internal plans, historical research reports,
maintenance inventories, screenshots, test recordings, caches and credentials.
Current product documentation is explicitly allowed under `docs/`; new internal
reports there stay ignored by default. Docker excludes local material as well.

The internal plans now live under `research/plans/` as `engine-roadmap.md`,
`original-project-specification.md` and `model-implementation.md`. Packaging and
research-parity tools live under `research/tools/`. These are local files and
are not dependencies of the public checkout.

CSV files are ignored except for reviewed synthetic fixtures, the browser's
sample asset and downloadable samples. These explicit exceptions support tests
and the Samples interface; never put private uploads in those directories.
The IBM examples are curated subsets of synthetic TabFormer transactions and
include their existing license notice. Sparkov samples are curated synthetic
subsets under the publisher's CC0 designation, with attribution and exact lineage.
Original source datasets are excluded.

Versioned weights under `backend/model_artifacts/` are deliberate public assets.
The older bundles support historical explanations. Their filenames, manifests
and numerical feature files are hash-sensitive and must not be renamed for
cosmetic consistency. No independent fraud-validation claim follows from their
inclusion; see the [model integration notes](stack-d5-integration/README.md).

## Publication checks and existing history

From the repository root, using Python 3.13:

```powershell
python scripts/check_public_repository.py
python scripts/check_public_repository.py --export .cache/public-repository
```

The check rejects ignored files still tracked by Git, files over 50 MiB,
symlinks, common credential patterns and local home-directory paths. It reports
filenames without printing matched values. This is a limited automated check,
not a complete secrets, personal-data or licensing audit.

The export copies checked working-tree contents, including intended uncommitted
changes, into a new directory. It omits `.git`, ignored local files and files
deleted from the working tree. It never overwrites an existing export.

**The existing local Git history contains research files.** Removing them from
the index and adding ignore rules does not remove older commits. Do not push
that history to the public repository. Use a reviewed export to initialize a
separate repository with fresh history, or explicitly arrange a history rewrite
before publishing. Neither history rewriting nor publication is performed by
the checker. Existing local history and research remain intact.
