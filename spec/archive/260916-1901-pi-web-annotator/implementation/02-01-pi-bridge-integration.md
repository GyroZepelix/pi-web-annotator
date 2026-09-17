# Slice 02.01: Pi bridge and complete integration

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T02 - Deliver the Pi bridge and complete integrated workflow`
Assurance: medium - authenticated loopback IPC and project filesystem writes add meaningful cross-component regression risk, while failures remain local and retryable.
Review required now: focused final-segment review plus final whole-contract review

## Outcome

The Pi package exposes `/annotate`, securely coordinates one optional project-aware browser session, validates and atomically saves the final bundle with destination and `.gitignore` confirmation, preserves standalone fallback, and passes complete automated, packaging, documentation, and real Chromium acceptance.

## Why this slice exists now

It consumes the verified T01 browser state, manifest, screenshot, and Finish contracts. Starting it earlier would couple browser capture defects with bridge authentication and Pi filesystem defects, obscuring root cause and threatening completion of both runtime surfaces in one session.

## Relevant context

- Requirements 1, 5, and 7-10 govern this slice; T01's passing bundle and browser contracts are prerequisites.
- Decisions D03-D08 govern artifact, bridge, save, intake, trust, and sliced execution.
- The bridge must reveal no project path and expose no generic filesystem operation.
- Parent-plan sections to load on conflict or uncertainty: Requirements, Design, Decision Log, Acceptance criteria, Testing decisions and seams, Risks and blockers.

## Constraints and non-goals

- Bind exactly to `127.0.0.1:43127`, allow only the deterministic companion origin, and require a random token after handshake.
- Reject wrong origin, token, method, media type, schema, size, duplicate completion, and escaping path before any destination write.
- Use a temporary sibling and final rename, never overwrite, and retain browser state until Pi reports success.
- Ask before appending `.pi-annotations/` to the project-root `.gitignore`; declining still allows save with a warning.
- Stop the bridge on every terminal lifecycle path and preserve standalone behavior when no bridge exists or it disappears.
- Add no native host, permanent daemon, remote bind, cloud service, custom import command, automatic LLM turn, or unapproved dependency.

## Expected source and test areas

- `extensions/pi-web-annotator/index.ts`
- `extensions/pi-web-annotator/lib/`
- `browser-extension/service-worker.js`
- `browser-extension/sidepanel.js`
- bridge-related browser helpers and fixtures
- `tests/bridge/`
- `tests/bundle/`
- `tests/fixtures/`
- `README.md`
- `package.json`

## Acceptance and checks

- Acceptance: `/annotate` is available in interactive Pi, starts one cancellable fixed-port session, fails clearly on collision, and releases the endpoint on success, cancel, timeout, session replacement/shutdown, and unrecoverable failure.
- Acceptance: the companion detects connected versus standalone mode without receiving `ctx.cwd`; accepted requests require the allowlisted origin and per-session token.
- Acceptance: Finish retains browser state until Pi validates all metadata and images, confirms destination, applies any approved ignore edit, atomically exposes one complete non-overwriting bundle, and returns success.
- Acceptance: invalid callers or payloads and every tested prompt, transfer, validation, and filesystem failure produce no valid destination and leave browser state retryable.
- Acceptance: documentation covers install, unpacked loading, both workflows, artifact schema, latest-bundle intake, privacy, limits, unsupported environments, and troubleshooting.
- Check: `node --test`
- Check: `find browser-extension extensions -name '*.js' -print0 | xargs -0 -n1 node --check`
- Check: `npm pack --dry-run`
- Check: run documented temporary-repository bridge integration tests for authentication, bounds, validation, path safety, no-overwrite, temp rename, `.gitignore`, timeout, cancel, and shutdown.
- Check: run the complete documented macOS Chromium checklist for standalone, connected bridge, bridge loss and fallback, multi-page capture, and later path-based Pi intake.
- Check: `uv run spec/scripts/manage-spec-item.py --root . validate --item 260916-1901-pi-web-annotator`
- Check: resolve changed Markdown links, check fenced-code balance, and run `git diff --check`.

## Review gate

Run one focused review over T02 and its integration with the accepted T01 contract. Then run one final contract-quality review over the complete implementation and all plan requirements, exclusions, acceptance criteria, tests, documentation, and residual uncertainty. Reviewers apply the credible-harm blocker standard and do not expand the plan. Implement may rerun an affected gate at most twice after targeted corrections.

## Attempt log

### Attempt 1 - 2026-09-16T18:55:16Z

Starting HEAD: `787bb2d4265347b3253f41c3c3b031d5b953a508`

Changes: implemented the package manifest and interactive-only `/annotate`; authenticated fixed-port loopback handshake/completion; strict origin, token, method, media-type, schema, size, duplicate, and path validation; confirmed project destination and `.gitignore` handling; complete pre-write bundle validation and atomic sibling-directory save; browser bridge detection, transfer, loss fallback, and retry preservation; limits/privacy parity; final README, package surface, and deterministic bridge/filesystem/browser tests. Relevant paths are `package.json`, `README.md`, `browser-extension/`, `extensions/pi-web-annotator/`, `tests/browser/`, `tests/bridge/`, `tests/bundle/`, and `tests/fixtures/`. The unrelated protocol-migration changes in `spec/AGENTS.md`, `spec/scripts/manage-spec-item.py`, and `spec/templates/refinement.md` were not modified.

Checks:
- `node --test` - PASS, 54/54.
- Browser and extension JavaScript `node --check` sweep - PASS.
- Actual Pi package discovery/load and non-TUI `/annotate` refusal smoke checks - PASS.
- `npm pack --dry-run --json` - PASS, 17 intended package files and no spec, wiki, test, or generated-capture files.
- Temporary-repository and real-loopback integration coverage - PASS for authentication, method/media/schema/size/path rejection before save, duplicate completion, cancel/retry outcomes, fixed-port collision, timeout despite status polling, shutdown, collision suffixes, no-overwrite, symlink escape rejection, `.gitignore` accept/decline and byte preservation, sibling temporary save, manifest-last ordering, failure cleanup, and latest-valid discovery.
- Focused T02 review - PASS with no blockers. Final whole-plan contract review - UNVERIFIED solely because required live Chromium evidence is unavailable; it reported no source or contract blocker.
- Spec item validation, changed Markdown local-link and fence checks, and `git diff --check` - PASS before this interruption entry.

Failures: no supported Google Chrome or Chromium proper executable is installed, so the documented real macOS browser checklist could not run. Unavailable live scenarios are Side Panel rendering; toolbar and `activeTab` enablement; content-script injection on HTTPS, HTTP localhost, navigation, multiple tabs, and restricted pages; target-outline screenshot paint and capture; service-worker suspension; File System Access picker cancellation, permission denial, `.gitignore`, collision, and write-failure behavior; extension-origin handshake and connected Finish; Pi prompt cancellation and write failure; bridge loss, standalone fallback, retry retention, and successful later path-based intake. None is claimed passed.

Blockers: the required final live-browser evidence is unavailable. The final whole-plan gate is therefore UNVERIFIED despite passing source, automated, package, focused-review, and integration evidence. Per user decision, slice 02.01, T02, `Current`, and plan progress remain unchanged; no completion wiki, final `verification.md` or `outcome.md`, archive preflight/archive, Dream, staging, or commit was performed.

Exact next action: run the documented checklist in supported macOS Google Chrome or Chromium proper, then rerun the affected final evidence and whole-plan contract review.

### Attempt 2 - 2026-09-16T19:07:38Z

Starting HEAD: `787bb2d4265347b3253f41c3c3b031d5b953a508`

Screenshot evidence: the user ran the live checklist on an ordinary HTTP(S) page after opening the panel from the Pi Web Annotator toolbar action. The supplied screenshot (`pi-clipboard-97bcf1b6-11ea-471d-beed-223732beaa86.png`) shows `Active tab — not enabled`; clicking Enable then reports `No active page is available.` Bridge status was disconnected and unrelated to this failure.

Diagnosis: this is a real active-tab acquisition defect. The current service worker configures `sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`, while the side panel later queries the tab and asks the worker to retrieve it. In the observed Chrome API path, opening a persistent side panel this way does not grant `activeTab`; the tab ID remains visible but sensitive `url` and `title` fields are absent. `enableTab()` calls `chrome.tabs.get(tabId)`, then `supportedPage()` deterministically raises the screenshot error because `tab.url` is missing.

Exact source/API evidence:
- `browser-extension/service-worker.js` sets `openPanelOnActionClick: true`; `browser-extension/sidepanel.js` uses `chrome.tabs.query({ active: true, currentWindow: true })` and sends only `tabId`; `enableTab()` re-fetches that tab and `supportedPage()` rejects a missing `url` with the exact observed `No active page is available.` message.
- Chrome's activeTab documentation states that executing an extension action grants temporary tab URL and scripting access: <https://developer.chrome.com/docs/extensions/develop/concepts/activeTab>.
- Chrome's Side Panel reference separates automatic `setPanelBehavior({ openPanelOnActionClick: true })` from programmatic opening and marks `sidePanel.open()` as Chrome 116+: <https://developer.chrome.com/docs/extensions/reference/api/sidePanel>.
- Chrome extension-team discussion for crbug 1453437 records that a persistent side panel does not receive the action popup's `activeTab` grant and reproduces missing capture permission from side-panel UI: <https://groups.google.com/a/chromium.org/g/chromium-extensions/c/DET2SXCFnDg>.

Conflicting canonical boundaries: Requirement 2 and the manifest promise Chrome 114+, the exact narrow permissions (`activeTab`, `scripting`, `sidePanel`, `storage`), and only the fixed bridge host permission; Requirements 2, 3, and acceptance require the toolbar action to open the global panel and explicit Enable to inject into an ordinary HTTP(S) document. The live failure blocks document enablement, selector injection, and later screenshot capture. Adding persistent page access would weaken the confirmed least-privilege/security boundary, while changing the gesture or minimum version changes public support and browser-action behavior.

Smallest viable options and consequences:
1. Revise the minimum to Chrome 116+, disable automatic action-panel behavior, handle `chrome.action.onClicked(tab)`, retain that genuine `activeTab` grant, and call `chrome.sidePanel.open({ windowId: tab.windowId })` synchronously from the action gesture. This preserves the narrow permission and global-panel architecture on supported browsers, but drops promised Chrome 114–115 compatibility.
2. Retain Chrome 114 and automatic panel opening, but add persistent or optional HTTP(S) host access (and any tab metadata permission needed by the chosen flow). This can restore injection/capture, but violates the exact permission list and no-broad-host-access security contract.
3. Retain Chrome 114 and narrow permissions, but require another qualifying action, context-menu, keyboard, popup, or manual-panel gesture before Enable. This avoids broad host access, but replaces the confirmed one-action global-side-panel workflow and its acceptance UX.

Changes: no product source, canonical plan, progress, or lifecycle state was changed after diagnosis. All T02 implementation remains preserved in `README.md`, `package.json`, `browser-extension/`, `extensions/pi-web-annotator/`, `tests/browser/`, `tests/bridge/`, `tests/bundle/`, and `tests/fixtures/`, along with Attempt 1's passing evidence. The three unrelated protocol-migration files remain byte-for-byte untouched.

Checks: screenshot and reproduction context traced to the exact browser source path above; official Chrome API references and the Chromium extension-team discussion corroborate the mismatch. Preserved evidence remains `node --test` 54/54, the browser/extension JavaScript syntax sweep, actual Pi package discovery and non-TUI command smoke checks, the 17-file package dry run, temporary-repository/loopback integration coverage, focused T02 PASS review, and compact spec/Markdown/diff validation. These checks remain useful but their active-tab double does not reproduce this live API path; the final whole-plan gate remains UNVERIFIED.

Failures: the first required live scenario fails before annotation enablement, so later screenshot, standalone, bridge, fallback, and retry scenarios remain blocked and are not claimed passed.

Blockers: no implementation can satisfy both the observed action/side-panel permission behavior and the canonical Chrome 114 plus exact-permission contract without a plan-level supported-environment, permission, or interaction decision. Slice 02.01 and T02 remain unchecked, `Current` remains `02.01`, and plan progress is unchanged. No completion wiki, final verification/outcome, lifecycle transition, archive preflight/archive, Dream, staging, commit, push, or deployment was performed.

Decision: the user explicitly confirmed formal same-item revision, directing planning to evaluate Chrome 116+ with `chrome.action.onClicked` plus synchronous `chrome.sidePanel.open()` while preserving the narrow permission boundary.

Transition proof:
- `uv run spec/scripts/manage-spec-item.py transition --help` exposed `revision_required` as a supported target.
- `uv run spec/scripts/manage-spec-item.py --root . transition --item 260916-1901-pi-web-annotator --to revision_required` succeeded from `planned` to `revision_required`.
- `item.yaml` now records `status: revision_required`; `spec/index.md` matches.
- Resolution with `--status planned` fails with exit 5 and the exact status mismatch; resolution with `--status revision_required` succeeds.
- `Current: 02.01`, the 02.01 executable checkbox, T02, and plan progress remain unchanged and unchecked. The preserved implementation attempt is frozen pending same-item reconciliation.

Exact next action: `/skill:grill-with-docs 260916-1901-pi-web-annotator`.

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

On success, record changed paths, complete acceptance, check results, both review verdicts, and residual uncertainty. Check 02.01 in `implementation/index.md`, check T02 in `plan.md`, and set Current to `complete` only after whole-plan evidence passes. Consolidate `verification.md`, then follow the implementation workflow's explicit completion-archive approval gate. Request a user-controlled Git checkpoint and suggest Dream without invoking either.
