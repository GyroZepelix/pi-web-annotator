# Discovery: Improve annotation workflow

Work item: `260922-1604-improve-annotation-workflow`
Status: Ready for Spec
Created: 2026-09-22
Updated: 2026-09-22

Assurance: medium - user-confirmed because the change crosses content-script interaction state, side-panel draft state, service-worker persistence, and screenshot timing. Failures remain local and reversible, but regressions could discard user input or capture the wrong visual state.

## Objective

Improve the active annotation workflow so normal page interaction can be temporarily restored, transient hover UI can be captured, accepted targets can be highlighted again from the side panel, and editing an existing comment is not interrupted by background refreshes.

## Desired outcome

One annotation session can collect evidence from several page states or subpages. A side-panel button pauses click interception so the user can operate and navigate the site normally, after which selection can be resumed deliberately. The user can arm capture, re-hover the selected target to expose transient UI, and capture that state. Each accepted annotation exposes a Highlight action that identifies its live page target when available. Editing an accepted annotation remains open until explicitly saving or cancelling the edit.

## Repository and domain context

- The guaranteed environment remains the unpacked Manifest V3 companion in Brave on macOS, with an authenticated Pi bridge for saving.
- The browser session already retains accepted annotations across enabled tabs and navigations. Each new document still requires explicit enablement, and access-revoking navigation requires a fresh toolbar action.
- The side panel owns controls and text entry; the content script owns page hover, selection, and capture outlines; the service worker owns session state and visible-tab screenshots.

## Scope

- Add an explicit way to pause and resume annotation interception while retaining the current annotation session.
- Support screenshot evidence of transient UI that appears only while a page element is hovered.
- Keep an in-progress edit of an accepted annotation stable across bridge polling and unrelated state refreshes.
- Add a Highlight action to accepted annotation cards so the user can identify the corresponding live element.
- Add focused deterministic tests and update user-facing workflow documentation for the confirmed behavior.

## Out of scope

- Generic emulation or permanent forcing of arbitrary site `:hover` CSS states.
- Automatic enablement on new documents, automatic resume after navigation, or broader persistent site permissions.
- Changing the schema-v1 bundle or recapturing screenshots when only an accepted comment is edited.
- Persisting an unaccepted target after its document has been replaced.
- Best-effort selector reattachment or Highlight after the original document has been replaced.
- Full browser-restart recovery or expanded browser/platform support.

## Confirmed facts and evidence

- Fact: while enabled, `content-script.js` listens in capture phase and calls `preventDefault()` plus `stopImmediatePropagation()` for every selectable click. There is no pause command; disablement currently occurs only when the session is cleared.
- Fact: navigation removes the enabled-document record and any draft for that document while retaining accepted annotations. Same-origin navigation can be enabled again under the existing grant; access-revoking navigation needs another toolbar action.
- Fact: target selection records DOM evidence but no image. The service worker captures the visible tab only when the side-panel form sends `ACCEPT_COMMENT`, after `PREPARE_CAPTURE` outlines the selected target.
- Fact: moving the pointer from the page to the side panel can remove site-owned hover UI before that capture.
- Fact: `renderAnnotations()` replaces the complete annotation list on every render. `refreshBridge()` runs every five seconds and calls `render()`, so any open editor and its unsaved text are discarded at the next poll or unrelated refresh. The observed one-to-two-second closure is consistent with opening the editor late in the polling interval.
- Fact: selected-target draft controls already use stable keyed views, preserving their text, focus, and identity across polling. The accepted-annotation editor has no equivalent stable state or test.
- Fact: current screenshot and bundle contracts allow one PNG per annotation and do not prescribe whether image capture occurs before or after comment entry, provided the annotation is committed only with valid evidence.
- Fact: every accepted annotation stores bounded CSS and XPath selectors plus target geometry, but the contract treats this as current-snapshot evidence and does not guarantee later reattachment.
- Fact: accepted annotation cards currently expose only Edit and Delete. The content script retains only the latest selected DOM element and has no message for locating or highlighting an accepted annotation target.

## Constraints and invariants

