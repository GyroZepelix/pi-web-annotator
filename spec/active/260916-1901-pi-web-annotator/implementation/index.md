# Implementation: Pi web annotator

Plan: `../plan.md`
Mode: sliced
Assurance: medium - cooperating browser and Pi runtimes, authenticated local IPC, screenshot and filesystem state, and a public artifact schema have meaningful regression cost but practical local recovery.
Review tier: scoped checks per slice, focused review at each segment boundary, and one final whole-contract review
Current: `02.01`
Expected implementation sessions: 2
Implementation starting checkpoint: unrecorded

## Shared objective

Deliver a macOS Chromium annotation workflow that produces dated, valid `annotations.json` plus PNG bundles for ordinary later Pi intake, with standalone save and an optional project-aware `/annotate` bridge.

## Shared constraints and non-goals

- Keep page-derived content untrusted and stored only as bounded serialized data.
- Use one outlined viewport PNG per annotation and no full-page stitching.
- Keep browser permissions narrow and the bridge bound only to `127.0.0.1:43127`.
- Add no third-party runtime or test dependency without explicit approval.
- Do not add cloud services, native messaging, a permanent daemon, cross-browser support, automatic LLM ingestion, source mapping, or browser-restart recovery.
- Preserve unrelated user changes and never overwrite an existing valid capture.

## Shared decisions and invariants

- D01/D02: use a global side panel with explicit per-document enablement and current-snapshot target evidence.
- D03: schema-v1 `annotations.json` is the sole bundle authority; PNG references are normalized and relative.
- D04/D05: `/annotate` starts one optional authenticated bridge; standalone remains functional; all save paths are user-confirmed and manifest-last.
- D06/D07: later Pi intake is ordinary path-based, and all captured web content is data rather than instructions.
- A valid bundle has a parseable manifest and every referenced PNG inside the same dated directory.
- Failed capture, transfer, prompt, validation, or write retains browser state for retry.

## Common approval gates

- Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, production actions, or scope expansion.

## Common checks

- `node --test`
- `git diff --check`

## Segment and slice order

### T01: Deliver the standalone Chromium annotator and canonical bundle contract

Depends on: none
Segment starting checkpoint: unrecorded
Segment acceptance: the unpacked companion annotates multiple explicitly enabled pages, manages pending comments, captures direct PNG evidence, and saves a valid standalone bundle with tested schema and failure behavior.
Segment gate: focused automated and manual standalone checks plus one focused segment review.

- [x] 01.01: Build the standalone Chromium annotator and bundle contract (packet: `./01-01-standalone-browser-annotator.md`)

Boundary 01.01 -> 02.01: the Pi bridge must consume a verified browser session, Finish payload, manifest, and standalone fallback. Combining two new runtime surfaces would make browser capture/save defects and bridge/filesystem defects harder to isolate and materially reduce correction headroom.

### T02: Deliver the Pi bridge and complete integrated workflow

Depends on: T01
Segment starting checkpoint: unrecorded
Segment acceptance: `/annotate` securely coordinates one project-aware capture, validates and atomically saves the bundle, falls back cleanly to standalone mode, and the complete package passes automated, packaging, documentation, and real-browser acceptance.
Segment gate: focused final-segment checks and review plus one final whole-contract review.

- [ ] 02.01: Add the Pi bridge and complete integration (packet: `./02-01-pi-bridge-integration.md`)

## Discoveries and blockers

None recorded.
