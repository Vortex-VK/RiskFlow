# Acceptance status

Updated October 20, 2026.

## Current checkpoint: Stage 6 locally complete, visual review ready

The historical stage records below describe earlier checkpoints. This section supersedes their pending idle-animation and public-deployment notes.

- [x] Distinct opaque tray surface and readable hint in both themes; actual jelly pickup and replenishment retained.
- [x] Subtle, independently phased idle surface waves on graph and tray objects; stationary labels, icons, centers and connections. Idle animation makes no document/history changes.
- [x] Manual Animate objects preference, system reduced-motion handling, hidden-page suspension/resume and controller cleanup.
- [x] All 31 Chrome production journeys passed together. All 27 representative Firefox journeys passed across the initial and corrected final runs; mouse/touch tray transfer is separately covered in Chrome.
- [x] 99 Python checks and 65 frontend unit checks; typecheck, ESLint, formatting, Ruff, mypy, generated-contract consistency and production build passed.
- [x] Maximum 35-object/60-payment graph measured during dragging/panning; warm API requests remain under the 500 ms target on the recorded desktop. Raw browser evidence is in `performance-chromium.json` and `performance-firefox.json`.
- [x] Built UI/API verified together without Vite: startup, gzip, hashed-asset caching, HTML revalidation, invalid routes and actual engine results.
- [x] Local 77.12-second captioned walkthrough recorded and a comparison frame visually reviewed. Reproduction script and viewing instructions are included.
- [x] Final code/test/decision/naming review complete; evidence in `release-check-results.txt`.
- [ ] User review of the idle-motion intensity and final appearance; fresh-viewer 15/30-second usability observation remains a human check.

At the user's explicit request, **Stage 7 owns public deployment**, after final approval. Container build/run verification remains there because Docker is unavailable locally; hosting, CI deployment, HTTPS, public startup and rollback checks have not been performed. The app remains local.

## Stage 0

- [x] Reviewed plan v1.3 and the underlying product specification; no blocking domain contradiction found.
- [x] Rebuilt opening, H10 evidence, and before/after compositions in `preview/` around the user's minimal canvas direction.
- [x] Created four canonical scenario documents and independent expected outcome files: 38 payments total.
- [x] Recorded visual hierarchy, spacing, panel behavior, six-rule semantics, metric vocabulary, and material decisions.
- [x] Fixture integrity and expected aggregates pass `python scripts/verify_fixtures.py`.
- [x] Headless Chrome checks cover an unobstructed opening, selection-driven detail cards, collapsed properties/rules/metrics, connection inspection, H10 evidence, five changed decisions, Before/After, template loading, keyboard focus, zoom, and Fit.
- [x] All 44 browser assertions pass, including theme switching without losing selection or camera, the full-viewport graph at 1366 × 768, and page/control/card containment at a true 390 px viewport.
- [x] Object types have consistent distinct colors; shapes, names, and accessible labels remain available.
- [x] All 28 real-pointer Chrome checks pass: speed and grab-point response, diagonal deformation, turning, settling while held, straight attached edges, no rectangular focus/selection artifacts, visible keyboard focus, stable labels, release settling, click-versus-drag, cancellation, unchanged fixtures, and reduced motion. Local jelly checks verify non-elliptical deformation, area preservation within 2.5 percent during the sampled gesture, surface movement between pointer events, ripple settling, and exact rest-outline restoration.
- [x] Inspected actual mid-drag screenshot and dark desktop, evidence, and mobile screenshots.
- [x] User explicitly approved the stronger jelly motion; its parameters are unchanged.
- [x] User selected Original; removed Studio, Precision, the comparison page, and their dedicated artifacts.
- [x] Original dark mode uses the second preview's solid category fills and dark interior symbols while preserving light outside labels.
- [x] User reviewed the revised dark-mode fills and explicitly approved proceeding to logic implementation on October 20, 2026.

Browser output is recorded in `preview-check-results.txt` and `motion-check-results.txt`; screenshots are under `screenshots/`. These checks exercise prototype behavior only. Expected outcome display is not scoring verification.

## Stage 1 foundation

- [x] Project-local Node 24.22.0, Python 3.13.16, uv 0.13.4, locked dependencies, and strict TypeScript tooling.
- [x] Strict Pydantic scenario/document models: discriminated nodes, canonical UTC timestamps, integer cents, supported country codes, bounded collections, finite view coordinates, and required nullable fields.
- [x] Semantic validation for identifiers, typed references, relationship/payment timing, synthetic labels, policy thresholds, and incomplete drafts.
- [x] FastAPI health, four canonical templates, and validation endpoints; normalized errors and a counted 1 MiB body limit, including chunked requests.
- [x] Generated OpenAPI and TypeScript declarations compile successfully.
- [x] 73 backend tests pass without warnings; Ruff and strict mypy pass.
- [x] Live loopback HTTP checks pass for health, template catalog, exact hero fixture, and scenario validation; the owned server stops afterward.
- [x] Fault sensitivity: changing observation-time comparison from `>` to `>=` makes the exact-time regression test fail. Restored the original source and reran the suite.

