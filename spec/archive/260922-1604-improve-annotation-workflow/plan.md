# Plan: Improve annotation workflow

Work item: `260922-1604-improve-annotation-workflow`
Status: Planned
Created: 2026-09-22
Updated: 2026-09-22

Assurance: medium - the change coordinates content-script interaction state, side-panel draft identity, service-worker persistence, and screenshot timing. Regressions could discard local input, intercept unintended clicks, or capture the wrong visual state, while failures remain local and recoverable.

## Goal

Let one browser annotation session move safely across page states and subpages: the user can pause click interception to operate the site, explicitly resume selection, capture UI that appears only while re-hovering a selected target, return from accepted annotation cards to exact live targets, and edit accepted comments without background refreshes discarding work.

## Context

- Current selection mode intercepts every selectable page click until the document is disabled, so ordinary site navigation is unavailable while annotation is enabled.
- Current capture begins only after the user moves to the side panel and accepts a comment, so site-owned hover UI may disappear before the screenshot.
- Current accepted annotation cards are rebuilt on every render; five-second bridge polling therefore closes an editor and discards its unsaved text.
- Accepted annotations store bounded selector evidence, but current-snapshot evidence does not guarantee safe reattachment after document replacement. Highlight must use exact live runtime identity instead of selector guessing.
- The confirmed discovery contract is [discovery.md](./discovery.md). Existing Brave/macOS support, explicit authorization, bridge saving, and schema-v1 bundle behavior remain authoritative.

## Requirements

1. **Pause and Resume**
   - Expose Enable, Pause, or Resume for the current active document through the side panel.
   - Pause must stop candidate outlining and click interception while retaining accepted annotations, screenshots, the same-document selected target, and its in-progress textarea value.
   - Resume must restore selection listeners on that same document without replacing the selected target or draft.
   - Navigating to a new document must retain accepted evidence, remove only the stale unaccepted target for the replaced document, and leave annotation unavailable until explicit Enable. Access-revoking navigation must continue to require a fresh toolbar action.
   - Persist per-document active or paused mode in browser session state so worker suspension and unrelated side-panel refreshes render the correct control state. Treat older enabled entries without a mode as active.

2. **Armed hover capture**
   - Require a selected target and non-empty bounded comment before arming capture.
   - While armed, suspend candidate selection and watch only the original selected element or its descendants. Trigger at most one capture after the pointer remains over that target continuously for 750 milliseconds.
   - At capture time, preserve the page-owned hover state, apply only the selected-target capture outline, wait for paint, capture the visible viewport, and restore extension-owned styling.
   - Add exactly one annotation only after the PNG passes existing bounds and session persistence succeeds.
   - Cancel, Pause, navigation, target detachment, screenshot failure, image-limit failure, or storage failure must create no partial annotation. Retain the comment and draft for retry when its source document and target remain valid; otherwise report that reselection is required.
   - Arming and capture completion must be one-shot and identity-checked so repeated hover events or messages cannot create duplicate screenshots or annotations.

3. **Stable accepted-comment editing**
   - Render accepted annotation cards through annotation-ID-keyed stable views instead of rebuilding the complete list on every poll.
   - Preserve an open editor's text, focus, caret, and control identity across bridge polling and unrelated state refreshes.
   - Save edit must validate and persist the comment without recapturing. Keep original must discard only that edit draft. Deletion, session cancellation, or actual annotation removal may dispose of the keyed view.

4. **Exact live-target Highlight**
   - Add a Highlight action to every accepted annotation card.
   - Associate each accepted annotation ID with the exact live DOM element used for its screenshot inside that document's content-script runtime. Do not persist DOM identity into the bundle or resolve a replacement element from stored CSS or XPath after navigation.
   - Permit Highlight only when the exact source document is still installed in the current active tab. If it is in a background tab, instruct the user to switch tabs; if the document or element is gone, report Highlight as unavailable.
   - On success, immediately center the element in the viewport, apply a strong temporary outline for 2 seconds, then restore its original inline outline and offset.
   - Highlight must work while annotation is paused without resuming selection, mutating session or annotation data, changing comments, or recapturing a screenshot.

