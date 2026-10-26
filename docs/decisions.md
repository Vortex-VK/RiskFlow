# Implementation decisions

## Plan review

Plan v1.3 is coherent enough to start implementation. Its architecture separates scenario facts, historical features, scoring, policy, evaluation, and presentation. Integer amounts, explicit context, bounded input sizes, immutable snapshots, request guards, and independent fixture expectations address the main correctness risks. No domain contradiction requiring a plan rewrite was found.

The Stage 0 visual gate was satisfied on October 20, 2026: after reviewing Original with solid dark-mode fills, the user said "perfect" and explicitly authorized logic implementation. Preserve the approved appearance and jelly behavior through the production port.

## Preview technology

Use dependency-free HTML/CSS/SVG for Stage 0, with a generated fixture bundle. This opens directly from disk and avoids setting up production infrastructure before visual approval. The SVG is disposable presentation code; production still uses React Flow and a Python simulation service. No frontend scorer was introduced.

The preview uses only owned, fixed fixture content. It is not a general API/storage decoder or a safe renderer for untrusted imported documents. Those boundaries are Stage 1/2 work.

## Canonical fixtures

Store scenario documents and independent expected outcomes separately under `fixtures/`. Use `sourceTemplateVersion: 1` in the scenario contract and `templateVersion: 1` in expectation metadata; the template-list endpoint exposes version 1. Generate the browser bundle from those files. Never change expected scores to match production output without reviewing the rule semantics.

The fixture check script validates integrity and reconciles independently authored expected totals. The Python engine and metric functions now separately reproduce those expectations. While implementing the engine, tests exposed `location-gb` in Account Takeover containing country code `US`, contrary to plan §8.4. Corrected the fixture to `GB` and regenerated the preview bundle; the independent expected scores were unchanged.

## Layout

The user rejected the dense dashboard and requested a minimal graph tool, referencing Agar.io's open canvas while asking for a professional simulation aesthetic. The graph now occupies the full viewport. Scenario selection, payments, and help open only on request; object selection opens a dismissible card. Detailed rules, properties, and metrics use native disclosure controls.

The compact organic node arrangement implements that direction. Accounts are blue, merchants amber, devices violet, and locations teal in both light and dark palettes. A theme toggle beside help changes appearance without resetting the workspace. Node bodies deform through bounded springs while labels stay steady. These revised details are approved. The mathematical and technical architecture is unchanged; `plan.md` v1.8 records the visual amendments.

Replace manually curved paths with straight connections. The curves had no dynamic obstacle avoidance, so their appearance suggested behavior the preview did not provide. Moving nodes updates straight endpoints and labels.

On narrow screens the initial camera opens closer to the account cluster so labels stay readable; users can pan to surrounding context or choose Fit to see the whole network. Panning and zooming never alter the fixture. Selection does not automatically move the camera.

## Elastic interaction

Use a small browser-native spring controller in the preview rather than introducing an animation dependency. A single requestAnimationFrame loop runs only during deformation or drag updates. Transform only node bodies/icons; keep labels and connection geometry independent. Pointer capture distinguishes a click from a drag, cancellation restores the initial position, and reduced motion retains direct positioning without bounce.

Replace fixed press/release impulses with filtered pointer velocity driving a continuous directional strain matrix and trailing displacement. The local grab point anchors the matrix; diagonal movement, changes of direction, speed, and stopping affect the shape. Input velocity decays when movement stops, including while held. Spring integration is bounded and preserves its current velocity on release. Suppress native SVG focus boxes and selection during pointer dragging, retaining shape-following keyboard focus.

The next review requested local jelly behavior beyond whole-body scaling. Add a 48-point radial spring surface with neighbor coupling, restoring forces, damping, and bounded displacement. Drag velocity supplies localized pull; acceleration supplies directional inertia. Cubic interpolation avoids visible polygon corners, while area normalization limits volume drift. Keep the existing bulk response beneath this independent surface motion. This is a small visual soft-body model; it does not add object collision physics or affect payment scoring. Reset restores both the bulk transform and the contour.

Keep layout offsets in a session-local map outside canonical fixtures. This makes the design interaction concrete without implying production undo, persistence, or scenario editing is complete. The React Flow implementation must integrate the approved motion into its document/history lifecycle.