The foundation work package is complete. Its contracts now support the editable workspace below.

## Stage 1 editable workspace

- [x] React 19.3.1, React Flow 12.12.0, Zustand 5.0.15, and Vite 8.3.4 with locked dependencies, strict TypeScript, CSS Modules, and shared theme tokens.
- [x] Actual Python template loading; owned working-copy IDs; explicit boundary decoders reject malformed data before store installation. Country enums and reserved-ID restrictions are now visible in generated contracts.
- [x] Approved category colors, solid dark fills, straight directional paths, stable labels, and the existing 48-point jelly model. A completed drag adds one history entry; Escape/cancellation restores its origin. Arrow keys provide movement without dragging.
- [x] Add by click or palette drag; typed handle connections and equivalent Connect forms; grouped payment edges retain independent events.
- [x] Buffered object, payment, and relationship forms with Apply/Cancel, exact decimal-to-cents parsing, UTC timestamps, label preservation/clearing, context preview highlighting, and reference/timing validation.
- [x] Dependency-safe atomic deletion removes related payments, labels, associations, and positions. Cascades require one count-based confirmation; undo restores the document. History retains twenty entries and keeps the current camera.
- [x] Blank Scenario checklist and atomic starter context reuse partial relationships and respect collection caps. Repeated complete-context insertion is disabled.
- [x] 30 frontend unit tests pass; ESLint, TypeScript, formatting, and the production build pass. Production JS is approximately 468 kB uncompressed / 145 kB gzip at this stage.
- [x] Seven real-Chrome, real-backend journeys pass: opening/theme/drag/history, payment validation, cascade deletion, blank construction with duplicate payments, mobile/reduced motion, valid/invalid handles and label choices, and accessibility scans in both themes.
- [x] Axe WCAG A/AA scans report zero violations in the tested opening and payment-form states. Fixed secondary-text contrast and handle semantics; this is not a claim of complete accessibility conformance.
- [x] Backend remains at 73 passing tests, Ruff/mypy pass, all 38 fixture payments reconcile.
- [x] Fault sensitivity: expanding the history cap to 21 causes the bounded-history regression test to fail. Restored the source and reran the tests.
- [x] One-command Windows launcher serves both endpoints; Ctrl+C closes both owned ports.
- [x] User tested the editor and reported that everything works. Easier construction and CSV import were requested as later stages after core logic.

Editor screenshots: `screenshots/editor-opening-1440.png`, `editor-drag-dark.png`, `editor-payment-1440.png`, and `editor-mobile-390.png`. The user has accepted this checkpoint.

## Stage 2 simulation and replay