5. **Interaction-state integrity**
   - Coordinate hover, capture, and Highlight outlines so overlapping operations cannot leave stale decoration or overwrite the page's original inline styles. Capture takes precedence over temporary candidate or Highlight decoration.
   - Keep strict runtime message shapes, sender document checks, active-tab checks, and the existing serialized operation queue for every new action and page-originated capture event.
   - Preserve session limits, retry behavior, save revision checks, and full teardown on Cancel or successful Finish.

6. **Compatibility and documentation**
   - Keep the dependency-free runtime, deterministic extension ID, exact manifest permissions and host access, Brave/macOS support boundary, schema-v1 manifest, one-PNG-per-annotation contract, bridge protocol, save behavior, and privacy filtering unchanged.
   - Update README workflow, troubleshooting, and live verification guidance for Pause/Resume, armed re-hover capture, stable editing, and current-tab exact-live Highlight.
   - Update `wiki/browser-annotator.md` only after implementation and verification establish the new current behavior.

## Out of scope

- Automatic annotation enablement or resume after navigation.
- Automatic switching to a source tab when Highlight is clicked.
- Best-effort selector reattachment or Highlight after the original document is replaced.
- Generic forcing or emulation of arbitrary site `:hover` CSS state.
- Recapturing screenshots when only an accepted comment is edited.
- Manifest permission expansion, bundle or bridge schema changes, dependencies, migrations, browser-restart recovery, or broader browser/platform support.

## Assumptions

- One trusted local user operates the existing unpacked Brave companion and one annotation session at a time.
- A 750-millisecond continuous target hover is sufficient for the supported live acceptance page to expose its delayed hint; revisit only if live evidence shows a longer deterministic interval is required.
- A 2-second centered Highlight is long enough to identify a target without leaving persistent decoration; revisit only if live use shows it is materially disruptive or too brief.
- Exact live-target identity lasts only for the current content-script document lifetime. Worker suspension may occur, but document replacement, content-script loss, or target detachment makes Highlight unavailable rather than triggering selector reattachment.

## Design

### Content-script interaction state

- Separate temporary interaction suspension from full teardown. Pause removes selection listeners and candidate decoration but retains the selected element and selection identity; full disable continues to clear all document-local state.
- Model active selection, paused selection, armed capture, capture paint, and Highlight as explicit states or coordinated operations rather than overloading the existing `enabled` boolean.
- During armed capture, suppress candidate replacement, track continuous pointer presence over the selected element or a descendant, reset the settle timer on leave, and emit one identity-bearing ready event.
- Retain accepted annotation targets in a document-local map keyed by annotation ID. Highlight resolves only through that map.
- Centralize outline ownership and cleanup so hover, capture, and Highlight restore the original inline outline and outline-offset exactly, including cancellation, timeout, replacement, and teardown paths.

### Service-worker orchestration

- Extend internal session entries with backward-compatible active/paused and armed-draft metadata without changing the exported bundle schema.
- Add strict Pause, Resume, Arm, Cancel armed capture, capture-ready, and Highlight actions. Validate tab ID, document ID, page ID, selection ID, annotation ID, active-tab status, and allowed state transitions before side effects.
- Refactor immediate comment acceptance into an armed flow: persist the validated comment and armed identity, receive one ready event from the exact source document, capture and validate the PNG, bind the resulting annotation ID to the live target, save the annotation, and clear only the completed draft.
- Serialize capture completion through the existing operation queue and reject stale or duplicate ready events. On recoverable failure, disarm and retain retryable draft data.
- For Highlight, find the annotation's page, require its enabled entry to match the current active source tab and document, then ask that content script to scroll and flash the registered target. Return precise background-tab, replaced-document, detached-target, and runtime-unavailable errors.

### Side-panel stability and controls

