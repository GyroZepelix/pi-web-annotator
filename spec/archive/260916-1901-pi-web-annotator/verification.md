# Verification: Pi web annotator

Work item: `260916-1901-pi-web-annotator`
Date: 2026-09-17

## Environment

- Starting Git boundary: `787bb2d4265347b3253f41c3c3b031d5b953a508`; medium-assurance completion spans retained uncommitted T02/T03/T04/T05 work.
- Live browser evidence: Brave Browser 153.1.95.102 on macOS 26.4 (25E246).
- Deterministic extension ID: `kemcbalaoccidjnoggajcgjhjlpibbkg`.
- Runtime/tooling: Node.js built-in test runner, macOS `sips`, npm package dry run, Python/uv spec helper, and Pi RPC smoke harness.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `node --test` | PASS (64/64) | Browser action, draft, capability, screenshot, bundle, temporary-repository, bridge, loopback, filesystem, timeout, cancellation, and retry coverage. |
| `find browser-extension extensions -name '*.js' -print0 \| xargs -0 -n1 node --check` | PASS | All JavaScript runtime files parsed. |
| Focused Node PNG/IHDR and manifest validation | PASS | Exactly `icon-source.png` at 1024x1024 plus 16/32/48/128 derived PNGs; valid signatures/IHDR; exact manifest and action maps; no alternate source. |
| `npm pack --dry-run --json` | PASS | 22 files; README, package metadata, Pi extension, browser companion, source icon, and derived icons included; spec, wiki, tests, `.pi-annotations/`, and alternate sources excluded. |
| Actual Pi RPC package load and `/annotate` smoke | PASS | Package command discovered as an extension command and refused outside interactive TUI without an LLM turn. |
| Recorded bundle reader and latest-valid check | PASS | `20260916-211757Z` and `20260916-211856Z` validated; latest-valid selected `20260916-211856Z/annotations.json`. |
| `uv run spec/scripts/manage-spec-item.py --root . validate --item 260916-1901-pi-web-annotator` | PASS | Planned active item and protocol artifacts valid. |
| Changed Markdown links and fenced-code balance | PASS | All local targets resolved and fences balanced. |
| Protected SHA-256 boundary | PASS | Protocol files, packets 01.01-04.01, and refinements R001-R003 match the supplied hashes. |
| `git diff --check` | PASS | No whitespace errors. |
| Live Brave workflow matrix | PASS (reused) | Action authorization, explicit Enable, outlined capture, stable drafts, disconnected guidance, bridge save/loss/reconnection, bundle validation, and later intake passed in Brave 153.1.95.102. |
| Final live icon reload | PASS | Exact ID matched; corrected icon recognizable in `brave://extensions` and the pinned normal-scale toolbar. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| 1. Package, installation, and identity | Package manifest/dry run, README installation, Pi discovery smoke, deterministic key/ID test | PASS |
| 2. Supported environment and permissions | Brave-only README/package wording; exact minimum/permissions/host assertions | PASS |
| 3. Generated extension icon | One provider generation and one user-approved corrective edit; deterministic normalization/derivation; metadata, package, manifest, source-art, and live recognizability evidence | PASS |
| 4. Toolbar authorization and annotation | Service-worker implementation/tests and reused live Brave matrix | PASS |
| 5. Element and screenshot evidence | Selector/privacy/bounds tests, capture sequencing tests, reused target-outline evidence | PASS |
| 6. Canonical bundle contract | Accepted/rejected fixtures, strict validator, limits tests, recorded bundles | PASS |
| 7. Optional standalone saving | Capability detection, direct-gesture picker, disabled Finish guidance, write-order and `.gitignore` tests; explicitly unguaranteed | PASS |
| 8. Pi bridge lifecycle and trust | Real loopback tests for bind, origin, token, methods, media types, bounds, duplicate completion, timeout, cancellation, shutdown, and collision | PASS |
| 9. Project-aware bridge save | Temporary-repository tests for destination boundaries, no overwrite, temporary sibling cleanup, manifest-last atomic rename, and `.gitignore` consent | PASS |
| 10. Completion, intake, and verification | Revision-safe completion, named/latest intake, complete checks, live Brave evidence, and both required reviews | PASS |

## Review findings

- Focused final-segment review: **PASS**, no blocking or non-blocking findings, zero retries.
- Final contract-quality review: **PASS**, no blocking findings, zero retries.
- Non-blocking observations: the `/annotate` command description still says “Chromium annotator”; the accepted working tree spans multiple uncommitted slices; and optional picker behavior remains outside guaranteed Brave support. None creates a violated requirement or credible acceptance failure.

## Failures and skipped checks

- The initial provider image and approved edited image both arrived at 1254x1254 despite a 1024x1024 request. Each final selected source was normalized deterministically with `sips`; tests verify the checked-in source is exactly 1024x1024.
- The first charcoal-background, generously padded icon failed live recognizability. Decision D13 recorded the user-approved solid cobalt-blue background and approximately 80%-fill motif; exactly one provider edit corrected it, and final live inspection passed.
- No required checks were skipped.

## Unverified areas

- Future Brave changes to Side Panel, `activeTab`, screenshot, extension-origin loopback, or File System Access behavior remain external compatibility risks.
- Standalone saving is tested capability-based code, not guaranteed live acceptance.
- Provenance uses current artifacts, complete checks, protected hashes, frozen packet evidence, and the starting HEAD rather than an intermediate committed checkpoint.