- [x] Deterministic Python engine: chronological ASCII tie ordering, inclusive five-minute attempted-payment history, effective familiarity, six rule evaluations with positive/zero explanations, raw score/cap, and policy decisions.
- [x] All 38 independent expected fixture outcomes match. The actual H09 device experiment changes H09–H13 from Block to Review and labeled cost from $6 to $21. Corrected the Account Takeover GB node's country code; expected outcomes were not changed to fit the engine.
- [x] Truthful whole-run decisions, amounts, rational rates, score bins, trigger counts, partial/unlabeled coverage, pending-review fraud, null unavailable metrics, and aggregate half-up cost rounding.
- [x] Complete versioned simulation API, normalized snapshot, unique API run metadata, generated OpenAPI/TypeScript, semantic validation failures, and existing bounded request handling.
- [x] Runtime result decoding and reconciliation; immutable captured snapshots; latest two runs; pending-request cancellation on buffers, analytical edits, history navigation, and workspace replacement; malformed/late responses preserve prior results.
- [x] Replay starts unrevealed; Play/Pause, speed, stepping, Replay/Reset, event selection, real UTC timestamps, temporal context styles, revealed edge counts, and completed decision badges. Default speed is now 1× per user feedback (24.8-second hero); 2× remains available.
- [x] Captured business facts/results with a movable inspection layout: drag or arrow keys during/after playback, transient pan/zoom, and unchanged snapshot/history. Working draft positions are restored on Edit scenario. All six explanations, actual evidence highlighting, explicit Focus, revealed per-edge decision breakdowns, and separately labeled completed totals are available on demand.
- [x] 97 backend tests and 38 frontend unit tests pass. Ruff, mypy, TypeScript, ESLint, formatting, generated contract consistency, and production frontend build pass.
- [x] Fourteen real-Chrome journeys pass across editor and simulation, including real hero recomputation, immutable snapshot after undo, invalid-buffer prevention, stale requests, malformed score/metric/evidence/snapshot rejection, mobile/reduced motion, and sampled axe scans in both themes. The completion journey verifies whole-run counts, distinct H16/0 and H10/85 decisions, dragging during/after playback, attached edge movement, Escape/keyboard behavior, and restoration of draft positions without history changes.
- [x] User follow-up: connection handles appear only on selection with larger hit areas and body-drop targets. Hover/focus alone leaves handles hidden; invalid connection types remain rejected. Completed replay shows whole-run counts instead of leaving H16's individual badge as the apparent overall result.
- [x] Replay retains full opacity and uses outlines/strokes for context. The original opacity regression detected unrelated nodes at 0.28, but did not capture the user's movement-only blinking. Revealed payment cards use green/amber/red decision colors with labels; unrevealed cards remain neutral. Both payment-list themes pass sampled axe scans, and the initial 1× speed is checked in Chrome.
- [x] Movement-only blinking reproduced separately: all 15 nodes became hidden and all 21 connections were removed during dragging. Controlled nodes now retain measured dimensions and initialized handle geometry. The strengthened browser regression detects transient visibility changes and DOM removal, checks retained elements and actual movement, and covers paused/completed playback, both themes, and stopping/resuming movement with the mouse held.
- [x] Fault sensitivity: replacing the inclusive history comparison `>=` with `>` breaks the five-minute shared-device boundary regression. Restored source and reran the suite.
- [x] Single-service built UI/API smoke passes, including the actual hero simulation. Production-only dependencies are exported from the lockfile.
- [ ] Container image build/run verification: Dockerfile is prepared but Docker is not installed in this workspace.
- [ ] User hands-on acceptance of replay pacing, explanation clarity, evidence navigation, and visual density. The user has deferred the next full review until after Stage 5, combined with comparison, construction, and CSV import.

Current simulation screenshots: `screenshots/simulation-evidence-light.png`, `simulation-totals-dark.png`, and `simulation-mobile.png`. Check output is recorded in `simulation-check-results.txt`. Production JS is about 507 kB uncompressed / 154 kB gzip; Vite's 500 kB chunk advisory remains for release performance work. No response-time or complete accessibility-conformance claim is made.

## Remaining stages

- Stage 1: accepted by the user.
- Stage 2: manual replay/explanation review and container build verification remain.
- Stage 3: implemented and automatically verified; user review remains.
- Stage 4: implemented and automatically verified; user review remains.
- Stage 5: implemented and automatically verified; the combined manual checkpoint is ready.
- Stage 6: implementation and local checks complete; user motion-intensity/final visual review remains.
- Stage 7: final container verification and public deployment after user approval.

Engine correctness is now checked against independent fixtures and targeted boundaries. First-use goals, complete accessibility conformance, response-time targets, and deployment criteria remain open; the static visual prototype does not establish them.

## Stages 3–5 implementation evidence

- [x] Comparison uses immutable run pairs, matches payment IDs, distinguishes payment/context/history/label changes, separates additions/removals, labels population and coverage changes, and respects unavailable rate denominators and engine/rule versions. Changed paths carry visible deltas/counts; Before/After opens captured layouts and facts. The real hero experiment shows five Block → Review transitions, H10's history-only 85 → 60 change, and $6 → $21 illustrative labeled cost.
- [x] Policy/cost form validates thresholds, integer cents and loss basis points. Apply/Cancel, active-buffer Save/Simulate, undo and stale results use the existing command/state lifecycle.
- [x] One-slot local Save/Load validates the envelope and complete document before replacement, reports failed writes, preserves corrupt bytes, and keeps runs/history out of storage. Save and switch / Discard / Cancel protects unsaved replacements. Reload/load/simulate is tested with a constructed unlabeled scenario.
- [x] Palette supports actual native drag/drop, click-to-place and keyboard center placement. Newly added objects open nearby editors. Click connection highlights compatible types and opens the appropriate form; existing relationships open for editing. Duplication creates independent objects without relationships and remains undoable. Cancellation creates no history entry.
- [x] CSV parsing/mapping supports quoted fields, explicit baseline assumptions, UTC offsets, exact cents, shared source identities, unknown familiarity, and absent labels. Malformed rows, conflicts, duplicate payments, limits and invalid references reject the entire candidate. Preview and replacement cancellation preserve the working graph; imported graphs run the real engine. The example is packaged as a frontend asset for both development and production download.
- [x] 97 backend tests, 62 frontend tests and 21 real-Chrome journeys pass. The two import journeys also pass after the final download/layout/observation changes. TypeScript, ESLint, formatting and production build pass. Sampled accessibility scans cover comparison in both themes and CSV preview. Existing graph-blinking, replay, mobile and reduced-motion checks remain passing.
- [ ] User review of comparison clarity, construction ergonomics, imported layout and representative personal CSV data. No user dataset has been supplied; the bundled example defines the supported format.

