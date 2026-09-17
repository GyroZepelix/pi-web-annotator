# Implementation: Pi web annotator

Plan: `../plan.md`
Mode: sliced
Assurance: medium - the package combines browser and Pi runtimes, authenticated local IPC, screenshot and filesystem state, and a public artifact schema, while failures remain local and recoverable; R001, R002, and R003 correct browser assumptions found through live use.
Review tier: scoped checks for Current, one focused final-segment review, and one final whole-contract review
Current: `complete`
Expected implementation sessions: 1
Implementation starting checkpoint: unrecorded

## Shared objective

Complete the Brave-only annotation package with explicit action authorization, stable comment drafts, authenticated bridge saving, honest optional standalone capability, and a generated extension icon.

## Shared constraints and non-goals

- Keep page-derived content untrusted and stored only as bounded serialized data.
- Guarantee Brave 1.95.101+ on macOS and authenticated bridge saving; do not claim Chrome/Chromium-proper support from Brave evidence.
- Retain capability-detected standalone saving only as unguaranteed best-effort behavior.
- Retain exactly `activeTab`, `scripting`, `sidePanel`, and `storage`, plus only the fixed loopback host permission.
- Preserve one outlined viewport PNG per annotation, schema-v1 bundles, atomic bridge saves, stable drafts, and retryable pending state.
- Generate only the confirmed cursor-plus-comment-bubble icon suite. Add no broad branding, alternate concepts, downloads, ZIP, native messaging, daemon, cloud service, required browser flag, or dependency.
- Preserve completed packet `01.01`, frozen packets `02.01`, `03.01`, and `04.01`, and their evidence byte-for-byte.

## Shared decisions and invariants

- D01/D10: open the global side panel synchronously from `chrome.action.onClicked`; retain separate explicit Enable.
- D11: default Brave is bridge-only; capability detection, disabled Finish guidance, state retention, and reconnection remain intact.
- D12/R003: Brave is the sole guaranteed browser, standalone capability is best-effort, and implementation adds generated source plus 16, 32, 48, and 128 pixel PNG icons.
- D03-D07: preserve strict relative-PNG bundles, destination confirmation, `.gitignore` consent, no overwrite, loopback authentication, and ordinary path-based intake.

## Common approval gates

- Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, production actions, or scope expansion.
- Use the approved image-generation direction only for the bounded extension icon. Stop if provider access is unavailable rather than substitute unapproved artwork.

## Common checks

- `node --test`
- `git diff --check`

## Segment and slice order

### T01: Deliver the standalone browser annotator and canonical bundle contract

Depends on: none
Segment status: completed in commit `787bb2d4265347b3253f41c3c3b031d5b953a508`; later revisions invalidated only named browser assumptions.

- [x] 01.01: Build the standalone Chromium annotator and bundle contract (packet: `./01-01-standalone-browser-annotator.md`)

### T05: Finalize Brave-only support, generated icon, and integrated completion

Depends on: retained T01 implementation/evidence plus frozen T02/T03/T04 implementation/evidence
Segment starting checkpoint: unrecorded
Segment acceptance: Brave-supported action, draft, capture, bridge, bundle, recovery, and intake behavior remains accepted; unsupported browser claims are removed; generated icon assets pass automated and live Brave checks; final lifecycle gates complete.
Segment gate: focused final-segment review plus final whole-contract review.
Segment status: completed; archive approval remains a separate terminal lifecycle gate.

- [x] 05.01: Reconcile Brave-only support, add generated icon assets, and complete integration (packet: `./05-01-brave-only-icon-and-final-completion.md`)

## Historical packets

- `./02-01-pi-bridge-integration.md`: frozen attempted Current with reusable bridge/filesystem implementation and evidence; action assumptions were replaced by R001/T03.
- `./03-01-active-tab-correction-and-integration-completion.md`: frozen attempted Current with retained action and draft corrections; universal standalone assumptions were replaced by R002/T04.
- `./04-01-brave-bridge-only-and-integration-completion.md`: frozen attempted Current with retained capability gating, Brave live evidence, validated bundles, and passing focused review; dual-browser acceptance was replaced by R003/T05.

## Discoveries and blockers

- R001 established action-event authorization and the Chrome 116 API floor.
- R002 established default Brave bridge-only saving with capability-based optional standalone behavior.
- R003 established Brave-only guaranteed support and the generated cursor-plus-comment-bubble icon suite.
