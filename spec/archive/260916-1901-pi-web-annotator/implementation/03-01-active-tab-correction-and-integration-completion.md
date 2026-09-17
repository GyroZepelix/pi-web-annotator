# Slice 03.01: Active-tab correction and integration completion

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T03 - Correct toolbar authorization and complete the integrated package`
Assurance: medium - the slice corrects completed browser-action behavior and finishes authenticated local IPC and filesystem integration, while failures remain local and retryable.
Review required now: focused final-segment review plus final whole-contract review

## Outcome

Current Chrome/Chromium proper and Brave grant temporary tab access from the extension toolbar action, open the global side panel, and retain the explicit Enable step. The preserved standalone and Pi bridge workflows then pass complete automated, package, dual-browser, review, verification, and completion gates.

## Why this slice exists now

R001 proved that the old automatic panel-opening path did not grant `activeTab`. Completed packet `01.01` and frozen attempted packet `02.01` contain reusable implementation and evidence, but neither can be rewritten or executed. One fresh corrective session can repair the action boundary, reconcile preserved bridge work, and obtain the final integrated proof without manufacturing another dependency boundary.

## Relevant context

- Requirements 2, 3, and 10 plus Decision D10 govern the browser correction.
- Requirements 1 and 5-10 govern reconciliation and final acceptance of the preserved T02 implementation.
- [R001](../refinements/R001.md) is applied reasoning; `plan.md` is authoritative.
- `02.01` is frozen evidence. Preserve its source work where it satisfies the revised plan, but do not edit that packet.
- Parent-plan sections to load on conflict or uncertainty: Requirements, Design, Decision Log, Work breakdown, Acceptance criteria, Testing decisions and seams, Verification plan, Risks and blockers.

## Constraints and non-goals

- Set the browser API floor to Chrome 116 and document Brave 1.95.101+ support on macOS.
- Handle `chrome.action.onClicked(tab)` and call global `chrome.sidePanel.open({ windowId: tab.windowId })` from that user gesture. Do not rely on automatic `openPanelOnActionClick` for authorization.
- Keep **Enable annotation on this page** separate. Do not inject or enable merely because the toolbar action was clicked.
- Preserve exactly `activeTab`, `scripting`, `sidePanel`, and `storage`, plus only `http://127.0.0.1:43127/*`. Do not add persistent HTTP(S), all-sites, or broad tab access.
- Every new tab requires toolbar authorization and Enable. Navigation invalidates injected mode; access-revoking navigation also requires a fresh toolbar action.
- Preserve standalone fallback, retryable browser state, bridge trust boundaries, atomic save behavior, schema-v1 bundles, and all scope exclusions.
- Do not add dependencies, rewrite completed/frozen packets, discard preserved T02 source, or broaden support beyond Chrome/Chromium proper and the confirmed Brave range.

## Expected source and test areas

- `browser-extension/manifest.json`
- `browser-extension/service-worker.js`
- `browser-extension/sidepanel.js`
- `tests/browser/manifest.test.js`
- `tests/browser/service-worker.test.js`
- `README.md`
- Preserved T02 areas under `browser-extension/lib/`, `extensions/pi-web-annotator/`, `tests/bridge/`, `tests/bundle/`, and `tests/fixtures/`
- Final `verification.md`, `outcome.md`, and completion lifecycle artifacts when all gates pass

These paths are navigation hints. Inspect another source or test only when Current or a credible regression path requires it.

## Acceptance and checks