The combined checklist and CSV contract are in README. New screenshots: `comparison-implemented.png`, `csv-preview.png`, and `csv-imported-graph.png`. Stage 6 and idle motion remain unimplemented. Production bundle size is approximately 543 kB / 165 kB gzip; the existing Vite chunk advisory remains for release performance work.

## Changed-slice review

Handwritten preview and verification code contains no explanatory source comments, disabled tests, TODOs, or placeholder application controls. Scenario facts are owned by JSON fixtures; the browser bundle is generated. Selection, panels, camera, and transient layout offsets are local state. One on-demand spring frame loop stops at rest and is cancelled on visibility changes, reduced-motion changes, or page exit. Pointer capture ends on pointer-up/cancellation; a cancelled drag restores its origin. Browser verification closes its owned servers/browser profiles after checks.

Gesture verification uses actual Chrome mouse input with the held button specified, rather than synthetic click handlers. Assertions compare pointer travel, edge geometry, label dimensions, settled shape/position, and serialized fixture equality. The preview-layout changes are not production document editing and do not claim completed undo or persistence.

The fixture assertions fail on broken references, future context, incorrect label coverage, score caps, decision thresholds, or inconsistent aggregate expectations. Browser assertions check specific visible values and counts, the absence of initial scores, and the exclusion of future evidence. Production fault-sensitivity tests remain part of their respective implementation slices.

## Session workflow and flexible CSV review

The latest request is implemented: header-anchored CSV import, matching file picker, an Objects drawer beneath the brand, dataset-scaled presentation with a 0.1x/0.25x/0.5x/1x/2x/5x/10x slider, and no browser draft persistence. The old app-specific draft slot is removed while unrelated storage is preserved. Save/Load acceptance criteria from the earlier stage record are superseded.

Validation covers signed bank statements, debit/credit layouts, processor gross/currency/type exports, mapped dates and timezone choices, decimal conventions, UTF-8/UTF-16, malformed files, incomplete inputs, and replacement cancellation. Missing inputs never create rule evidence: limited results show unavailable rules as N/A. The sample graph still produces CSV03 Review/50. The 38 independent template expectations retain their scores, and paused/completed dragging keeps existing DOM nodes and edges mounted.

The latest manual check is in README. Review the left drawer, anchored CSV dropdown and first-file picker on desktop and mobile; upload a real USD statement and verify its mappings, excluded row count and missing-data notes. The actual API must be restarted for the contract extension. Stage 6 idle animation and release/performance work remain deferred.

## Integrated object tray review

The boxed native-drag palette is superseded by a miniature canvas using the graph's shared glyphs and spring animation. The actual tray object follows the grip, lands at the release position, and transfers its deformation to the new graph object while its tray slot replenishes. Cancelled or off-canvas drops restore the source without adding history. Keyboard and click placement remain available.

Connection dots, Workspace and Check scenario controls are removed. Connect on canvas and relationship forms remain available; simulation performs validation. Secondary scenario options are under the existing information panel. CSV import now uses an opaque surface and geometrically centered SVG close icon in both themes.

All 65 frontend unit checks and 29 browser journeys pass across the affected suites and focused reruns. TypeScript, lint, formatting and production build pass. Evidence and exact coverage are recorded in `tray-check-results.txt`. Refresh for the manual pickup/drop and visual review; no backend restart is needed for this slice. Stage 6 idle animation remains deferred.

## Collision pushing review

- [x] Dragged objects push contacting neighbors and propagate through clusters. Contact compresses and releases the existing jelly skin; the held object stays attached to its grip. Fast moves are swept through intermediate positions, including a unit regression for crossing an entire row in one movement.
- [x] Invisible square wrappers no longer intercept pointer hits. Keyboard movement and new-object drops use the same separation solver; drops preserve the new object's exact position. Reduced motion keeps objects separated without animating their surfaces.
- [x] A complete push is one undo/redo transaction. Escape and lost capture restore all affected positions. Running, paused and completed replay layouts remain local to inspection; returning to the editor restores its original layout without a new history entry.
- [x] Four collision unit cases include a chain, a fast crossing, unrelated overlaps, and a fully stacked 35-object layout with rounded devices. All 71 frontend unit checks pass; TypeScript, ESLint, formatting and production build pass.
- [x] Full Chrome production suite: 50 passed, including five new collision journeys. The existing 35-object/60-payment performance check records an 8.4 ms p95 frame interval and no long tasks locally. Backend facts, scores and contracts were not changed.
- [x] Firefox: all eight collision and mouse-tray checks pass. Its SVG hit testing required removing the lifted tray wrapper from layout during the synchronous drop-target check; visibility alone was insufficient. Pointer assertions allow less than one screen pixel of browser rounding while retaining exact world-space solver checks.
- [ ] User review of the contact feel: refresh, push an object slowly into another, then sweep through a small cluster. Check that the compression/rebound feels appropriate and that neighbors remain easy to pick up. No backend restart is needed.

