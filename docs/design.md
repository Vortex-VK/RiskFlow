# Stage 0 visual direction

Status: Original, its revised solid dark-mode fills, and the jelly motion are approved. The user authorized logic implementation on October 20, 2026.

## Selected appearance

This document records the historical prototype design. The standalone prototype has been removed; inspect the application for current behavior and `docs/screenshots/` for historical compositions. Retain Original's canvas, typography, controls, category colors, and motion. Dark-mode objects borrow the solid fills and dark interior symbols from the second preview: blue accounts `#7D9BB2`, amber merchants `#C9AA70`, violet devices `#A89DBB`, and teal locations `#8EAF96`. Outside labels retain light colors so they remain readable on the dark canvas. The light theme is unchanged.

The two alternative previews, appearance switcher, and their verification artifacts have been removed at the user's request. Application logic was subsequently implemented; this historical approval checkpoint is complete.

## Composition

The user's reference is an open, direct canvas like Agar.io, with a professional graph-tool presentation. The network now occupies the entire viewport. Compact controls float at the edges; there is no fixed sidebar, large heading, default inspector, or always-visible event strip.

The opening view contains the graph, a scenario selector, Payments, theme and help buttons, a compact view switch, and camera controls. The sun/moon toggle sits beside help and preserves the current view. A short hint invites selection. The preview label is quiet but persistent; expected values are identified when they appear.

The scenario menu, payment tray, help, and selection card open on request. Only one secondary panel is open at a time. Properties, related payments, rule breakdowns, and comparison metrics live in native expandable sections. Close, Escape, or a click on the empty canvas restores the clear view.

At laptop widths the network is fully visible. On narrow screens the starting camera is closer to the account cluster; panning reveals surrounding nodes and Fit shows the entire network. Cards are bounded to the viewport and scroll internally. Selecting an object never jumps the camera.

## Visual language

- Canvas `#F7F9F8`, floating surfaces white, selected controls `#EDF4EF`.
- Dark canvas `#111920`, floating surfaces `#1B2630`, text `#E1E8EE`. Category hues remain consistent with solid midtone fills, dark interior symbols, and light outside labels. Light is the initial theme; the toggle applies for the current page session.
- Primary text `#253B3C`, secondary `#6B7C7C`, restrained green accent `#28786D`.
- Object colors: blue accounts (`#DEEBFB` fill), amber merchants (`#FFF0CC`), violet devices (`#ECE2FA`), and teal locations (`#DEF2EB`). Every instance of a type keeps the same palette, including the shared device. Color denotes type, not risk. The help panel contains a compact key; icons, names, and accessible type labels remain available.
- Approve `#28786D`, Review `#936525`, Block `#B45551`; decisions also have explicit words and symbols.
- Local Segoe UI / system sans-serif; no remote fonts, raster images, or asset requests.
- Accounts are compact circles with initials. Merchants have simple storefront icons; devices use rounded squares and phone icons; locations use small rings. Names sit outside the shapes; type information and properties are available through inspection and accessible labels.
- Persistent context uses dashed straight lines. Grouped payments use thin directional straight lines with no default count badges. Connections update during dragging; they do not route around obstacles. Counts and individual events appear through connection inspection. Evidence and changed paths receive restrained emphasis.

Both palettes and the organic arrangement remain subject to visual review. Production typography, contrast, and mobile editing remain acceptance work; these screenshots are not an accessibility conformance audit.

## Three review states

### Opening

Show the complete fixture without precomputed decisions or explanatory panels. Arrange the three accounts around their shared device, with merchants and supporting context spread around them. Selecting a node reveals its information; selecting a payment path reveals the underlying events.

### Investigation

The H10 view highlights the shared device and A/B/C relationships, contributing historical merchant paths, and H10's payment path. Supporting context dims without disappearing. A compact card shows amount, time, and expected score 85. Expanding **Why this score?** reveals the arithmetic and H07–H10 evidence within 09:58–10:03 UTC.

The Payments tray stays closed until requested. No motion or counters imply an engine has executed.

### Comparison

Show the H09 device edit and five changed payment decisions. Before/After changes the visible fixture snapshot and expected totals. The existing C-to-shared-device relationship remains drawn: it is no longer evidence of current payment usage. H09 loses 45 points; the other four events lose 25.

The comparison card initially shows only the edit, Before/After, and five changed decisions. Expand the event list to distinguish edited facts from changed history. Expand Expected impact to see blocked synthetic fraud change from $840 to $0, pending fraud from $360 to $1,200, and illustrative cost from $6 to $21. These are scenario consequences, not a demonstrated policy improvement.

## Interaction and motion

The prototype supports view switching, scenario menus, node/connection/relationship selection, payment inspection, Before/After, disclosure controls, object dragging, background drag-to-pan, wheel/button zoom, and Fit. Keyboard selection enters the card; Escape returns focus to the selected node or cancels an active drag. There is no scenario-fact editing or simulation yet.

Nodes gently expand on hover. Continuous drag velocity drives directional stretch and trailing displacement through damped springs; the grab point anchors deformation, so dragging near an edge feels different from dragging the center. Diagonal movements and turns rotate the stretch continuously. Holding still lets the shape settle. Release retains accumulated spring motion without adding a canned kick. Names remain steady outside the deforming body. Edges follow dragged node centers without rebuilding the graph. Nodes stay at the drop location; the network does not drift or bounce continuously.

Each body also has 48 coupled spring points around its outline, joined with smooth cubic curves. Local pulling and acceleration deform different parts of the surface independently; neighboring points transmit motion around the edge. Area normalization keeps the body from visibly inflating or deflating. Circular and rounded-square silhouettes return to their exact rest paths after settling. This is a bounded visual soft-body approximation, not a material-accurate physics simulation.

The latest motion tuning increases local pull threefold, lowers the speed needed for full response, and reduces surface damping from 9 to 6. Weaker neighbor coupling allows more visible local bulges. Surface displacement remains bounded, and ripples have a longer settling tail after turning or releasing.

Pointer dragging suppresses native text selection and drag images. SVG groups have no rectangular focus outline; keyboard focus appears as a dashed outline on the node body or connection.

The motion controller uses a bounded spring step and a single on-demand animation frame loop. It stops at rest and cancels on page exit, visibility loss, or a reduced-motion change. Reduced motion removes deformation and panel animations while preserving direct dragging and inspection.

Layout changes are local to the current preview session and clear when switching scenarios or reloading. They never mutate canonical fixtures or scoring facts. Production document history and persistence remain Stage 1/3 work.

The production simulation still uses a separate replay clock for directional payment pulses. Object feedback is interaction feedback, not a simulated risk result. Camera movement occurs only when requested.

## Approval question

Review the open canvas, compact node hierarchy, gesture response, both themes, progressive disclosure, and opening → evidence → comparison flow before the React Flow implementation.