- Acceptance: an action click on an ordinary HTTP(S) page supplies the authorized tab, opens the global panel synchronously, and allows the later explicit Enable action to inject without missing URL/title metadata.
- Acceptance: the panel does not auto-enable; new tabs and access-revoking navigation require a fresh toolbar action; all new documents require Enable; restricted pages fail clearly without losing pending state.
- Acceptance: the manifest declares minimum Chrome 116 and the exact unchanged permission/host set.
- Acceptance: tests reproduce the prior no-grant metadata failure and cover action event, already-open global panel, new tabs, same-origin and cross-origin navigation, restricted pages, and service-worker replacement.
- Acceptance: the preserved standalone and bridge implementations satisfy every revised plan requirement, including authentication, bounds, destination confirmation, `.gitignore`, atomic save, fallback, retry, and later path-based intake.
- Acceptance: the affected and complete manual checklist passes on macOS in current Chrome/Chromium proper and Brave 1.95.101+; record exact browser and macOS versions and honest residual uncertainty.
- Check: `node --test`
- Check: `find browser-extension extensions -name '*.js' -print0 | xargs -0 -n1 node --check`
- Check: actual Pi package discovery/load and non-TUI `/annotate` refusal smoke checks.
- Check: `npm pack --dry-run --json`
- Check: temporary-repository and loopback integration scenarios for authentication, schema/size/path rejection, no-overwrite, atomic save, `.gitignore`, timeout, cancel, shutdown, bridge loss, and retry.
- Check: `uv run spec/scripts/manage-spec-item.py --root . validate --item 260916-1901-pi-web-annotator`
- Check: changed Markdown link and fence validation plus `git diff --check`.

## Review gate

Run one focused review over the R001 action correction and its integration with retained T01 and frozen T02 work. Then run one final contract-quality review over the complete revised implementation, all requirements and exclusions, dual-browser evidence, tests, documentation, lifecycle evidence, and residual uncertainty. Reviewers apply the credible-harm blocker standard and do not expand the plan. Implement may rerun an affected gate at most twice after targeted corrections.

## Attempt log

### Attempt 1 - 2026-09-16T20:08:43Z

Starting HEAD: `787bb2d4265347b3253f41c3c3b031d5b953a508`

Changes: corrected toolbar authorization to use `chrome.action.onClicked(tab)` with synchronous global `chrome.sidePanel.open({ windowId: tab.windowId })`; removed automatic panel behavior; set Chrome 116; documented Brave 1.95.101+ and the exact permissions; added action-grant, missing-metadata, already-open panel, navigation, new-tab, restricted-page, and worker-replacement tests; preserved and reconciled the T02 bridge, filesystem, package, fallback, retry, schema-v1, and path-intake work.

Checks: `node --test` passed 59/59; browser/extension JavaScript syntax passed; `npm pack --dry-run --json` exposed the expected 17 files; isolated Pi RPC loading discovered `/annotate` and produced the required non-TUI refusal; temporary-repository and real-loopback integration scenarios passed in the full suite; spec validation, Markdown links/fences, `git diff --check`, and protected-path hashes passed. Focused final-segment review passed with no findings. Initial final whole-contract review found no source or contract blocker but returned `UNVERIFIED` because required live evidence is absent.

Failures: one test-only cross-realm deep-equality assertion failed on structurally identical values; it was replaced by primitive assertions and all affected and full checks passed. No source failure remains.

Blockers: the required affected manual matrix has no passing evidence for current Chrome/Chromium proper or corrected Brave 1.95.101+ on macOS. Frozen packet 02.01 remains regression-only evidence for the old `openPanelOnActionClick` failure. Progress, verification consolidation, wiki updates, outcome, and archival remain unchanged.

Exact next action: run the complete README macOS dual-browser checklist in current Chrome/Chromium proper and Brave 1.95.101+, then provide the exact macOS/browser versions and per-scenario pass/fail notes for final review rerun.

### Attempt 2 - 2026-09-16T20:25:24Z

Starting HEAD: `787bb2d4265347b3253f41c3c3b031d5b953a508`

Changes: failing screenshot `/var/folders/dg/j85rf8f95vd7c73yr2z4zmq80000gn/T/pi-clipboard-c137776f-365a-4790-8a29-4553cae76e54.png` from Brave 1.95.101 / Chromium 153.0.8010.37 on macOS 26 Tahoe showed that action, Enable, and target selection now worked, but text typed into `Describe the requested change or observation...` cleared after 1-2 seconds. Diagnosis: the disconnected bridge handshake can resolve after its 1500 ms timeout, and both bridge-status updates and `STATE_CHANGED` refreshes call `render()`; `renderDrafts()` then destroyed and recreated every form and textarea. `browser-extension/sidepanel.js` now keys draft views by stable `selectionId`, reuses unchanged controls without mutating their container, and removes or replaces controls only when state removes the draft or supplies a genuinely new selection. `tests/browser/sidepanel.test.js` reproduces repeated bridge polling and cloned-state refresh while typing, then covers target replacement and removal.