Evidence: `frontend/tests/collisions.spec.ts`, `frontend/src/features/graph/collisions.test.ts`, `screenshots/collision-push.png`, and `performance-chromium.json`. Implementation choices are recorded in `decisions.md`.


## Hierarchical transaction exploration ? 2026-10-20

- [x] Raised coordinated import/model/client limits to 10,000 rows/payments, 500 objects, 20,000 associations and 5 MB CSV. The API request boundary is 16 MiB; simulation requests have a 30-second client deadline.
- [x] The supplied synthetic 3,870-row statement imports 3,434 payment attempts and reports 436 excluded rows, category normalization and unavailable-rule notes. Pending/declined attempts do not become inferred fraud labels.
- [x] Account groups follow actual shared-device/merchant activity, with uneven sizes. Deeper views use real merchant/category/device routes and chronological windows. Every eligible payment occurs in exactly one leaf, each with at most 30 payments. Source order reversal produces the same hierarchy; input facts remain unchanged.
- [x] Solid transaction routes remain visible through intermediate views. Dashed cross-group links identify shared entities. Group boundaries animate; their internal marks remain static. Individual editing/dragging is available at final detail. Scroll/+ magnifies without subdividing a leaf.
- [x] Browser journeys cover descent, parent/root navigation, preserved moved layouts on reentry, drag/undo, leaf zoom, light/dark appearance, accessible overview, searchable results, direct navigation to the final payment, and full-scenario simulation.
- [x] Python: 100 tests pass, including 10,000 simultaneous attempts with exact full-window counts and bounded evidence lists. Ruff and mypy pass. Frontend: 75 unit checks, TypeScript build, ESLint and formatting pass.
- [x] Chromium: all 52 browser journeys verified. The first complete run passed 51 and exposed inconsistent wording for a correctly rejected malformed response. After correcting that guard, all 10 affected simulation/hierarchy journeys passed; the final expanded hierarchy checks also pass (2/2).
- [x] Firefox: 7/7 hierarchy and CSV journeys pass, including 10,000-payment simulation, layout persistence, fixed leaf depth, existing import error handling and mobile import controls.
- [x] The 10,000-payment / 500-object case renders at most twelve animated cluster boundaries in its overview. Latest local measurements: overview frame p95 4.3 ms in Chromium / 4.18 ms in Firefox; Simulate-to-replay readiness 4.62 s / 7.96 s. These are local measurements of the recorded fixture, not guarantees for every machine or transaction distribution.
- [ ] User visual review: restart the local launcher (backend limits changed), import the supplied CSV, explore groups and connections, rearrange a final group, and inspect a payment after simulation.

Evidence: `frontend/tests/hierarchy.spec.ts`, `frontend/src/domain/hierarchy.test.ts`, `backend/tests/test_engine.py`, and `screenshots/hierarchy-{overview,middle,detail,dark}.png`. Machine-readable measurements are `screenshots/hierarchy-performance-{chromium,firefox}.json`. The production bundle is 571.34 kB / 174.65 kB gzip; Vite's existing 500 kB advisory remains. Public deployment remains Stage 7.


## Continuous sector map - 2026-10-20

