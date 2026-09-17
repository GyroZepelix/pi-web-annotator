# Outcome: Pi web annotator

Work item: `260916-1901-pi-web-annotator`
Disposition: completed
Date: 2026-09-17

## Delivered scope

- Delivered a dependency-free Pi package and unpacked Manifest V3 companion guaranteed for Brave 1.95.101+ on macOS.
- Preserved deterministic extension ID `kemcbalaoccidjnoggajcgjhjlpibbkg`, exact least-privilege permissions, toolbar-event `activeTab` authorization, separate per-document Enable, stable drafts, bounded target evidence, and target-outlined viewport PNG capture.
- Delivered authenticated, project-aware `/annotate` saving with fixed loopback binding, strict origin/token/schema/size/path validation, explicit destination and `.gitignore` consent, no overwrite, temporary-sibling atomic writes, retryable browser state, and reconnection without recapture.
- Retained capability-detected standalone saving as tested but unguaranteed best-effort behavior; when neither bridge nor picker is available, Finish remains disabled with persistent `/annotate` guidance and unchanged pending state.
- Preserved strict schema-v1 dated bundles, validated named/latest path-based later intake, and no automatic LLM turn.
- Added one final 1024x1024 generated source icon plus 16, 32, 48, and 128 pixel derived PNGs, exact manifest/action mappings, package inclusion, and live Brave recognizability.

## Deviations from plan

- The first generated charcoal-background, generously padded icon failed live legibility. User-approved Decision D13 retained the cursor-plus-comment-bubble concept while changing to a solid cobalt-blue background and a very large high-contrast motif filling about 80% of the square with minimal safe padding.
- The initial generation and the one approved corrective provider edit both returned 1254x1254 PNG metadata despite 1024x1024 requests. Each selected final source was normalized deterministically with macOS `sips`; the checked-in source is exactly 1024x1024.
- The provider's collision-safe edit output was named `icon-source-2.png`; it was promoted over `icon-source.png` and removed so only one source artwork remains.
- No other requirement, runtime behavior, dependency, permission, bundle format, or supported-environment boundary changed.

## Verification summary

- `node --test`: PASS, 64/64.
- Complete browser/extension JavaScript syntax: PASS.
- PNG signatures, IHDR-first structure, exact source/derived dimensions, one-source inventory, and exact manifest/action maps: PASS.
- `npm pack --dry-run --json`: PASS with 22 runtime files; required extension/browser/icon assets included and spec, wiki, tests, `.pi-annotations/`, and alternate sources excluded.
- Actual Pi package discovery and non-TUI `/annotate` refusal: PASS without an LLM turn.
- Temporary-repository and real-loopback authentication, validation, lifecycle, atomic-save, path, no-overwrite, `.gitignore`, timeout, cancellation, loss/reconnection, and retry coverage: PASS within the full suite.
- Recorded schema-v1 bundles `20260916-211757Z` and `20260916-211856Z` plus latest-valid discovery: PASS.
- Spec validation, Markdown links/fences, protected hashes, and `git diff --check`: PASS.
- Live Brave Browser 153.1.95.102 on macOS 26.4 workflow evidence: PASS.
- Final reload retained ID `kemcbalaoccidjnoggajcgjhjlpibbkg`; recognizability in `brave://extensions` and the pinned normal-scale toolbar: PASS.
- Focused final-segment review: PASS, no blockers, zero retries.
- Final whole-contract review: PASS, no blockers, zero retries.

## Retained, reverted, or transferred work

- Retained completed T01 implementation and the valid bridge, action, stable-draft, capability, test, and documentation source from frozen T02/T03/T04 attempts.
- Preserved packets 01.01-04.01 and refinements R001-R003 byte-for-byte.
- Preserved the user-approved `.gitignore` append.
- Replaced only the rejected provisional icon artwork and its derived sizes; no alternate source artwork remains.

## Residual risks

- Future Brave changes to Side Panel, `activeTab`, screenshot, extension-origin loopback, or File System Access behavior remain external compatibility risks.
- Standalone saving remains outside guaranteed v1 acceptance even though capability-gated code and deterministic tests are retained.
- Medium-assurance provenance spans retained uncommitted T02/T03/T04/T05 work from starting HEAD `787bb2d4265347b3253f41c3c3b031d5b953a508` without an intermediate committed checkpoint; current artifacts, complete checks, protected hashes, frozen evidence, and reviews cover the accepted behavior.

## Follow-up work items

- No required follow-up.
- Optional non-breaking cleanup: change the `/annotate` command description from “Chromium annotator” to “Brave annotator” or “web annotator” for wording consistency.

## Source references

- `plan.md`, `implementation/index.md`, `implementation/05-01-brave-only-icon-and-final-completion.md`, and `verification.md`.
- `README.md`, `package.json`, `browser-extension/`, `extensions/pi-web-annotator/`, and `tests/`.
- Live Brave workflow, deterministic extension ID, corrected-source approval, and final icon reload evidence recorded in Current 05.01 and verification.

## Wiki updates

- Updated `wiki/browser-annotator.md` to describe the verified Brave-only support boundary, action authorization, stable drafts, authenticated bridge, optional standalone capability, generated icon suite, schema-v1 bundle/intake contract, limits, and verification boundary.
- Updated `wiki/index.md`, `wiki/log.md`, and `wiki/state.md`; normalized stale active-item references in Dream history so terminal archival could proceed without dangling canonical active paths.
