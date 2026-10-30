# Security boundaries

RiskFlow's anonymous deployment is a temporary investigation demo. Use the Docker
image with `RISKFLOW_PUBLIC_DEMO=true`, one worker and one instance. Retained-dataset
routes are disabled in this mode. Local retained-data mode has no authentication or
per-user authorization and must not be exposed publicly.

## CSV and transaction inputs

- The browser reads CSV as text, with a 5 MB file limit, 100-column limit and
  10,000-payment limit. Binary/control characters and malformed CSV are rejected.
  Files are not executed, extracted, or installed as models.
- Simulation and its preview send transaction data to the API as JSON. Graph-only
  imports stay in the browser. Use synthetic or appropriately anonymized data for
  the public demo; it is not a service for storing sensitive financial records.
- The API independently validates identifiers, values, field lengths and graph
  limits. It bounds streamed bodies to 16 MiB, rejects compressed bodies, and gives
  clients 30 seconds to finish sending a body.
- Public mode admits one HTTP write at a time before buffering, with rolling limits
  of 20 inference requests and 60 total writes per minute. Health and static assets
  remain available while a write is in progress. Writes to unknown paths share the
  same limits, so changing the URL cannot bypass admission.
- Display labels render as text. HTML, JavaScript and spreadsheet formulas in CSV
  fields are not evaluated. The production page also restricts scripts to its own
  origin. If an export of user-supplied CSV is added, protect against spreadsheet
  formula injection before allowing the result to be opened in Excel or similar
  software; ordinary CSV quoting is insufficient.

Public mode does not save uploaded workspaces or assessments on the server. API
responses disable caching, and request logs record status and timing without body
contents. Hosting-provider logging and retention still need to be configured.

## Deployment and maintenance

Terminate HTTPS at the hosting provider. Keep memory/CPU limits, request deadlines
and instance limits enabled. Application limits do not stop distributed attacks or
prevent every hosting charge; use platform rate controls if the demo is abused.

The container runs as a non-root user. Model packages are bundled and checked
against pinned hashes. Historical components use Python pickle internally: only
load the trusted packaged models, never user-supplied weights. Keep dependencies
and base images patched; a clean vulnerability scan is not a security guarantee.
The public explanation endpoint accepts only the current Stack-d5 model, so a
request cannot make it load additional historical model bundles into memory.

Before publishing, run `scripts/check_public_repository.py` and review the
[repository policy](docs/repository-policy.md). Ignore rules do not sanitize Git
history. Do not include private uploads, credentials or real customer data in bug
reports, fixtures or screenshots.