Checks: affected browser tests passed 12/12; full `node --test` passed 60/60; browser/extension JavaScript syntax, spec-item validation, `git diff --check`, and all protected-path hashes passed. Focused review retry 1 passed with no blockers. It noted only pre-existing non-blocking annotation-edit rerender behavior and submit-button polish outside this targeted correction.

Failures: live Brave acceptance remains failed at the captured pre-fix comment-clearing behavior; no post-fix manual result exists.

Blockers: the corrected comment-draft behavior still requires live retest, and the complete Chrome/Chromium-proper plus Brave matrix remains open. The affected final whole-contract review must be rerun only after that evidence arrives. Progress, verification consolidation, wiki updates, outcome, and archival remain unchanged.

Exact next action: reload the unpacked extension in the same Brave environment; with no bridge running, type continuously in a selected target comment for at least 12 seconds and confirm text, focus, and caret survive the initial handshake and two status polls; then start and stop `/annotate` while text remains, replace the selected target and confirm the old text clears, and verify accept and confirmed cancel remove their drafts before continuing the full dual-browser checklist.

### Attempt 3 - 2026-09-16T20:29:01Z

Starting HEAD: `787bb2d4265347b3253f41c3c3b031d5b953a508`

Changes: no standalone-picker source change was made. Failing screenshot `/var/folders/dg/j85rf8f95vd7c73yr2z4zmq80000gn/T/pi-clipboard-db823768-9d56-43ce-9dca-397cdb8bb9e4.png` from Brave 1.95.101 / Chromium 153.0.8010.37 on macOS 26 Tahoe shows one accepted pending annotation retained after Finish reports that the File System Access directory picker is unavailable. The current side-panel path correctly feature-detects `window.showDirectoryPicker` and, when present, calls `showDirectoryPicker({ mode: "readwrite" })` synchronously before its first `await`; the observed method is absent from this Brave context rather than delayed or called from the wrong context.

Checks: the prior draft-preservation correction remains covered by affected tests (12/12), the full suite (60/60), syntax, spec validation, diff checks, protected hashes, and focused review retry 1 PASS. For picker diagnosis, Brave's original removal decision is documented at `https://github.com/brave/brave-browser/issues/11407`; its still-open picker failure is `https://github.com/brave/brave-browser/issues/29411`; Chrome's File System Access documentation explicitly names Brave as an exception; and Brave 1.95.101 source disables `FileSystemAccessLocal` unless `blink::features::kFileSystemAccessAPI` is enabled while exposing the desktop `brave://flags/#file-system-access-api` opt-in. MDN confirms that `showDirectoryPicker` is a limited-availability, secure-context API requiring transient user activation, which the current direct click path already preserves.

Failures: standalone Finish cannot satisfy Requirement 6 or the required Brave manual matrix in default Brave 1.95.101 because the browser disables the required API. The pending annotation is correctly retained, but no directory can be selected or bundle written.

Blockers: this is a material plan/source conflict, not a conventional Current-owned call-path defect. Supporting default Brave standalone save requires changing at least one confirmed contract boundary: require and document a Brave experimental flag; make Brave bridge-only; add a downloads permission and change destination/output semantics; add a second user-gesture save surface; or use excluded native-host/archive behavior. These change supported-environment, permissions, UX, output, or architecture requirements. The draft-preservation source/test work is preserved, but this attempt is frozen pending a same-item decision; all progress, segment gates, verification consolidation, wiki updates, outcome, and archival remain unchanged.

Exact next action: decide whether the canonical contract is wrong and approve formal same-item revision to reconcile Brave standalone support; otherwise explicitly confirm the existing contract remains correct and provide a plan-conforming supported path that does not change permissions, output, architecture, or UX.