- [x] Replaced ring diagrams and the rectangular card grid with deterministic nested sector packing. Detail objects have consistent minimum spacing; sectors have explicit gaps and rounded, content-shaped outlines. Presentation does not repartition transactions or change scores.
- [x] Previews and expanded views use the same positions and composed scales. Camera travel lasts 700 ms, respects reduced motion, and keeps individual interaction at the existing final level. Saved leaf edits update previews and remain available on reentry.
- [x] Inter-sector connectors use actual sector centers behind opaque contours, with visible screen stroke widths. Solid routes remain real account-to-merchant payments; dashed links retain shared-object semantics. Labels use screen-sized type, and the key sits beside the breadcrumbs. Playback fitting reserves space for the status and controls.
- [x] First-frame dimensions and explicit node origins prevent mount-time displacement. A single hierarchy controller owns camera initialization; removing competing late initialization prevents return navigation from resetting its final zoom.
- [x] Batched static route/category paths keep every leaf route represented with bounded DOM overhead. Separate SVG surfaces isolate animated outlines. Static preview layers are cached only after the camera rests for 180 ms; caching is disabled during navigation and manual pan/zoom, avoiding Chrome clipping while retaining smooth idle borders.
- [x] Frontend: 79 unit checks, TypeScript production build, ESLint, and formatting pass. Geometry checks cover gaps, rounded adaptive bounds, deterministic layouts, true relationships, composed positions, batched route coverage, and saved edits beyond original bounds.
- [x] Chromium: the complete 53-journey suite passed. Subsequent focused checks passed for the final node-origin/camera corrections, including the eight hierarchy/navigation/collision journeys and the strengthened tests for first-frame continuity in both directions and final camera bounds. The final static-preview cache change passed all three hierarchy/navigation journeys with screenshots reviewed.
- [x] Firefox: all three hierarchy/navigation journeys pass, including 10,000 payments and 500 objects. The strengthened final camera-bound and bidirectional continuity checks also pass in both affected journeys. All three final hierarchy/navigation journeys passed again, including cache restoration after camera motion and access to the Objects menu.
- [ ] User review: refresh the frontend, import the same CSV, enter and leave sectors, compare link visibility in both themes, and move objects at final detail. This change needs no backend restart.

Evidence: `frontend/src/features/graph/sector-layout.test.ts`, `frontend/tests/sector-navigation.spec.ts`, `frontend/tests/hierarchy.spec.ts`, and updated `screenshots/hierarchy-{overview,middle,detail,dark}.png`. Local 10,000-payment performance is recorded in `screenshots/hierarchy-performance-{chromium,firefox}.json`; these measurements are machine-specific. Production JavaScript is 579 kB / 177 kB gzip, with the existing Vite size advisory. Public deployment remains Stage 7.


## Overview clarity and jelly borders - 2026-10-20

- [x] Short unique group numbers expand to descriptive names when screen space allows. Full names and grouping reasons remain accessible. Larger root gaps and horizontal principal-axis orientation reduce crowding. The sample overview has nine distinct colours and non-overlapping captions.
- [x] Group links are solid neutral grey with 0.65-1 px screen widths, anchored at true sector centers. The legend identifies them as shared-object connections. Colours identify navigation groups, not risk.
- [x] Smooth near-circular, 48-point contours follow two slow surface waves and damped directional pointer pressure. Padding constrains deformation to enclose the contents. Only current-level borders animate; animation and reduced-motion preferences remain respected.
- [x] Internal previews show immediate groups and real shared-context links; leaf previews retain actual payment routes and object positions. No analytical data or hierarchy partitions are sampled. Removed the all-descendant SVG geometry and its compositor workaround.
- [x] Unchanged leaf navigation reuses geometry; edited layouts are computed once. The 10,000-payment / 500-object overview draws 68 preview shapes. Recorded idle and zoom-round-trip frame intervals in both browsers; local measurements are not device-independent guarantees.
- [x] 80 unit tests, production build, ESLint and formatting pass. Three focused browser journeys pass in both Chrome and Firefox, covering CSV import, full simulation, accessible overview, both themes, saved edits, camera alignment in both directions, reduced motion and large-data navigation.
- [ ] User review: refresh, import the same CSV, zoom through groups and back, and judge the new spacing, colours and border motion.

Evidence: updated hierarchy screenshots and performance JSON in `docs/screenshots`, `frontend/tests/hierarchy.spec.ts`, `frontend/tests/sector-navigation.spec.ts`, and `frontend/src/features/graph/sector-layout.test.ts`. Public deployment remains deferred to Stage 7.


## Extra preview depth and whole-group dragging - 2026-10-20

- [x] Render exactly one additional subgroup level, including its real shared-context links. Nested preview contours stay static and cannot be manipulated separately from their current-level group. Leaf previews and payment grouping retain their existing behavior.
- [x] Drag whole groups with live connection endpoints, directional border strain and collision pushing. Contents remain mounted and move as a unit. A four-pixel threshold and persistent click suppression prevent drops from opening groups.
- [x] Preserve group centers and enclosing transforms through entry/return navigation and leaf layout rebuilding. Movement changes session presentation only, including during running, paused and completed playback. Group moves are separate from object editing history and document exports.
- [x] Escape, lost pointer capture, pointer cancellation, blur and hidden-page handling cancel a drag and restore every displaced group. Reduced-motion users can still drag groups.
- [x] Production build, ESLint, formatting and 82 unit tests pass. Existing five Chromium object-collision journeys pass after extracting the variable-radius solver. Final six group/hierarchy/navigation journeys pass in both Chromium and Firefox, including the 10,000-payment / 500-object case.
- [ ] User review: refresh and import the sample, compare the extra preview layer, drag groups into one another, and enter/leave a moved group.