- Render the current-document action as Enable, Pause, or Resume from persisted document mode.
- Keep draft cards keyed by selection ID and add armed/cancel state without replacing the textarea or losing its local value.
- Keep accepted annotation cards keyed by annotation ID. Switch a stable card between display and edit modes while retaining unsaved editor state across renders.
- Add Highlight beside Edit and Delete. Keep it visible for every accepted annotation, but surface worker-provided availability guidance without mutating the card or session.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| P001 | Pause lifecycle | Pause only the current document, retain same-document draft work, and require explicit Enable after navigation. | Restores normal site operation without surprising interception or broadening permissions. | Discovery D002, D005, D006. | Explicit resume is proven materially obstructive in supported live use. |
| P002 | Hover capture | Arm after comment entry and capture once after 750 ms of continuous re-hover on the original target. | Preserves transient hover UI without shortcut collisions or countdown pressure. | Discovery D003; approved direct contract. | Live hover hints consistently need a different deterministic settle interval. |
| P003 | Edit stability | Use stable annotation-ID-keyed views and persist edits only on Save edit. | Prevents bridge polling from replacing the editor or discarding user input. | Discovery D007; existing selected-target keyed-view pattern. | Editing intentionally becomes autosave. |
| P004 | Highlight identity | Use exact document-local DOM identity, current active tab only, with centered 2-second temporary outline. | Avoids silently highlighting the wrong element and avoids unexpected tab switching or persistent page decoration. | Discovery D008-D010; To Spec bounded decision, 2026-09-22. | Cross-document reattachment or automatic source-tab activation becomes explicit scope. |
| P005 | Compatibility | Keep permissions, bridge and bundle schemas, supported environment, and dependency policy unchanged. | The requested workflow can be implemented inside existing extension boundaries. | Discovery constraints; current manifest and runtime source. | Source evidence proves a confirmed behavior requires a broader boundary. |
| P006 | Execution mode | Implement directly in one coherent session. | The affected browser components share one state machine and existing deterministic seams; no migration, dependency, or costly independent boundary requires slicing. | Current source and tests; approved To Spec preview. | Implementation reveals a separately deployable or unsafe-to-combine boundary. |

## Work breakdown

- [x] T01: Deliver the complete annotation interaction workflow improvement.
  - Depends on: none
  - Scope: implement Pause/Resume, armed hover capture, stable accepted-comment editors, exact live-target Highlight, deterministic state cleanup, focused tests, user documentation, live Brave verification, and post-verification wiki update.
  - Expected areas: `browser-extension/content-script.js`, `browser-extension/service-worker.js`, `browser-extension/sidepanel.js`, `browser-extension/sidepanel.html`, `browser-extension/sidepanel.css`, internal browser state helpers/constants only as needed, `tests/browser/`, `README.md`, and `wiki/browser-annotator.md` after verification.
  - Acceptance: every criterion below passes without dependency, permission, schema, bridge, save, or supported-environment changes.
  - Verification: focused browser tests during implementation, then the complete automated, syntax, packaging, spec, diff, review, and live Brave checks in this plan.

## Acceptance criteria

- On an enabled page, Pause removes extension outlines and lets ordinary page controls and links behave normally while accepted evidence and the same-document selected target/comment remain available.
- Resume on the same document restores selection. Full navigation retains accepted annotations, drops only the stale unaccepted target, and requires explicit Enable; cross-origin navigation still requires a toolbar grant first.
- A non-empty comment can be armed, the original target can be re-hovered without selecting a different element, and one screenshot is captured after 750 ms with both site-owned hover UI and the target capture outline visible.
- Cancelling or failing armed capture creates no annotation or screenshot and retains retryable input when the target remains valid. Duplicate ready events cannot create duplicate annotations.
- Editing `annotation-0001` remains open with unchanged text, focus, caret, and DOM control identity through at least two bridge polls and unrelated state refreshes, then Save or Keep original has the specified effect without recapture.
- Every accepted annotation card exposes Highlight. On the current active exact source document, it centers and outlines the correct live target for 2 seconds, then restores original styles.
- Highlight while paused does not resume interception or mutate browser state. Background-tab, replaced-document, detached-target, and missing-runtime cases fail clearly without guessing or changing annotations.
- Multiple accepted targets remain independently highlightable, and hover, capture, and Highlight cleanup leave no stale extension styling.
- Existing action authorization, navigation retention, bridge save/loss/reconnection, standalone capability handling, bundle validation, schema-v1 intake, permission, identity, and packaging regressions continue to pass.
- README and, only after verified implementation, the browser annotator wiki accurately describe the delivered behavior and limits.

## Testing decisions and seams

