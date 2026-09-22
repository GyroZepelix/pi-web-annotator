# Outcome: Improve annotation workflow

Work item: `260922-1604-improve-annotation-workflow`
Disposition: Completed
Date: 2026-09-22

## Delivered scope

- Added persisted per-document Pause/Resume while retaining same-document selections and local draft identity.
- Replaced immediate acceptance with identity-bound, one-shot 750 ms armed re-hover capture, atomic failure handling, and retryable comments.
- Added a maximum-stack viewport capture overlay clipped to the target's actually visible overflow region, preserving page hover state and original inline styles.
- Made accepted cards annotation-ID-keyed so edit controls, text, focus, and caret survive polling and unrelated refreshes.
- Added exact live DOM Highlight for the current active source document, including paused operation, centered two-second styling, cleanup, and precise unavailable guidance.
- Preserved strict message boundaries, serialized operations, limits, permissions, dependency policy, extension identity, bridge behavior, save semantics, and schema-v1 bundles.
- Updated automated coverage, README workflow/troubleshooting/live checks, and verified durable wiki guidance.

## Deviations from plan

- None. Two user-acceptance defects were corrected inside the planned interaction and styling scope: inactive edit actions now honor `hidden`, and capture styling uses a visible-region overlay instead of relying only on an element outline that an ancestor could clip.

## Verification summary

- Focused browser suite passed 25/25; full suite passed 75/75.
- JavaScript syntax, package dry-run, spec validation, Markdown integrity, and `git diff --check` passed.
- Brave Browser 153.1.95.102 on macOS 26.4 passed Pause/Resume, explicit Enable after navigation, delayed-hover PNG capture, Cancel/failure retention, stable accepted editing, independent exact-target Highlight, background/detached/replaced guidance, and overflow-clipped capture-border acceptance.
- Medium-assurance focused and contract-quality reviews passed initially and after both targeted corrections. No blocking or non-blocking findings remain.
- Full evidence: [verification.md](./verification.md).

## Retained, reverted, or transferred work

- All planned source, tests, documentation, and durable wiki changes were retained.
- No dependency, migration, manifest, permission, bridge, schema, save-contract, commit, push, deployment, or Dream action occurred.

## Residual risks

- Future Brave behavior may drift.
- Browser-restart recovery, unsupported browsers/platforms, and live standalone File System Access remain outside the accepted support boundary.
- Independent reviewers lacked direct filesystem access; their medium-assurance verdicts relied on supplied contract details, implementation invariants, complete deterministic checks, and live evidence.

## Follow-up work items

- None required.

## Source references

- `browser-extension/content-script.js`
- `browser-extension/service-worker.js`
- `browser-extension/sidepanel.js`
- `browser-extension/sidepanel.css`
- `tests/browser/content-script.test.js`
- `tests/browser/service-worker.test.js`
- `tests/browser/sidepanel.test.js`
- `README.md`

## Wiki updates

- Updated `wiki/browser-annotator.md` with per-document mode, armed capture, overflow-safe capture styling, stable accepted editors, exact-live Highlight, and verification boundaries.
- Updated `wiki/log.md` and `wiki/state.md` with the verified ingest record.
