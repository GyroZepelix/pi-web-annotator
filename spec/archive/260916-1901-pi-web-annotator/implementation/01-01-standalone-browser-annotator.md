# Slice 01.01: Standalone Chromium annotator and bundle contract

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T01 - Deliver the standalone Chromium annotator and canonical bundle contract`
Assurance: medium - browser state, screenshots, File System Access writes, and a public manifest contract require integrated regression evidence but remain locally recoverable.
Review required now: focused segment review

## Outcome

A dependency-free unpacked Chromium companion can annotate elements across explicitly enabled pages, manage comments in a persistent side panel, capture one outlined viewport PNG per annotation, and save a valid standalone `.pi-annotations/<capture-id>/` bundle under a user-selected project root.

## Why this slice exists now

The browser session, manifest, and Finish payload are prerequisites for the Pi bridge. Establishing and verifying them first isolates browser permission, screenshot, state, and standalone filesystem behavior before local IPC and Pi filesystem behavior are added.

## Relevant context

- Requirements 1-6 and 10 govern this slice.
- Decisions D01-D03, D05-D07 govern browser UI, evidence, artifact, save validity, intake, and trust.
- `annotations.json` is the sole authority and is written after all PNGs.
- Parent-plan sections to load on conflict or uncertainty: Requirements, Design, Decision Log, Acceptance criteria, Testing decisions and seams, Risks and blockers.

## Constraints and non-goals

- Target current Google Chrome or Chromium proper on macOS, minimum Chrome 114.
- Use only `activeTab`, `scripting`, `sidePanel`, and the approved least-privilege `storage` permission required by `chrome.storage.session`, plus the future fixed bridge host permission. Do not request all-sites access.
- Exclude current form values, event handlers, extension controls, absolute paths, traversal, base64 images, and executable interpretation of captured content.
- Keep the extension dependency-free and do not add a test framework dependency without approval.
- Do not implement bridge behavior beyond the stable browser-side interface and disconnected status needed by T02.
- Do not add full-page capture, cross-browser support, browser-restart recovery, ZIP or Markdown summaries, import commands, or source mapping.

## Expected source and test areas

- `package.json`
- `README.md`
- `browser-extension/manifest.json`
- `browser-extension/service-worker.js`
- `browser-extension/sidepanel.html`
- `browser-extension/sidepanel.css`
- `browser-extension/sidepanel.js`
- `browser-extension/content-script.js`
- `browser-extension/lib/`
- `tests/browser/`
- `tests/bundle/`
- `tests/fixtures/`

## Acceptance and checks

- Acceptance: toolbar action opens the side panel; each document requires explicit enablement; selection and non-empty comment capture bounded target evidence and one outlined viewport PNG; annotations survive service-worker suspension, can be edited or deleted, and remain retryable on failures.
- Acceptance: standalone Finish directly invokes the directory picker, creates a non-overwriting dated `.pi-annotations/` bundle, asks before a minimal `.gitignore` append, writes PNGs before `annotations.json`, and clears state only after success.
- Acceptance: schema-v1 fixtures cover valid multi-page output and reject malformed versions, IDs, timestamps, comments, fields, paths, duplicates, missing images, and unsafe captured attributes.
- Check: `node --test`
- Check: `find browser-extension -name '*.js' -print0 | xargs -0 -n1 node --check`
- Check: parse package, manifest, and JSON fixtures through the automated suite.
- Check: run the standalone subset of the documented Chromium checklist, including HTTPS, HTTP localhost, scrolling, navigation, multiple tabs, restricted pages, picker cancel, permission denial, `.gitignore` accept/decline, screenshot outline, and retry.

## Review gate

One focused segment review covers the complete standalone browser behavior, bundle contract, permission boundary, tests, and plan acceptance for T01. Reviewers apply the credible-harm blocker standard and do not expand the plan. Implement may rerun the gate at most twice after targeted corrections.

## Attempt log

### Attempt 1 - 2026-09-16T17:57:19Z
Starting HEAD: `c7aafa7ed612f366d11625528bd9d1a32b0cb493`
Changes: none; implementation paused at contract validation.
Checks: item resolution and Implement helper capability checks passed; Chrome API documentation confirms `chrome.storage.session` requires the `storage` permission.
Failures: the exact permission list permits only `activeTab`, `scripting`, and `sidePanel`, while required service-worker-suspension resilience calls for `chrome.storage.session`, which requires `storage`.
Blockers: implementing both requirements exactly is not possible without deciding whether narrow `storage` permission is permitted or persistence must use a different contract.
Exact next action: confirm whether to add the narrow `storage` permission for `chrome.storage.session`.
Decision: approved as a routine narrow source-truth correction on 2026-09-16; canonical requirement and Decision Log updated before implementation.

For each interrupted or failed attempt, append without rewriting earlier entries:

```text
### Attempt <number> - <timestamp>
Starting HEAD: <git commit at invocation start>
Changes: <paths and behavior changed>
Checks: <commands and results>
Failures: <failures or none>
Blockers: <credible blockers or none>
Exact next action: <single resumable action>
```

## Completion and handoff

Completed: 2026-09-16T18:19:05Z
Starting HEAD: `c7aafa7ed612f366d11625528bd9d1a32b0cb493`

Changed paths:
- `package.json`, `README.md`
- `browser-extension/manifest.json`, browser runtime/UI files, and `browser-extension/lib/`
- `tests/browser/`, `tests/bundle/`, and `tests/fixtures/`
- Canonical permission correction in `plan.md`; progress in `implementation/index.md` and this packet

Acceptance evidence:
- The dependency-free MV3 companion has exact approved permissions, deterministic identity, explicit per-document injection, global side-panel state, session-storage suspension resilience, privacy-filtered bounded target evidence, outlined visible-viewport PNG capture, comment edit, delete, confirmed cancel, and retry-preserving errors.
- Standalone Finish calls the picker directly from the click, confirms `.gitignore` creation/append independently, preserves existing bytes, chooses a non-overwriting capture ID, validates the complete schema-v1 payload, writes PNGs before the manifest, and clears only the saved state revision.
- Accepted/rejected fixtures and tests cover multi-page ordering, strict fields and versions, IDs, timestamps, comments, paths, duplicate/unresolved images, unsafe evidence, limits, storage suspension, failures, collisions, and manifest-last ordering.

Checks:
- `node --test` - PASS, 38/38.
- `find browser-extension -name '*.js' -print0 | xargs -0 -n1 node --check` - PASS.
- Focused package/manifest/fixture JSON parse - PASS.
- `npm pack --dry-run --json` - PASS; standalone package files included and no dependencies bundled.
- `uv run spec/scripts/manage-spec-item.py --root . validate --item 260916-1901-pi-web-annotator` - PASS before progress update.
- Markdown fenced-code balance and `git diff --check` - PASS.

Review:
- Initial focused review identified session-quota headroom and descendant-form-text risks. Chrome 114's 10 MiB session quota was reconciled with measured 9,000,000-byte storage enforcement, lower image/bundle limits, and focused tests; visible-text and outer-HTML privacy filtering were strengthened.
- Targeted focused re-review retry 1 - PASS, no blockers. One non-blocking observation records the designed tradeoff that an accepted minimal `.gitignore` edit can remain if a later bundle write fails; pending annotations remain retryable and no valid partial manifest is exposed.

Residual uncertainty:
- The documented standalone Chromium checklist was not executed because no Google Chrome/Chromium executable is installed in this environment. Real side-panel, `activeTab`, screenshot paint timing, File System Access behavior, and the 9,000,000-byte JSON proxy for Chrome's dynamically allocated 10 MiB session quota therefore remain honest browser-level uncertainty; deterministic mocks, documented quota arithmetic, and structural review passed.

Progress: slice 01.01 and T01 checked; `Current` advanced once to `02.01`. No bridge behavior, staging, commit, archive, Dream, or later-Current implementation was performed.

Next action: create a user-controlled Git checkpoint, optionally run Dream, then implement Current 02.01 in a fresh Implement invocation.
