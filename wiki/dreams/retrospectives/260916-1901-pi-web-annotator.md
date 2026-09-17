# Workflow retrospectives: 260916-1901-pi-web-annotator

Work item: `260916-1901-pi-web-annotator`

> Historical workflow evidence only. Current source, repository instructions, canonical plans, verification, outcomes, and dynamic wiki guidance remain authoritative.

Planning and whole-lifecycle analysis are recorded at most once each. These sections are outside ordinary Dream episodes and the episode catalog.

<!-- workflow-retrospectives:start -->

## Whole-lifecycle retrospective

Date: 2026-09-17

### Evidence reviewed

- `spec/archive/260916-1901-pi-web-annotator/plan.md`, refinements `R001`-`R003`, implementation packets `02.01`-`05.01`, `verification.md`, and `outcome.md`.
- Current-session successful Gamemaster result, checkpoint commits `787bb2d4265347b3253f41c3c3b031d5b953a508` and `2e59e420421b6a919d856b6c7c53724c3d92280c`, and the per-spec Dream ledger.

### Effective workflow behavior

- Same-item revision states and replacement Currents preserved completed work while preventing live browser failures from being silently accepted.
- Frozen-packet hashes, unrelated-path fingerprints, explicit-path commits, and archive evidence kept a long multi-slice working tree reviewable without overwriting user work.
- Manual Brave gates caught action-grant, draft-refresh, save-capability, support-boundary, and icon-legibility failures that automated checks could not establish.

### Friction and gaps

- Browser capability and support assumptions reached implementation before a live smoke test in the guaranteed browser, causing three formal refinements and four frozen replacement Currents.
- The required image provider was available only in the parent session, forcing a capability handoff, and provider dimensions still required deterministic normalization.

### Workflow-improvement observations

- `wiki/observations.md`: add a target-local browser-extension planning observation requiring a bounded live capability smoke test before planned status.