- Extend the service-worker VM harness for new strict messages, persisted mode transitions, armed identity, capture sequencing, duplicate suppression, navigation cleanup, exact-document and active-tab Highlight gating, and no state mutation during Highlight.
- Extend the side-panel fake DOM harness with event dispatch, selection/caret support as needed, stable annotation views, Pause/Resume labels, armed/cancel controls, Highlight dispatch, and editor persistence across timed polling and state refreshes.
- Add a focused content-script VM/DOM harness if existing worker doubles cannot prove listener suspension, continuous target re-hover, settle cancellation, exact target mapping, scroll invocation, outline precedence, and restoration of original inline styles.
- Keep schema and bundle fixtures unchanged. Use the complete bundle suite as regression evidence that internal armed or document state does not enter exported schema v1.
- Use a real HTTP(S) page in Brave with a delayed hover hint for browser-only evidence that mocks cannot prove: pointer-driven hover retention during capture, side-panel interaction, active-tab capture, scrolling, and visual outline cleanup.
- Medium assurance requires one coherent-boundary review over the content-script/service-worker/side-panel interaction and tests, followed by one final contract-quality review over the complete diff and verification evidence.

## Verification plan

- Run focused browser tests while implementing, including any new content-script harness:
  - `node --test tests/browser/sidepanel.test.js tests/browser/service-worker.test.js tests/browser/content-script.test.js` when the new file exists, otherwise the exact affected browser test files.
- Run the complete automated suite: `node --test`.
- Run JavaScript syntax checks: `find browser-extension extensions -name '*.js' -print0 | xargs -0 -n1 node --check`.
- Run `npm pack --dry-run --json` and confirm existing runtime assets remain included with no spec, wiki, tests, or generated captures packaged.
- In current supported Brave on macOS, reload the unpacked extension and record:
  - Pause permits real controls and link navigation; accepted annotations remain and the destination requires explicit Enable.
  - Resume preserves a same-document draft.
  - A delayed hover hint remains visible in the captured PNG after armed re-hover.
  - Cancel and forced failure retain retryable input without a partial annotation.
  - Multiple annotations Highlight their own targets; background/stale targets provide guidance; Highlight works while paused and cleans up after 2 seconds.
  - An edit remains intact and focused for longer than the five-second bridge polling interval and survives unrelated state refresh.
- Run the coherent-boundary review and resolve every confirmed contract violation, then run the final contract-quality review and resolve every confirmed blocking finding.
- Run `uv run spec/scripts/manage-spec-item.py --root . validate --item 260922-1604-improve-annotation-workflow`.
- Resolve changed Markdown links, confirm fenced-code balance and ASCII/plain-text consistency, and run `git diff --check`.

## Risks and blockers

- **Hover timing and capture race:** page hints may animate or delay while repeated pointer events arrive. Mitigation: require continuous identity-checked hover for one deterministic interval, use a one-shot armed state, wait for capture paint, and verify on a real delayed hint.
- **State loss across refresh or worker suspension:** panel-local text and worker state can diverge. Mitigation: preserve keyed views, persist mode and armed comment metadata, default older state safely, and test worker replacement plus unrelated refreshes.
- **Incorrect or stale Highlight:** stored selectors could identify another element after page changes. Mitigation: never reattach by selector; require the exact document, current active tab, and document-local annotation-to-element mapping.
- **Outline interference:** hover, capture, Highlight, cancellation, or teardown could restore the wrong style. Mitigation: centralize outline ownership and precedence, preserve original property values and priorities, and test overlap plus every cleanup path.
- **Navigation races:** Pause, armed capture, or Highlight may race document replacement. Mitigation: validate tab/document/selection identity immediately before side effects and treat missing content-script targets as non-destructive unavailability.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete.
- [x] Verification complete.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/260922-1604-improve-annotation-workflow/item.yaml and plan.md completely.
Implement direct-mode task T01 step by step while preserving Requirements, Out of scope, Decision Log, and Verification plan.
Use discovery.md only as supporting evidence; plan.md is the implementation contract.
Update Progress and the Decision Log when confirmed implementation discoveries change the approach.
Run focused checks during implementation and every specified final verification and review before reporting completion.
Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, production actions, or scope expansion.
```

## Proposed durable knowledge updates

After implementation and verification establish current behavior, update `wiki/browser-annotator.md` with the per-document Pause/Resume lifecycle, armed re-hover capture flow, exact current-tab live-target Highlight boundary, stable accepted-comment editing, and corresponding verification seams. Do not present planned behavior as current before it passes verification.