Evidence: `frontend/tests/group-drag.spec.ts`, updated hierarchy and navigation tests, geometry/collision unit tests, `screenshots/group-drag.png`, hierarchy screenshots and performance JSON. The 10,000-payment overview renders 618 preview shapes with the extra level; final local Chromium zoom p95 is 12.5 ms and maximum frame interval is 29.2 ms. These are local measurements, not general device guarantees. Public deployment remains Stage 7.


## Complete graph previews and stronger group jelly - 2026-10-20

- [x] Every non-leaf preview includes all underlying leaf object instances and actual payment routes, regardless of uneven hierarchy depth. Two levels of quiet zone outlines and shared-context links are included in the same cached canvas. Direct leaf previews retain precise SVG geometry for navigation alignment.
- [x] Replaced strong nested coloured fills with faint outlines, near-neutral outer fills and a subtle entered-zone background tint. The root returns to its neutral background. Colours remain navigational, not risk indicators.
- [x] Group borders use a coupled 48-point spring surface driven by pointer velocity/direction and collision pressure. Drag deformation is independently bounded and visibly exceeds the idle wave; release settles naturally. Reduced motion still disables animation without blocking group movement.
- [x] The 10,000-payment / 500-object fixture represents 11,124 descendant object instances in cached clouds while retaining only 10 SVG preview shapes. Canvas resolution is capped at 1024 pixels per side and updated after zoom settles. The final local Chrome zoom p95 is 8.4 ms, maximum interval 33.3 ms; results depend on the machine and browser.
- [x] Build, ESLint, formatting and 84 unit tests pass. Eight focused journeys pass in both Chrome and Firefox, including the screenshot's mixed-depth pattern, actual canvas pixel coverage, unchanged cached image contents while dragging, measurable border strain, reduced motion, playback, navigation and large-data simulation.
- [ ] User review: refresh, inspect the mixed-depth dark view, drag and release group borders, and assess the restrained zone styling and point clouds.

Evidence: `frontend/src/features/graph/sector-cloud.ts`, `SectorCloud.tsx`, `sector-motion.ts`, expanded geometry and browser tests, `docs/screenshots/hierarchy-mixed-depth-dark.png`, overview/middle/detail/dark screenshots and browser performance JSON. Public deployment remains Stage 7.


## Continuous fixed-sector map and deliberate zoom navigation - 2026-10-20

- [x] Replace filled bubbles with all underlying leaf point instances, coloured by active sector, and real payment routes. Thin grey curves separate adjoining territories. The asymmetric footprint replaces the initial rectangular flag-like outline while preserving usable area.
- [x] Keep one screen-sized canvas mounted across group navigation. Points retain their positions, neighbouring points remain subdued context, and final jelly objects resolve at exactly matching coordinates. Sector dragging and squishiness are removed at the user's explicit request; dragging pans.
- [x] Small wheel inputs and +/- presses only magnify. Multiple deliberate inputs, accumulated zoom travel and separate entry/exit thresholds enter the focal sector or return to its parent. Final detail can zoom out to its parent. Automatic handoffs preserve the current camera; Fit and panning never navigate.
- [x] 91 unit tests, production build, ESLint and formatting pass. Eight browser journeys pass in Chrome and Firefox across import, full simulation, exact camera/object alignment, accessibility, keyboard/mouse input, both themes, reduced motion and intentional zoom navigation. An earlier Firefox run hit a browser-context teardown error; the complete final rerun passes.
- [x] The 10,000-payment / 500-object fixture keeps every leaf instance in one canvas and runs the full simulation. Final measured zoom-round-trip frame p95 is 16.7 ms in Chrome and 20.84 ms in Firefox on this machine; these are local measurements rather than device-independent guarantees.
- [ ] User review: refresh, inspect the irregular footprint, scroll into a sector, and scroll out of final detail. Small scrolls should stay at the current hierarchy level.

Evidence: `frontend/tests/hierarchy.spec.ts`, `sector-navigation.spec.ts`, `sector-interaction.spec.ts`, `semantic-zoom.spec.ts`, atlas/semantic-zoom unit tests, `docs/screenshots/atlas-*.png` and `atlas-*-performance-*.json`. Public deployment remains Stage 7.


## Natural footprint and selective source-evidence links - 2026-10-20

