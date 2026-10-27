# RiskFlow local walkthrough

> Historical recording script for the retired rule-based interface. The recording automation was removed during the October 2026 cleanup; the sequence below does not describe the current app.

`demo/riskflow-demo.webm` is a captioned, silent recording of the actual local production app using synthetic fixtures. It is approximately 76 seconds, 1366 × 768. Captions are recording-only overlays; the app does not show them normally.

| Time | Action and claim |
| --- | --- |
| 0–10 s | Introduce the rules-based simulator; open the tinted object tray and show idle jelly motion. Mention session-only construction and CSV import. |
| 10–24 s | Simulate the shared-device cluster at 2×. Three accounts use one device; scoring uses chronological history. |
| 24–38 s | Inspect H10, Block/85. Expand shared-device evidence and highlight its actual contributors. |
| 38–48 s | Edit H09 to Casey's familiar phone, retaining its synthetic fraud label. |
| 48–64 s | Simulate again and compare. Five blocks become reviews; H10 becomes 60 because its earlier history changed. |
| 64–76 s | Explain the illustrative cost increase from $6 to $21 and reviews from 2 to 7. This is a modeled tradeoff, not a validated forecast or fraud probability. |

To reproduce on this workspace after building:

```powershell
& .tools/node-v24.22.0-win-x64/node.exe frontend/scripts/record-demo.mjs
```

The recorder owns an isolated local server on port 8125, launches Chrome with video capture, verifies the key results, and closes its processes. It never opens a public host or uses real transaction data.

The user should review the actual app's idle intensity. A fresh viewer can then watch/use it without coaching: record what they notice within 15 seconds, how they describe the purpose by 30 seconds, and whether they can inspect H10 and try the H09 edit. The recording does not establish that those human experience goals have passed.