## Selected appearance

The user chose Original and asked to carry over the second preview's solid dark-mode object interiors. Use those four fill colors and contrasting dark symbols while retaining Original's light outside labels, typography, surfaces, canvas, and motion. The alternatives and comparison infrastructure have been removed. The user approved the revised dark-mode fill and authorized production logic implementation.

## Tooling and hosting

Stage 1 ports the approved visuals into custom React Flow nodes and straight edges. React Flow owns graph navigation and connection gestures; the existing elastic controller owns body deformation and temporary pointer positioning. Its original constants are retained. Begin/end callbacks commit one position change to the Zustand document history, and cancellation commits nothing. The preserved JavaScript motion module has a typed adapter; application state, forms, domain edits, and API adapters use strict TypeScript. The static preview remains a design reference.

Scenario edits pass through pure integrity checks before one snapshot commit. Grouped edges are presentation-only: payment events retain their independent IDs. Form buffers do not enter committed state, and invalid edits cannot be bypassed by selecting another object or invoking history. Shared changes expose the affected synthetic-label count. Starter context and cascade deletion are atomic. Camera movement stays outside history, and selection never recenters the canvas.

The browser uses explicit centralized decoders and shared integrity helpers, following the plan's lightweight boundary approach. No frontend scoring or schema-validation framework is introduced. The build uses the documented [React Flow custom-node integration](https://reactflow.dev/learn/customization/custom-nodes) and [React Flow component API](https://reactflow.dev/api-reference/react-flow). Browser acceptance uses the installed Chrome, real Python endpoints, and axe scans. The first hands-on checkpoint is the completed editor, before scoring/replay changes complicate feedback about interaction feel.

The system Python 3.11.9 remains unchanged. Project-local tools are Node 24.22.0 LTS, Python 3.13.16, and uv 0.13.4 under ignored `.tools/`; caches stay under `.cache/`. The PowerShell helper changes only its current process environment. Versions are recorded in runtime pins and dependency lockfiles. Official Node and uv download checksums were verified before extraction.

Use TypeScript 5.9.3 to satisfy openapi-typescript 7.13.0's declared 5.x peer range. Python development uses httpx2, the supported test transport requested by the installed Starlette. `backend/uv.lock` and `frontend/package-lock.json` record exact transitive dependencies. Runtime setup followed the official [Node distributions](https://nodejs.org/en/download) and [uv installation instructions](https://docs.astral.sh/uv/getting-started/installation/); contract generation follows the [openapi-typescript CLI](https://openapi-ts.dev/cli).