- [x] Derive sector placement from shared relationships and occupied hulls, retaining stable point coordinates and removing all visible outer contours. Open grey separators distinguish neighbouring groups.
- [x] Bound visible shared-identity links by hierarchy depth, with stronger blue-grey links and weaker slate/grey links. All current-level links remain inspectable through Connections; selection highlights actual shared-object appearances and exposes paginated source payment IDs, amounts and UTC timestamps.
- [x] Independently reconcile all 3,434 included sample CSV payments against raw source IDs, amounts, times, accounts, merchants and available devices; verify unique leaf membership and real shared-object endpoints. Included sample types are debit purchases and bill payments, including pending/declined attempts under the existing import semantics.
- [x] Reduce outward zoom travel and fitted threshold, catch up across ancestors after large outward gestures, and ease background dimming. Single-scroll, final-detail exit, Fit exclusion and camera alignment checks pass.
- [x] 93 unit tests, production build, lint and formatting pass. Nine focused browser journeys pass in Chrome and Firefox, including connection evidence, keyboard/accessibility, both themes, reduced motion, full simulation and the 10,000-payment / 500-object case. The Chrome evidence test initially used an incorrect label locator; its corrected accessible-role locator passes.
- [ ] User review: refresh, import the sample, compare the natural outline, inspect Connections, and assess subtle link visibility and outward zoom sensitivity.

Evidence: atlas layout/topology unit tests, `frontend/tests/connection-evidence.spec.ts`, the hierarchy/navigation/interaction/semantic-zoom suites and `docs/screenshots/atlas-connection-evidence.png`. Graph layout and link strength do not indicate risk. Public deployment remains Stage 7.


## Border-free connection layers - 2026-10-21

- [x] Remove visible internal dividers; colour alone identifies sectors. Retain invisible hit geometry and stable map coordinates.
- [x] Preview exactly one immediate child level of bounded shared-object links, below the opacity of current-level connections and without extra interaction targets. Unit checks verify preview depth and endpoints against actual shared-object appearances.
- [x] Use a thin fading hover accent independent of the wider invisible hit target. Keyboard focus stays clearer, reduced motion disables the fade, and source-evidence inspection remains accessible.
- [x] Draw individual payment routes only in final detail. Limit the last overview's shared-object links to at most one per child; all links remain available through Connections. Browser checks verify the sparse final overview and that payment connections still appear after entry.
- [x] 94 unit tests, production build, lint and formatting pass. Six focused browser journeys pass in Chrome and Firefox, covering real hover, source-row inspection, both themes, exact map/detail alignment, accessibility, reduced motion and 10,000-payment simulation. Updated screenshots include `atlas-before-detail.png` and `atlas-dark.png`.
- [ ] User review: refresh, compare the border-free map and faint child connections, hover across links, and inspect the level immediately before interactive detail.

No source data, grouping, risk calculations or deployment scope changed. Public deployment remains Stage 7.


## Multi-review cleanup - 2026-10-21

- [x] Independent backend, frontend and test reviews, followed by a second graph review. Clear findings fixed; alternatives without a clear winner recorded in `docs/decisions.md`.
- [x] Remove authored code comments, dead bubble renderer/group motion, obsolete layout paths, unused route geometry and unused client validation APIs. Preserve generated contracts and dependency provenance. Static import reachability finds no orphan production source modules; case-sensitive import audit finds no filename mismatches.
- [x] Separate `graph/DetailGraph.tsx` from `graph/atlas/AtlasGraph.tsx`, co-locate atlas layout/packing/connections/rendering, and split editor inspector/record/connection forms. README provides a code map. No legacy re-export aliases remain for moved modules.
- [x] Correct independent velocity/shared-device history availability, the request-size error text, endpoint-aware saved-layout keys, order-insensitive comparison facts and pagination behaviour. Reduce repeated comparison/deletion work, formatter creation and playback allocations.
- [x] Remove obsolete bubble tests; strengthen device-only affinity, unavailable-data exclusions, source-row inspection, nonempty geometry checks and actual JavaScript reduced-motion checks. Four targeted mutations fail for the intended reasons, with source restored afterward.
- [x] 87 frontend unit tests and 102 backend tests pass. Production build, frontend lint/format, backend Ruff checks and mypy pass. The frontend count fell from 94 because obsolete tests were removed while meaningful regressions were added.
- [x] All 59 Chrome browser journeys pass. Firefox passes the other 58 journeys; its complete run exposed a Chromium-only native-touch CDP test. That test now explicitly skips Firefox, and the focused tray rerun passes three tests with that one documented skip. Native touch dragging remains verified in Chrome, not Firefox.

Known retained limitation: a leaf object dragged far outside its original sector does not expand the original sector hit hull. Stable spacing versus expanding/repacking or clamping movement remains a product decision. Full-snapshot undo, synchronous CSV/layout work, grouping weights and validation boundaries remain documented tradeoffs. No public deployment performed.

CSV import opens Columns & format collapsed after file selection. Preview is available as soon as parsing finishes, without an acknowledgment checkbox; Cancel import is removed and the header close control remains available. Editing mapping or assumptions still invalidates the old preview and requires a new preview before building. Risk scoring is unchanged.
