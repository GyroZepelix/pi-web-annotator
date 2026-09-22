# Verification: Improve annotation workflow

Work item: `260922-1604-improve-annotation-workflow`
Date: 2026-09-22

## Environment

- Starting Git boundary: `7cacba6bc3e2dcf3c874dc05eea48069ca3c1726`.
- Direct mode, medium assurance.
- Live browser: Brave Browser 153.1.95.102 on macOS 26.4.
- Changed implementation: `browser-extension/content-script.js`, `browser-extension/service-worker.js`, `browser-extension/sidepanel.js`, and `browser-extension/sidepanel.css`.
- Changed evidence and guidance: `tests/browser/content-script.test.js`, `tests/browser/service-worker.test.js`, `tests/browser/sidepanel.test.js`, `README.md`, `wiki/browser-annotator.md`, `wiki/log.md`, and `wiki/state.md`.
- Manifest, permissions, package dependencies, constants, bundle schema, bridge protocol, and save implementation are unchanged.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Focused browser tests | Pass, 25/25 | `node --test tests/browser/content-script.test.js tests/browser/service-worker.test.js tests/browser/sidepanel.test.js` |
| Complete automated suite | Pass, 75/75 | `node --test` |
| JavaScript syntax | Pass | `find browser-extension extensions -name '*.js' -print0 \| xargs -0 -n1 node --check` |
| Package dry run | Pass, 22 files and no spec/wiki/tests/captures | `npm pack --dry-run --json` plus path assertions |
| Spec validation | Pass | `uv run spec/scripts/manage-spec-item.py --root . validate --item 260922-1604-improve-annotation-workflow` |
| Markdown paths and fences | Pass | Local Python link/fence check over README, wiki pages, and plan |
| Markdown UTF-8/control characters | Pass | Local Python control-character check |
| Diff whitespace | Pass | `git diff --check` |
| Live Brave workflow | Pass | Temporary localhost delayed-hover page, unpacked extension ID `kemcbalaoccidjnoggajcgjhjlpibbkg` |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| Pause and Resume | Focused worker/content/panel tests prove mode persistence, older-entry fallback, rollback, listener suspension, and stable same-document draft identity. Live Pause allowed a real page control, Resume preserved draft value/control identity, and navigation removed only the stale draft while requiring Enable. | Pass |
| Armed hover capture | Content tests prove continuous 750 ms descendant hover, leave reset, one-shot ready, paint ordering, target detachment, ranked ownership, overflow-clipped visible geometry, maximum-stack overlay cleanup, and exact inline-style preservation. Worker tests prove stale/duplicate suppression plus screenshot and storage failure atomicity. Live stored PNGs visibly contained the delayed page-owned hover hint and all four red capture edges around the visible portion of an overflow-clipped target. | Pass |
| Failure and cancellation integrity | Automated tests cover Cancel, detachment, screenshot failure, storage failure, stale identity, and retry. Live Cancel and forced target detachment retained text and created no annotation. | Pass |
| Stable accepted editing | Side-panel tests retain editor node, value, focus, and caret across two polls and state refresh. Live 11-second edit retained all four; Save changed only the comment and Keep original discarded only local text, with screenshot paths and byte counts unchanged. | Pass |
| Exact live-target Highlight | Content and worker tests cover document-local element maps, multiple targets, current-window/current-tab/document gating, paused mode, center scroll, two-second restoration, precedence, and no state mutation. Live two targets centered independently; revision/comments stayed unchanged; original inline outline/offset returned exactly; background, detached, and replaced cases gave guidance. | Pass |
| Compatibility | Full regression and package suites pass. `browser-extension/manifest.json`, `package.json`, schema-v1 bundle creation, bridge protocol, save behavior, extension identity, permissions, host access, and supported environment remain unchanged. | Pass |
| Documentation and durable memory | README workflow, troubleshooting, development checklist, browser wiki, wiki log, and wiki processed-input state describe only verified behavior and limits. | Pass |

## Review findings

- Focused review: initial PASS; targeted retry 1 PASS after the user-reported hidden-control correction; targeted retry 2 PASS after the overflow-outline correction. No blocking or non-blocking findings remain, and the retry budget is exhausted. The reviewer lacked filesystem tools and based its verdict on the supplied contract, implementation invariants, complete checks, corrections, and live evidence; this is a recorded non-blocking medium-assurance limitation.
- Final contract-quality review: initial PASS plus targeted retries 1 and 2 PASS over the same corrections. No blocking or non-blocking findings remain, and the retry budget is exhausted. Coverage included all T01 requirements, repository quality, non-goals, compatibility boundaries, documentation, automated evidence, and live evidence. The same no-filesystem limitation was recorded as non-blocking.
- Several earlier Cursor-backed reviewer attempts failed or returned no verdict and were not counted as review evidence. Replacement independent reviews supplied valid verdicts.

## Failures and skipped checks

- During implementation, live detachment exposed that leaving the target before the settle timer could leave an armed capture waiting. A document MutationObserver was added, focused and full suites were rerun, and live detachment then retained the comment, reported reselection, and created no annotation.
- After initial review, user acceptance found Save edit and Keep original visible outside edit mode because the author `.actions` display rule overrode the user-agent `[hidden]` rule. An explicit `[hidden] { display: none !important; }` rule and regression test corrected the display; affected suites and both targeted reviews passed.
- User screenshot evidence then showed an element-owned red outline clipped beneath overflow and stacked application regions. Capture now uses a pointer-events-none, maximum-stack fixed overlay intersected with the target's actually visible overflow-clipped rectangle. VM evidence and a real Brave overflow fixture proved all four red edges, retained hover UI, original inline-style preservation, precedence, and cleanup; targeted retry 2 passed at both review gates.
- Focused development also corrected descendant-to-descendant hover timer resets, Pause persistence rollback re-arming, and current-window Highlight gating before the final evidence runs.
- The first temporary live fixture had an unrelated page-script reference error; the fixture was corrected before acceptance evidence was recorded.
- No required check or live acceptance case was skipped.

## Unverified areas

- Future Brave compatibility drift remains possible.
- Google Chrome, Chromium proper, other browsers/platforms, browser-restart recovery, and live standalone File System Access remain outside the supported or accepted scope.