- Pausing must not clear accepted annotations, screenshots, or the active document's selected target and typed comment.
- Normal browsing while paused must not be intercepted or outlined by extension selection behavior.
- Navigation retains the annotation session and accepted evidence, discards only the stale unaccepted target from the replaced document, and leaves interception off until explicit Resume or Enable.
- A screenshot must still correspond to a specific target and contain the transient page state the user intended to document.
- Failed or cancelled capture must retain retryable user input and pending session state.
- Comment editing must remain explicit: no accepted comment changes until Save edit succeeds, and Keep original must discard only that in-progress edit.
- Highlight is available only for the exact still-live source document, scrolls the target into view, flashes a strong temporary outline, and then removes it automatically.
- Highlight must not mutate annotation data, recapture a screenshot, resume paused interception, or claim success for a detached target.
- Preserve the established narrow permission and explicit per-document authorization boundary unless the user confirms a material change.
- Keep side-panel controls out of viewport screenshots and retain the existing schema-v1 artifact shape if feasible.

## Domain language

- **Paused annotation**: the session remains alive, but the active document behaves normally and the annotator does not intercept page interactions.
- **Transient hover UI**: site-owned content, such as a tooltip or hint, visible only while the pointer remains over a trigger.
- **Edit draft**: unsaved replacement text for an already accepted annotation comment.
- **Highlight**: a side-panel action that scrolls to and temporarily outlines an accepted annotation's target in its exact still-live source document.

## Decision tree

All consequential branches are resolved. Pause is explicit and remains off through navigation, armed capture commits only after a selected-target re-hover and successful screenshot, accepted-comment editors survive unrelated refreshes, and Highlight scrolls to and temporarily outlines a target only in its exact still-live source document. Existing authorization, artifact, save, and support boundaries remain unchanged.

## Confirmed decisions

| ID | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- |
| D001 | Use `Improve annotation workflow` as the item title. | It covers pause/navigation, hover-state capture, and edit reliability as one cohesive workflow improvement. | User answer, 2026-09-22. | Scope is split into independent work items. |
| D002 | Provide a side-panel Pause control that restores normal page clicking and navigation without ending the annotation session. | Current selection mode intercepts every selectable click, preventing ordinary site operation; pausing must disable that interception. | User clarification, 2026-09-22; `browser-extension/content-script.js`. | A non-intercepting selection technique replaces the current click model. |
| D003 | For transient hover UI, let the user enter a comment, arm capture, then re-hover the selected target; capture fires after the hover state settles. | This keeps the requested comment-first workflow, avoids moving back to the side panel while the hover UI is visible, and has no countdown race or shortcut collision. | User selected recommended option, 2026-09-22. | Live Brave evidence shows sites commonly prevent reliable target-hover detection. |
| D004 | Use medium assurance. | State loss and wrong-state screenshots are meaningful regressions across several extension components, while all data remains local and recoverable. | User selected recommended option, 2026-09-22. | Risk or scope materially changes. |
| D005 | Keep annotation paused after navigation until explicit Resume or Enable on the destination document. | This prevents normal page clicks from unexpectedly becoming selections and preserves the existing explicit per-document boundary. | User selected recommended option, 2026-09-22. | Repeated explicit resume is shown to be materially obstructive. |
| D006 | Preserve an unaccepted target and typed comment while paused on the same document, but discard that stale draft when navigation replaces the document. | Pause should enable ordinary interaction without losing work, while a detached target cannot be captured reliably after navigation. | User selected recommended option, 2026-09-22. | Draft reattachment across documents becomes an explicit requirement. |
| D007 | Keep an accepted-annotation edit open, including text, focus, and caret, across bridge polling and unrelated state refreshes; change stored state only on Save edit. | The current full-list rerender closes the editor and discards input, contradicting the requested explicit edit-and-save workflow. | User-reported defect; `browser-extension/sidepanel.js`; existing stable selected-target view pattern. | Edits become intentionally autosaved. |
| D008 | Add a Highlight action to each accepted annotation card to identify its corresponding element on the page. | Multiple `annotation-NNNN` entries need a direct visual link back to the selected page element. | User follow-up, 2026-09-22. | The annotation list is replaced by a different review interface. |
| D009 | Allow Highlight only in the exact still-live document where the annotation was captured. | Runtime identity avoids silently resolving a stored selector to the wrong element after navigation or page change. | User selected recommended option, 2026-09-22. | Cross-document reattachment becomes an explicit requirement with an acceptable ambiguity policy. |
| D010 | On Highlight, scroll the target into view, apply a strong temporary outline, then remove it automatically. | This makes the target immediately discoverable without leaving page decoration behind. | User selected recommended option, 2026-09-22. | Scrolling or temporary duration proves disruptive in live use. |
| D011 | Confirm the complete shared understanding, including Pause/Resume, armed hover capture, stable editing, and live-target Highlight. | The updated synthesis matches the requested behavior, scope, boundaries, and medium-assurance verification posture. | User confirmation, 2026-09-22. | New evidence or requested scope materially changes the contract. |