#### Material blocker evidence - Brave standalone picker

**Exact reproduction:** On macOS 26 Tahoe in Brave 1.95.101 / Chromium 153.0.8010.37, with the Pi bridge disconnected and one accepted pending annotation, clicking **Finish and save...** produced `This Chrome context does not provide the File System Access directory picker.` Screenshot: `/var/folders/dg/j85rf8f95vd7c73yr2z4zmq80000gn/T/pi-clipboard-db823768-9d56-43ce-9dca-397cdb8bb9e4.png`. The pending annotation remained visible, so retry state was preserved, but standalone save could not begin.

**Completed draft-reset correction, tracked separately:** The preceding 1-2 second comment reset was traced to bridge/status refreshes rebuilding the selected-target textarea. `browser-extension/sidepanel.js` now reuses draft controls by stable `selectionId`, and `tests/browser/sidepanel.test.js` covers repeated polling, cloned state refresh, target replacement, and removal. Affected tests passed 12/12, the full suite passed 60/60, syntax/spec/diff/protected-hash checks passed, and focused review retry 1 returned PASS. Live post-fix retest remains pending and is not inferred from those checks.

**Current source path:** `browser-extension/sidepanel.js` feature-detects `window.showDirectoryPicker`; the Finish click directly invokes `window.showDirectoryPicker({ mode: "readwrite" })` before its first `await`. The screenshot therefore reflects API absence in the side-panel `Window`, not a lost user gesture, delayed call, bridge branch, or missing manifest permission. No picker behavior was changed.

**Authoritative browser evidence:**

- Brave's original decision to disable the native/File System Access API is `https://github.com/brave/brave-browser/issues/11407`.
- The still-open Brave report reproducing `window.showDirectoryPicker` as unavailable while Chrome/Chromium works is `https://github.com/brave/brave-browser/issues/29411`.
- Chrome's File System Access documentation at `https://developer.chrome.com/docs/capabilities/web-apis/file-system-access` states that Brave is a notable exception and exposes the API only behind a flag.
- Brave 1.95.101 source at `https://raw.githubusercontent.com/brave/brave-core/v1.95.101/renderer/brave_content_renderer_client.cc` disables `FileSystemAccessLocal` and `FileSystemAccessAPIExperimental` unless `blink::features::kFileSystemAccessAPI` is enabled. Its `about_flags.cc` at `https://raw.githubusercontent.com/brave/brave-core/v1.95.101/browser/about_flags.cc` exposes the desktop `file-system-access-api` flag.
- MDN at `https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker` classifies `showDirectoryPicker` as limited availability and requires secure context plus transient user activation. The current direct click path already satisfies the activation requirement when the API exists.

**Contract conflict:** Requirement 6 mandates that disconnected side-panel Finish call `showDirectoryPicker({ mode: "readwrite" })`, select a project root, update that root's `.gitignore` only with consent, and write the schema-v1 directory manifest-last. Requirement 2 and the final manual matrix promise Brave 1.95.101+ support and require File System Access standalone save to pass there. Default Brave 1.95.101 omits the only API selected by that contract, so both requirements cannot pass simultaneously under the confirmed environment. A permission tweak cannot expose a Blink API that the browser disables.

**Smallest viable fallbacks and consequences:**

1. **Require `brave://flags/#file-system-access-api`:** preserves current code, permissions, directory output, manifest-last validity, and retry behavior, but changes the supported-environment and installation UX to require an experimental browser-wide flag and relaunch. Default Brave remains unsupported.
2. **Make Brave bridge-only:** preserves exact permissions and atomic schema-v1 project output through `/annotate`, but removes the promised disconnected standalone workflow for Brave. Recovery after bridge loss becomes restart-and-reconnect only; the documented standalone retry path no longer exists for that browser.
3. **Add browser download output:** using `chrome.downloads` requires a new manifest permission and cannot preserve selection of an arbitrary project root, project-root `.gitignore` handling, directory-level visibility, or current no-overwrite/manifest-last recovery semantics without further UX and output redesign. A single downloadable ZIP would also violate the explicit no-ZIP contract; multiple downloads can expose partial output.
4. **Add another extension tab/window or picker page:** this introduces a second user gesture and new save UX because transient activation cannot be forwarded. It still does not solve default Brave's browser-wide API disablement; combined with the Brave flag it reduces to fallback 1.
5. **Add a native host or permanent local writer:** this could restore direct filesystem output and atomic recovery, but requires native-messaging permission, installation infrastructure, and an architecture expressly excluded by the plan.
6. **Use `<input webkitdirectory>`:** this is not a viable save fallback because it supplies selected files for reading, not a writable directory handle; it cannot create `.pi-annotations/`, update `.gitignore`, or perform manifest-last writes.