Pydantic owns wire structure; a separate pure validator checks relationships and scenario readiness. Canonical UTC millisecond strings are validated as real calendar timestamps before chronological comparison. Incomplete drafts remain structurally representable; simulation readiness requires all four node categories and at least one payment. Required nullable fields, including `seed` and `knownFrom`, remain present in template responses. The bundled 249 ISO alpha-2 country codes come from [pycountry's ISO 3166-1 data](https://github.com/pycountry/pycountry/blob/main/src/pycountry/databases/iso3166-1.json); runtime validation makes no network calls.

Only implemented endpoints appear in OpenAPI. Health now reports `engine-v1`; `/api/v1/simulations` returns the complete result contract. The design preview still displays fixture expectations, while the editable React application uses actual Python simulation.

The Sites workflow was consulted for local website preview. Its Worker hosting model does not satisfy this plan’s Python single-service architecture. No Site was registered or published. Hosting remains the plan’s later deployment decision, based on actual account access, cost, and startup measurements.

## Simulation and replay

The engine copies and normalizes its input, orders payments by canonical timestamp and ASCII ID, and maintains attempted-payment history independently of decisions. All six rules return points, explicit measurements, thresholds, evidence IDs, and explanations, including zero-point rules. Ground-truth labels and cost assumptions are consumed only by metrics. Run identity and completion time are added at the API boundary, keeping engine output deterministic.

Simulation captures the submitted definition and view. A centralized decoder checks wire shape, snapshot identity, event order, evidence references, score arithmetic, metrics, and coverage before a deeply frozen run enters state. Session/generation guards and cancellation prevent stale responses from opening over edits. A valid active form is applied before simulation; invalid input stays in the form. Undo/redo also cancels pending work. At most two successful runs are retained per workspace; replacements clear them.

Replay starts from captured names, positions, and business facts. At the user's request, dragging and keyboard movement now rearrange a temporary inspection layout during and after playback, alongside transient pan/zoom. Returning to editing restores the working graph; inspection movements do not change scores, captured facts/positions, or history. One animation-frame clock derives progress from a recorded presentation schedule; visibility changes pause it and reduced motion suppresses moving particles. Only completed events appear in progressive counts/decisions. The explicitly labeled Completed run totals panel covers the entire result. Evidence highlighting never introduces future payment usage; Focus is optional and manual camera control remains the default.

The user's H16 Approve/0 report was traced to the badge left at the end of playback, not an engine discrepancy: H16 is expected to score 0 and H10 scores 85. Completion now shows whole-run decision counts and Inspect payments. Editable connection handles appear only on selection, use 24-pixel hit areas, and support dropping onto the other object's body. Hidden/unselected handles cannot initiate connections; replay handles remain disabled.

Subsequent feedback confirmed the full expected hero score sequence but identified washed-out objects during paused/completed inspection. A browser regression reproduced the 28% opacity applied to unrelated nodes. Replay now retains full node/edge opacity and highlights context with outlines/strokes; evidence highlighting is separate from React Flow's editable selection. Existing editor context previews retain their dimming behavior. Revealed payment cards and detail badges use the theme's green Approve, amber Review, and red Block palette; decision text remains visible, and unrevealed cards stay neutral. Playback now defaults to 1× per the user's preference, retaining optional 0.5×/2× speeds and the existing schedule.

The opacity change did not fix the user's movement-only blinking. A DOM mutation regression confirmed that moving a node during paused playback hid all 15 node wrappers and removed all 21 edge wrappers. Rebuilding controlled nodes without preserving their measured dimensions caused React Flow to clear its measurements and handle bounds, hide nodes, and unmount edges until asynchronous remeasurement. Graph now retains dimension changes from `onNodesChange` in local rendering state and supplies them back through `measured`; layout updates retain initialized geometry. Measurements stay outside scenario data and undo history. The regression checks visibility mutations, removals, retained DOM identities, and actual movement in paused/completed playback and both themes, including stopping while holding the mouse and then continuing.

Browser tests own fresh services on ports 8123/5184. Reusing an existing preview during verification initially reached the older API process; isolated ports prevent that ambiguity. Dockerfile and a production-only lock export prepare single-service deployment. Built UI/API serving is verified locally, but Docker is absent, so container build/run and public deployment remain unverified.

The user accepted Stage 1 and requested easier object/connection creation and CSV upload with automatic graph construction after core logic. The user subsequently authorized Stages 3–5 together and deferred manual review until afterward. Those stages are now implemented; the combined review is ready. Stage 6, including the requested subtle idle jelly animation, remains pending.

## Experimentation, construction and CSV import

Comparison reads only the previous and latest captured runs. It separates direct payment edits, referenced context, preceding in-window usage (including other accounts), labels, policy, costs, populations and model versions. Graph labels remain visible without hover in comparison; unrelated paths are muted only in this deliberate comparison view. Expandable details expose exact scores, rule explanations and both snapshots. No frontend scorer is introduced.

Local persistence uses one adapter and the versioned one-slot envelope. Save applies a valid active buffer and updates its baseline only after a successful write. Loaded candidates are validated independently; corrupt data, unsupported versions and storage errors preserve current state and existing bytes. Scenario replacement uses a native modal with Save and switch / Discard / Cancel. The graph is keyed by workspace session so loading even the same scenario restores its saved viewport. Runs stay in memory and clear only when replacement commits.

The approved construction flow extends the existing category palette. Drag/drop and click-to-place share the add command; keyboard users can place at the center. A nearby editor opens for the new object, and opening the palette clears the previous inspector to prevent interception of dragging. Click connection highlights compatible targets and opens the appropriate creation form, with the original keyboard form and selected-only handles retained. Duplication copies properties into a new identity with no connections or payments.

No representative user CSV was supplied. Use an explicit payment-per-row contract and a downloadable synthetic example, with mapping for alternate headers. Repeated category/source-ID pairs generate shared internal objects; display names do not define identity. Optional metadata must agree across reused objects. Missing baselines use editable, acknowledged assumptions; missing familiarity is unknown and missing truth remains unlabeled. Missing relationship observations use earliest usage per account/context pair. The preview validates all rows before any replacement. Category-column layout is deterministic and the initial viewport fits the available canvas within the established zoom limits. Import stays within 2 MB, 60 payments, 35 objects and existing relationship limits; larger datasets remain deferred.

Verification found and fixed an overlapping inspector during palette dragging, inaccessible nested definition-list markup, low-contrast attribution text, and comparison labels inheriting hover-only opacity. The sample CSV's expected final score was corrected against plan section 6.4: $180 / $40 = 4.5 times baseline yields 30 amount points, plus 20 unfamiliar-device points, totaling Review/50. Engine rules and existing independent fixtures were unchanged.

## Session workflow and common transaction exports (October 20, 2026)

The user's latest request supersedes the earlier Save/Load decision. The workspace now uses memory only; startup removes only the legacy RiskFlow draft key. No new user data is written to browser storage. Run comparisons remain useful within the session. Demo templates, blank/reset and policy editing move to a secondary Workspace menu; the primary header action is an anchored Import CSV dropdown. The Objects toggle under the brand exposes a colored drag/click palette, and all replay settings apply a 1.25 presentation multiplier.

Research used primary documentation from Xero (https://central.xero.com/0/article/Import-a-CSV-bank-statement) and Stripe (https://docs.stripe.com/reports/balance). These describe different shapes, not one universal bank-export standard. The importer supports their common signed-amount, date/payee, and itemized gross/currency/type patterns through header mapping, with separate debit/credit support, explicit slash-date order, decimal convention, and timezone offset. It never auto-selects net or fee as the purchase amount. Direction/type filters explicitly report excluded row counts. Limits stay at 60 source rows, 35 objects, and 2 MB.

Minimal statements lack the inputs needed for full-context risk scoring. The compatible contract extension adds optional per-payment unavailableRules, explicit returned rule availability, and nullable unavailable feature measurements. Missing device/location IDs produce per-account placeholders with no corresponding rule points or evidence. Missing baseline/category fields are unscored unless users explicitly opt into displayed assumptions. Any date-only payment disables time-window rules across that import so midnight placeholders cannot manufacture a burst. Complete fixture outputs retain their original scores. Partial results are identified in payment cards, explanations, results and replay status. Edits preserve import exclusions; enriched reimport restores eligibility.

Parsing validates UTF-8 or BOM-marked UTF-16, handles comma/semicolon/tab delimiters and quoting, and rejects binary/damaged bytes, inconsistent rows, duplicate headers/IDs, invalid dates/money/currencies, and conflicting metadata. No partial graph replaces the workspace. Generated unknown identities use a namespace that cannot collide with CSV source identities. Browser checks found a file-picker contrast defect and an exact-label test selector issue; both were corrected. Native input behavior remains accessible beneath the styled file surface.

## Integrated object tray and control simplification (October 20, 2026)

The user rejected boxed draggable tiles and native drag previews. The tray now renders the same ObjectGlyph component as canvas nodes and uses the existing 48-point elastic motion controller. A captured pointer moves the actual tray DOM object across the workspace, preserving its grip offset; there is no native drag image or duplicate source left behind. A valid canvas drop creates one undoable object, transfers the spring pose into the graph, and restores the source slot. Invalid destinations, pointer cancellation, blur, and Escape restore it without a graph mutation. Mouse, touch, click-to-place and keyboard center placement remain available. The tray stays open after a successful drop.

The connection dots and handle gestures were removed. React Flow retains hidden, non-interactive geometry anchors solely to render existing edges; no user-facing handles exist. Connection creation uses the selected object's Connect on canvas or Connect form. The Workspace and Check scenario buttons are removed; Simulate continues validating input. Templates, blank/reset and policy/cost editing are under the existing info panel's collapsed Scenario options section.

CSV import now has an opaque theme-specific surface and no opacity entrance animation. Its close mark is an SVG centered with grid layout, avoiding font-baseline misalignment. This slice changes frontend presentation and interaction only; engine scores and CSV interpretation are unchanged.
# Stage 6 local refinement and Stage 7 deployment (October 20, 2026)

The user requested a more visible tray, idle animation and completion of Stage 6, then explicitly moved public deployment to Stage 7 after final approval. The tray now has an opaque tint, full border and restrained shadow in both themes. Its hint uses the primary text color after Firefox's accessibility scan found a 4.43:1 contrast failure with the former muted color.

Idle motion modifies only the surface path, with two low-amplitude, independently phased waves added to the existing spring displacement. It preserves stable centers and labels, shares the controller with tray objects, and has an off switch in the existing information panel. Reduced motion and hidden pages stop it; no scenario or history writes occur. Browser regressions exercise disabling/resuming motion, hidden-page lifecycle, replenishment, dragging, reduced motion and unchanged graph geometry.

Production refinement adds gzip, immutable caching for hashed assets, revalidating HTML and body-free request timing logs. The complete Chrome suite and representative Firefox suites use the built frontend served by FastAPI directly. No development proxy is involved in this evidence. The engine contract and independently specified scores remain unchanged.

The final review retained the existing bounded commands, import boundaries and immutable runs. No new dependencies or domain abstractions were needed. Unused motion-controller methods were removed; Ruff's explicit first-party package makes root and backend checks consistent. The scan found no focused/skipped tests, explanatory handwritten source comments, TODOs or suppression directives in production source/tests. Existing boundary fault-sensitivity evidence remains applicable; no scorer changes were made.

Bundle splitting is deferred: the 553 kB single chunk remains approximately 169 kB gzip and the measured maximum-size interaction/API checks meet the local budget. The advisory stays visible rather than being suppressed. Docker verification, provider choice, CI deployment configuration, HTTPS/public clean-session verification and rollback rehearsal now belong to Stage 7. Human idle-intensity and first-use judgments are explicitly separate from automated results.

## Contact and pushing (October 20, 2026)

Dragging now separates contacting objects while keeping the held center attached to the pointer. Movement is subdivided into short world-space steps so a fast pointer movement cannot jump through another object. A deterministic outward contact solver propagates displacement through nearby objects, using conservative radii for rounded devices and a small surface clearance. Unrelated objects stay still. Contact pressure locally compresses the existing 48-point skin, which rebounds through its existing springs; there is no continuous force layout or scenario mutation from idle motion.

The complete drag layout is transient until release and becomes one undoable edit. Escape, lost capture and blur restore all displaced objects. Replay and comparison keep these positions in their local inspection layout without changing captured facts or the working document. Keyboard movement uses the same contact solver. New objects retain their drop point and move occupied neighbors aside in the same creation transaction. Reduced motion retains separation while disabling deformation.

Canvas pointer targets use the object hit circles rather than invisible 100-pixel wrappers. The lifted tray element is hidden briefly for drop hit-testing so its explicit hit circle cannot intercept the underlying canvas. The zero-size marker SVG is removed from normal flow to prevent a focus-induced canvas offset. Nearby creation panels remain above the bottom toolbar, keeping Undo accessible after a drop.


## 2026-10-20: Relationship-based hierarchical graph

The user authorized implementation after the concept preview, adding two requirements: preserve intermediate transaction connections and derive groups from real relationships rather than equal/random transaction chunks. The implementation uses deterministic average-link account communities, followed by merchant/category/device routes and time windows. Shared-device affinity is weighted more strongly than shared merchants, with popular features discounted. The supplied sample yields uneven first-level populations of 759, 403, 1,252, 223, 347, 83, 191, 135 and 41 payments. These are navigation communities, not risk classifications.

Solid mini-graph routes represent real payments; dashed cross-group lines represent shared objects. Transaction groups may contain repeated instances of the same entity ID, so cross-group edges must not falsely imply a payment between clusters. Only leaf objects (at most 30 payments) can be manipulated. Scroll/zoom does not change hierarchy. Breadcrumb navigation, payment selection, replay explanations and comparison selection use the same hierarchy. Full scenarios remain authoritative for editing, validation and scoring. Group layouts are presentation state and do not invalidate analytical results.

Raised the coordinated CSV/schema/client limits to 10,000 rows, 500 objects and 20,000 associations, with 5 MB CSV and 16 MiB API bodies. Added purchase/bill-payment types, explicit direction/status filtering, category normalization notes, and merchant-name-plus-country identity when no merchant ID is supplied. The user's synthetic CSV is a regression fixture; 3,434 of 3,870 rows are eligible. No user data is persisted by the application.

Replaced repeated full-history scans in the engine with sliding windows and exact counters. Limited displayed evidence IDs to 50 while retaining the full count and exact scoring. Indexed client validation and comparison lookups, paginated payment lists and condensed very large playback timelines to two minutes before speed scaling. Existing hero predictions and counterfactual behavior remain regression gates. Public hosting remains deferred to Stage 7.


## 2026-10-20: Continuous sector-map presentation

The user requested a spatially stable sector map, rounded borders shaped by their contents, smoother zoom transitions, and correctly aligned, visible connections. Replace the rectangular grid of independent ring diagrams with deterministic nested packing. This changes presentation only: the transaction-derived hierarchy, limits, leaf threshold, analytical history, and risk calculations retain their semantics.

Keep positions and scales shared between previews and expanded views, including cached leaf edits. Animate camera travel over 700 ms, with reduced-motion support. Reserve gaps between sectors and use screen-sized labels; show payment counts while keeping amounts in payment inspection. Boundaries use a padded, circle-biased envelope rather than a fixed oval. The current level alone gets subtle surface motion. Cross-sector shared-context links use the real sector centers and are masked by their opaque surfaces, eliminating the misplaced rectangular-handle endpoints. Screen stroke widths do not disappear at overview zoom.

The first rendering pass revealed a large-map regression from maintaining and repainting thousands of SVG elements. Batch deep previews into static category/route paths and separate their SVG surface from the animated boundary. Every underlying payment route remains represented; this optimization does not sample the analytical data. Explicit initial node dimensions also eliminate a one-frame coordinate jump when interactive detail first mounts.


## 2026-10-20: Lighter overview and jelly group borders

The user requested shorter dynamic names, greater spacing, distinct group colours, thin solid grey links, smoother squishy contours and less lag when navigating the overview. Increase root spacing, orient the packed layout along its principal horizontal axis, and use unique path-based group numbers until descriptive labels fit. Keep original names and grouping reasons accessible in tooltips and accessible names. Stable group colours are navigation aids, not risk categories.

Replace the irregular radial support envelope with a smooth near-circle adapted to the contents' orientation. Give only current-level boundaries two slow surface waves and damped directional pointer pressure, constrained by available padding. Preserve reduced-motion and animation preferences. Change shared-object connections to solid neutral grey, keeping their semantics explicit in the legend.

Stop previews at immediate child sectors and retain full real routes only in leaf previews. This supersedes the earlier all-descendant batched previews and removes their compositor caching workaround. All data and grouping remain authoritative; presentation detail alone is reduced. Skip layout rebuilding when leaving an unchanged leaf, and reuse newly computed layouts after actual edits instead of calculating them twice.


## 2026-10-20: Two-level previews and movable groups

The user requested one additional visible subgroup layer and whole-group movement like the final object view. Bound previews at two child-group levels; render their real shared-object links, keep deeper descendants omitted, and animate only the current level's borders. Leaf previews and the 30-payment interactive threshold retain their meaning.

Reuse the collision solver with variable circle radii and scale-aware sweep increments for groups. Move the entire nested preview and update connection endpoints in the same render. Keep group positions in session presentation state, propagate enclosing radius changes through ancestor transforms, and restore these positions after navigation and leaf layout rebuilding. Group movements do not alter payments, scores or object editing history. Cancellation restores every pushed group. Maintain pointer capture, suppress the click following a drag, and preserve boundary spring state across layout commits so release can settle naturally.


## 2026-10-20: Complete point-cloud previews and visible surface motion

The user found uneven preview depths, insufficient drag jiggle and overly colourful disks. The uneven appearance came from truncating previews before leaf contents on short branches. Preserve the transaction-derived hierarchy, but render all leaf object instances and account-to-merchant routes into cached canvas images for every visible non-leaf group. Include only two levels of quiet zone outlines in the same cached image, so camera travel does not repaint hundreds of static SVG paths. This restores full visual graph coverage without creating thousands of DOM nodes or animated objects. Cap images at 1024 pixels per side and defer resolution changes until zoom settles; redraw for geometry and theme changes.

Replace the small padding-damped drag signal with a coupled 48-point spring surface. Velocity and contact drive visible deformation independent of the idle padding limit, with bounded displacement and a decaying release. Only current-level borders animate. Reduce zone saturation and fills, remove nested solid disks, and tint the entered background subtly using the selected group's hue. Group identities, movement, real shared-object links, leaf editing and analytical results retain their semantics.


## 2026-10-20: Continuous fixed-sector point map

The user rejected nested bubbles and resolution changes that felt like a slideshow. The replacement retains transaction-derived partitions but allocates adjoining territories to all leaf point instances, colouring points by the active sector. A single screen-sized canvas keeps the full graph mounted during group navigation and redraws directly from camera coordinates. Thin grey divisions replace filled boundaries. Final detail retains interactive jelly objects at exactly matching positions.

The user explicitly removed sector dragging and squishiness from this design. Sector positions are fixed; dragging pans. The first rectangle-based footprint looked like a flag after bending. It now starts from an asymmetric polygon with the same total usable area. The abstract footprint is a visual choice, not a claimed geographic or analytical property. Public deployment remains Stage 7.


## 2026-10-20: Deliberate zoom navigates sector depth

At the user's request, zooming into a sector now opens it and zooming out sufficiently returns to its parent, including from final interactive detail. Small scrolls only magnify. Navigation requires multiple inputs, cumulative magnification change and separate spatial entry/exit thresholds. A settling delay and cooldown avoid oscillation and incidental wheel movement. The handoff preserves the camera instead of snapping to a fitted view. Clicks and breadcrumbs retain their explicit camera navigation; Fit does not alter hierarchy depth.


## 2026-10-20: Relationship-shaped atlas and inspectable sparse links

The user requested a natural graph footprint without an outer border, an earlier outward zoom handoff and connections that make the sectors read as one graph. Replace the prescribed polygon subdivision with deterministic relationship attraction and occupied-hull separation. Keep stable coordinates, fixed sectors, continuous canvas rendering and the unchanged transaction hierarchy. Draw only finite open separators between neighbours.

Show a bounded selection of strong shared-identity links at the overview, with larger budgets deeper in the hierarchy. Use subdued blue-grey through faint grey for relative strength and actual shared-object instances for endpoints. All links remain accessible in a collapsed Connections control. Inspection reveals shared identities, highlighted appearances and exact paginated payment evidence; it never labels a shared-object link as a transfer. Source payments and scoring are unchanged.

Reduce cumulative semantic zoom travel to 1.35-fold and exit at 92% of fitted zoom after 120 ms settling. Preserve the multiple-input guard. Catch up across ancestors after large outward gestures and ease context dimming as the camera pulls away. Public deployment remains Stage 7.


## 2026-10-21: Border-free map and restrained connection layers

Remove all visible sector separators at the user's request; colour carries the grouping. Add exactly one child level of bounded shared-object links as a faint canvas-only preview, without hover targets. Current-level connections retain evidence inspection. Separate their invisible hit areas from thin highlights and fade hover emphasis over 180 ms, with stronger keyboard focus and reduced-motion support.

Individual payment routes now appear only in the final interactive view. Cap links between final leaves to roughly one per child because repeated account identities otherwise produce a dense mesh immediately above detail. Retain all source rows, point instances, grouping, coordinates and inspection options; this is a display-only change. Public deployment remains Stage 7.


## 2026-10-21: Multi-review cleanup and current tradeoffs

Independent backend, frontend and test reviews plus a second graph review removed the obsolete bubble renderer, old group-motion/layout paths, their tests and unused atlas payment-route geometry. Build atlas layouts directly from leaf positions and relationship packing. Separate editable detail from atlas navigation, place atlas modules together, and separate editor inspection from record and connection forms. Remove authored explanatory code comments; retain generated contract/dependency provenance.

Fix independent rule-availability histories, accurate request-size errors, endpoint-aware saved-layout keys, order-insensitive comparison facts and pagination visibility. Reuse formatters and indexed comparison/deletion work, and stabilize memoized playback inputs. Test assertions now verify device-only affinity, actual source evidence, requested inspection and JavaScript motion, with guards against vacuous empty collections.

Choices retained pending product preference:

- **Saved objects outside their original sector:** retain fixed sector placement and original hit hulls. Expanding/repacking bounds would make distant edits easier to find but could shift neighbouring groups; clamping edits would prevent that movement. The current choice is reversible and should change if users regularly drag objects beyond their group. No claim is made that the original hit hull covers those edits.
- **Undo:** retain up to 20 complete document snapshots. Patch history would reduce memory for large imports but complicates undo correctness and migration. Revisit after measured memory pressure, before increasing capacity substantially.
- **CSV/layout execution:** retain synchronous work at the current tested limits. Workers provide cancellation and smoother import-time responsiveness at the cost of message passing and lifecycle complexity. Revisit with measured import/layout stalls or a higher capacity target.
- **Grouping heuristics:** retain device weight eight versus merchant weight one, common-identity discounting and existing group/leaf targets. There is no objectively best partition; change only with a preferred grouping emphasis or representative data evaluation. Colours and grouping remain navigation aids, not fraud conclusions.
- **Validation boundaries:** retain structured API validation, direct-engine validation and client runtime response checks. They serve different trust boundaries despite some duplicate work. A generated runtime schema could reduce maintenance, but replacing the current guards needs a separate contract migration and performance evidence.

The historical standalone prototype was removed during the 2026-10-21 codebase cleanup, together with its dedicated verification scripts. It had no production imports. Historical screenshots and reports remain as design evidence; the application owns the active motion implementation.


Review of test tradeoffs retained broad QA journeys where they cover different combinations of panel state, themes and accessibility despite overlapping individual actions. The frame-time bound remains a local regression threshold, not a guarantee for every device; unsupported long-task observation is no longer counted as a zero-duration success. Exact style assertions remain for explicit design regressions because replacing them wholesale with screenshot baselines has no clear reliability advantage.


The full cross-browser review exposed a native-touch test that uses Chromium CDP. Restrict this specific native gesture test to Chromium and explicitly skip it in Firefox; do not replace it with synthetic events and claim equivalent native-touch coverage. The remaining Firefox tray interactions are verified.

## 2026-10-23: Retain v13 after the failed chronological stacking experiment

V14 tested six frozen policies across 154,820 transactions and 256 frauds. None improved on accepted v13 or achieved 90% recall with 97% precision. Pooled v13 precision/recall were 96.50%/75.39%; the flat combiner achieved 91.58%/33.98%, the sequence combiner 95.48%/57.81%, and its stricter threshold 97.41%/44.14%. Additive sequence and chip policies found no supported calibration cutoff. Sequence features improved the new combiner, but it gained 11 detections while losing 56 detections made by v13.

Recent fitting windows contain no online-fraud examples. Splitting each fit window for chronological stacking also reduced base-model fitting history. These are limitations and hypotheses for the failure, not isolated causal conclusions. A future experiment should inspect more historical IBM fraud episodes and use multiple forward-only stacking blocks without weakening base fitting. Repeatedly exposed synthetic cohorts do not establish independent generalization. The accepted full latest v13 package retains 98.86% precision, 79.09% recall, 99.9537% accuracy and 87.88% F1.

The complete experiment, uncertainty, failed gates and verification remain in [the v14 findings](simulator-evaluation/ml-v14/report.md). The user subsequently authorized removal of unused experimental code and a structural project cleanup. Historical reports and model/data artifacts are evidence; obsolete source trees and historical runner commands are not maintained APIs. Current verification must replay accepted-model behavior rather than require every retired source file to exist. Personal plans and reminders are outside this cleanup.


### V13 runtime activation and legacy retirement

At the user's request, activated the accepted v13/depth6 bundle for new simulations and retained-history assessments. Removed deterministic point scoring and profile-score evaluation. Older saved results retain their original schema and interpretation. The package reproduces all component scores and decisions on the frozen 51,889-row latest benchmark (88 alerts); this checks integration, not new statistical performance.

Unsupported inputs receive an explicit error in the sandbox or remain unassessed in saved datasets. New results carry raw model margins, alert paths, history support and bundle identity; legacy point fields are null. Uploaded data has no confirmed delayed fraud-feedback source, so zero-support feedback is disclosed rather than borrowing labels from research. No automatic blocking or request-time calibration/training was added.

Removed 1,462 obsolete generated files, reclaiming 11,721,702,139 bytes. Original IBM sources and all files needed for complete accepted-model verification remain. Personal planning documents were not changed.