## Rejected alternatives

- Keyboard-triggered hover capture was rejected for this change because it changes the workflow order and can collide with site or browser shortcuts.
- Countdown-based capture was rejected because timing pressure makes transient-state screenshots less reliable.
- Automatic post-navigation resume was rejected because it could unexpectedly intercept normal destination-page clicks.
- Clearing an unaccepted target on Pause was rejected because pausing normal interaction should not itself discard same-document work.
- Best-effort Highlight after revisiting a URL was rejected because page changes could resolve stored selectors to the wrong element.
- Visible-only and persistent Highlight styles were rejected because the former does not reliably locate off-screen targets and the latter can interfere with page use or screenshots.

## Open questions and prerequisites

No consequential questions remain. Capture settle timing, highlight duration, and internal state representation are implementation constants to choose during specification, provided behavior is deterministic, cancellable where applicable, and covered by the confirmed acceptance seams.

## Current frontier

Hand this confirmed item to `/skill:to-spec 260922-1604-improve-annotation-workflow`.

## Research index

No external research is currently required; current source, tests, archived specification, verification, and wiki evidence resolve the factual branches.

## Proposed test seams and acceptance evidence

- Content-script tests or a focused VM harness should prove Pause removes candidate outlines and click interception, Resume restores selection, duplicate toggles are safe, and an armed capture triggers only when the original selected target is re-hovered.
- Service-worker tests should prove same-document draft retention, stale-draft removal on navigation, explicit post-navigation enablement, unchanged accepted annotations, screenshot-after-hover sequencing, and retryable state after target loss or capture failure.
- Side-panel tests should prove Pause/Resume controls reflect the active document, arming requires a non-empty comment, armed capture can be cancelled, and successful capture commits exactly one annotation.
- Side-panel tests should also prove an accepted-annotation edit keeps its text, focus, caret, and control identity across bridge polling and unrelated state refreshes until Save edit, Keep original, deletion, or session cancellation.
- Highlight tests should prove exact live-document identity, scroll-into-view, temporary outline cleanup, unavailable/detached-target handling, no annotation-state mutation, no recapture, and no accidental resume of click interception while paused.
- Bundle tests should confirm the behavior retains the schema-v1 manifest and one-PNG-per-annotation contract.
- A live Brave check should cover normal interaction while paused, same-origin and access-revoking navigation, a real CSS-hover hint, cancellation and retry, the resulting PNG, and editing an older annotation while polling continues.

## Proposed wiki updates after implementation

After verified implementation, update `wiki/browser-annotator.md` with the durable pause/resume, transient-state capture, live-target Highlight, and stable edit behavior.

## Resume state

Mode: initial discovery. D002-D011 settle and confirm Pause/Resume, navigation, same-document draft retention, armed re-hover capture, stable accepted-comment editing, exact-live-document Highlight, scroll-and-flash presentation, boundaries, and medium assurance. The item is validated in `ready_for_spec`. Exact next action: run `/skill:to-spec 260922-1604-improve-annotation-workflow`.

## Readiness for To Spec

- [x] Every consequential branch is resolved or explicitly out of scope.
- [x] Facts are distinguished from user decisions and hypotheses.
- [x] Requirements, constraints, and non-goals are clear.
- [x] Acceptance evidence and proposed test seams are defined.
- [x] The user confirmed shared understanding.