**Preserved implementation and evidence:** The action authorization correction, exact narrow permissions, selected-target draft fix, browser session retry state, bridge authentication and fallback, standalone filesystem validator/writer, schema-v1 bundle, tests, and all protected protocol/history paths remain unchanged. Passing evidence remains: full suite 60/60, affected draft tests 12/12, JavaScript syntax, package/Pi loader evidence from Attempt 1, temporary-repository and loopback integration, spec validation, Markdown/diff checks, exact protected hashes, and focused review retry 1 PASS. The picker failure does not clear browser state or invalidate unrelated automated evidence.

**Lifecycle state:** Current remains `03.01`; its checkbox, T03, final verification, wiki update, outcome, and archive are unchanged. No Dream, stage, commit, push, dependency, migration, or picker-source change occurred.

**Decision required:** The user must decide whether the canonical contract is wrong and approve formal same-item revision. Revision must choose the supported Brave boundary and corresponding standalone UX/output/permission/architecture consequences before implementation resumes. If revision is declined, the existing contract can continue only if the user identifies a plan-conforming path that works in default Brave without changing those boundaries.

**User decision received:** The user declined formal revision and said exactly, `no we are going to fix it directly`. This does not identify a path that can satisfy Requirement 6 in default Brave while preserving the confirmed supported environment, standalone project-root directory output, exact permissions, one-gesture side-panel UX, and architecture. It also does not explicitly confirm that the existing canonical contract remains correct and that a concrete plan-conforming implementation is safe. Execution therefore remains blocked: no picker behavior or fallback may be implemented from this response, and Current/T03 progress plus lifecycle state remain unchanged.

**Exact decision needed to resume:** either (1) approve formal same-item revision and select a revised Brave standalone boundary, or (2) explicitly confirm that the existing canonical contract remains correct and identify the concrete default-Brave mechanism that provides a writable project-root directory handle from the side-panel Finish gesture without changing permissions, UX, output, or architecture.

**Formal revision decision and transition proof:** The user subsequently explicitly confirmed formal same-item revision for `260916-1901-pi-web-annotator`. They did not select a canonical Brave fallback boundary; Grill must keep open whether the reconciled contract uses a required flag, bridge-only behavior, changed support, permissions, output, or another approach. `uv run spec/scripts/manage-spec-item.py transition --help` exposed `revision_required`. The helper then transitioned the item from `planned` to `revision_required`. Re-reading `item.yaml` proved `status: revision_required`; explicit resolution with `--status revision_required` succeeded; explicit resolution with `--status planned` failed with exit 5 and reported the status mismatch. The preserved implementation attempt is frozen pending same-item reconciliation. Current remains `03.01`, 03.01 and T03 remain unchecked, and no plan/source/test/wiki/completion/archive change was made by revision entry.

**Exact revision handoff:** `/skill:grill-with-docs 260916-1901-pi-web-annotator`

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

On success, record changed paths, revised action and complete integration acceptance, all check results, both review verdicts, dual-browser evidence, and residual uncertainty. Check `03.01` in `implementation/index.md`, check T03 in `plan.md`, set Current to `complete`, consolidate `verification.md`, and follow Implement's explicit completion-archive approval gate. Do not modify packets `01.01` or `02.01`. Request a user-controlled Git checkpoint and suggest Dream without invoking either.
