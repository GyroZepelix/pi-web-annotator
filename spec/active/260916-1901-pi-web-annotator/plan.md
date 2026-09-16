# Plan: Pi web annotator

Work item: `260916-1901-pi-web-annotator`
Status: Planned
Created: 2026-09-16
Updated: 2026-09-16

Assurance: medium - the change introduces cooperating browser and Pi runtimes, local authenticated IPC, screenshot and filesystem state, and a public artifact schema, while failures affect only recoverable local annotation data.

## Goal

Deliver a KISS Pi package that lets a macOS Chromium user annotate elements across web pages, attach plain-text comments, capture direct screenshot evidence, and save a dated machine-readable bundle that a later Pi planning session can consume through ordinary path references.

## Context

The repository currently has planning and wiki scaffolding but no product source, package manifest, or tests. The implementation therefore establishes the package structure and verification seams from scratch.

The confirmed design and browser evidence are retained in [discovery.md](./discovery.md) and [research/](./research/index.md). `plan.md` is the implementation authority.

## Requirements

1. **Package and installation surface**
   - Create one Pi package with a conventionally discovered TypeScript extension under `extensions/pi-web-annotator/` and a documented unpacked Manifest V3 companion under `browser-extension/`.
   - Keep the Chromium extension dependency-free. Declare Pi-provided packages only as peers when package metadata requires them; do not add a third-party runtime dependency without separate approval.
   - Document Pi installation, unpacked Chromium loading, supported environment, bridge and standalone workflows, artifact format, privacy boundary, and troubleshooting.

2. **Supported environment and permissions**
   - Target current Google Chrome or Chromium proper on macOS, minimum Chrome 114 for the Side Panel API. Compatibility with Chromium derivatives is not guaranteed in v1.
   - Request only `activeTab`, `scripting`, `sidePanel`, and `storage`, plus host access to the single documented `http://127.0.0.1:43127/*` bridge endpoint. The least-privilege `storage` permission is used only for `chrome.storage.session` resilience across service-worker suspension.
   - Use a checked-in public manifest key or an equivalently deterministic package mechanism so the unpacked companion has a stable extension ID that the bridge can allowlist. No secret key material belongs in the package.
   - Do not request all-sites host access.

3. **Browser annotation workflow**
   - The toolbar action opens one global side panel. A user action explicitly enables annotation on the active tab; every additional tab and every post-navigation document requires another explicit enable action.
   - A content script provides candidate hover outline and click selection without permanently changing the page.
   - Selection captures current-snapshot evidence and moves comment entry into the side panel. Comments are non-empty plain UTF-8 text.
   - The side panel lists pending annotations across enabled pages and supports comment edit, annotation delete, confirmed cancel, bridge status, Finish, and retryable error display.
   - Persist unsaved state through Manifest V3 service-worker suspension with browser session storage. Full browser-restart recovery is not required.

4. **Element and screenshot evidence**
   - For every annotation record generated CSS and XPath locators, tag name, bounded visible text, a privacy-aware bounded attribute map, bounded `outer_html`, bounding rectangle, scroll position, viewport dimensions, and device-pixel ratio.
   - Exclude current form values, event-handler attributes, extension controls, and other explicitly sensitive or executable page data. Mark every truncated field explicitly.
   - When a comment is accepted, render only the selected-target outline, call `captureVisibleTab()`, then remove temporary capture state. Add the annotation only after PNG capture succeeds.
   - Store one viewport PNG per annotation. Editing a comment does not recapture. Deleting an annotation removes its pending screenshot.

5. **Canonical bundle contract**
   - Export one dated directory containing only `annotations.json` and `screenshots/<annotation-id>.png` files.
   - Use sortable UTC capture IDs in `YYYYMMDD-HHMMSSZ` form, adding a deterministic non-overwriting numeric suffix on collision.
   - `annotations.json` is UTF-8 JSON with integer `schema_version: 1`, capture identity and timestamps, generator identity, ordered page records, and ordered annotation records.
   - Each page records a stable session-local ID, URL, title, and annotations. Each annotation records a stable session-local ID, comment and timestamps, target evidence, and normalized relative PNG metadata.
   - Forbid absolute paths, path traversal, base64 screenshots, duplicate IDs, unsupported fields or versions, unresolved screenshots, empty comments, and malformed timestamps.
   - Document and test conservative limits for comment length, DOM snapshots, attributes, annotation count, image size, and total bridge payload. Reject or explicitly mark truncation rather than silently losing evidence.

6. **Standalone Finish and save**
   - When no Pi bridge is active, the side-panel Finish button must call `showDirectoryPicker({ mode: "readwrite" })` directly from that user gesture.
   - Treat the selected directory as the project root, create `.pi-annotations/<capture-id>/`, and ask before creating or appending `.pi-annotations/` in the root `.gitignore`. Declining the ignore edit does not cancel the bundle save, but produces a warning.
   - Preserve existing `.gitignore` bytes except for the minimal newline-safe appended entry.
   - Write PNGs first and `annotations.json` last. The manifest is the standalone validity marker. Incomplete directories without a valid manifest are ignored by latest-bundle discovery.

7. **Pi bridge lifecycle and trust boundary**
   - Register interactive-TUI-only `/annotate`. It starts one HTTP bridge bound exactly to `127.0.0.1:43127`, displays a cancellable waiting state, and fails clearly when the endpoint is occupied.
   - Generate a cryptographically random per-session token. Accept handshake only from the deterministic companion extension origin, return no project path, and require the token on every subsequent request.
   - Reject wrong origins, methods, media types, tokens, schemas, sizes, duplicate completion, and malformed or escaping paths before any target write.
   - Stop the bridge after successful save, explicit cancel, inactivity timeout, session replacement or shutdown, or unrecoverable protocol failure. If the bridge disappears, retain browser annotations for standalone retry.

8. **Bridge Finish and project-aware save**
   - On browser Finish, transfer the bounded final bundle to the bridge and keep browser state until Pi reports save success.
   - Pi proposes `<cwd>/.pi-annotations/<capture-id>/`, accepts an explicit replacement destination, and asks before appending `.pi-annotations/` to the project-root `.gitignore` when applicable.
   - Validate the complete manifest and image set before writing. Write into a unique temporary sibling, write `annotations.json` last inside it, and rename the complete directory into its final non-existing destination.
   - A cancelled prompt, rejected path, transfer failure, validation failure, or write failure must preserve browser state for retry and must not create a valid partial destination.

9. **Completion and later Pi intake**
   - After successful bridge or standalone save, show the relative bundle location and clear the completed browser session. Do not start an LLM turn automatically.
   - A later Pi session consumes a named `annotations.json` or identifies the lexicographically latest dated directory containing a valid manifest under `.pi-annotations/`.
   - Do not add `summary.md`, ZIP output, a custom import command, a custom LLM reader tool, or hidden automatic ingestion.

10. **Verification and documentation**
    - Keep manifest, selector extraction, bridge validation, destination, save ordering, and `.gitignore` behavior in testable pure helpers where practical.
    - Add deterministic automated tests using platform-provided tooling and mocks. Add no test dependency without separate approval.
    - Provide a manual Chromium checklist for real side-panel, `activeTab`, screenshot, File System Access, multi-page, restricted-page, bridge, fallback, and retry behavior.

## Out of scope

- Firefox, Safari, Windows, Linux, mobile, or guaranteed Chromium-derivative compatibility.
- Cloud services, accounts, synchronization, collaboration, or hosted storage.
- Chrome Web Store publication, signing, automatic companion installation, or update infrastructure.
- Full-page stitching or one screenshot per page.
- Native messaging, a permanent daemon, remote binding, or concurrent bridge sessions.
- Recovery of an unfinished annotation session after a full browser restart.
- Guaranteed element reattachment after page changes.
- Automatic mapping from DOM elements to framework components or source files.
- Editing the target website or persisting annotations into page content.
- Automatic wiki, spec-item, or LLM-context mutation from saved annotations.

## Assumptions

- One user, one Pi session, one companion extension, and one annotation bridge operate at a time on a trusted local macOS machine.
- The relevant threat is an untrusted web page attempting to reach the local bridge. Malicious local processes or separately installed malicious extensions are outside v1's protection boundary.
- Users manually load the unpacked companion and explicitly enable every annotated document.
- File System Access permission may be denied or revoked; standalone state remains retryable.
- Numeric limits are implementation constants owned by T01. They must be documented and tested without changing the confirmed personal-desktop operating envelope.

## Design

### Source layout

```text
package.json
README.md
extensions/
`-- pi-web-annotator/
    |-- index.ts
    `-- lib/
        |-- bridge.js
        |-- bundle.js
        `-- filesystem.js
browser-extension/
|-- manifest.json
|-- service-worker.js
|-- sidepanel.html
|-- sidepanel.css
|-- sidepanel.js
|-- content-script.js
`-- lib/
    |-- annotations.js
    |-- bundle.js
    `-- selectors.js
tests/
|-- browser/
|-- bridge/
|-- bundle/
`-- fixtures/
```

The exact helper split may change when one adjacent file is clearer, but the Pi extension, browser runtime, pure contract helpers, and tests remain separate. Browser-consumed files must stay inside `browser-extension/`; duplicate contract logic is minimized through fixtures and parity tests rather than imports that escape the unpacked extension root.

### Browser state and messaging

- The service worker owns tab injection, screenshot capture, and session-storage coordination.
- The side panel owns user-visible session state and sends typed messages to the service worker.
- The content script owns temporary page interaction and returns data only. It never writes files or contacts the bridge.
- Browser messages use a small explicit action vocabulary and validate payload shape at every boundary.
- Navigation invalidates the prior document's injected selector mode but does not delete completed annotations from the session.

### Bundle validity and recovery

- One validation contract is exercised against browser-produced and bridge-received manifests through shared fixtures.
- The bundle never stores executable page code as behavior. Captured strings are serialized data.
- Bridge writes are directory-atomic through temporary sibling rename.
- Standalone File System Access cannot promise directory-level atomic rename, so manifest-last is the commit marker. Retry may create a suffixed capture rather than overwrite an incomplete directory.

### Bridge protocol

- A fixed port avoids scanning and manual pairing.
- A deterministic extension origin plus random session token blocks ordinary cross-origin web-page requests.
- The handshake exposes connection status and token only, never `ctx.cwd` or arbitrary filesystem operations.
- The completion endpoint accepts one bounded payload for the active session and returns explicit saved, cancelled, retryable-error, or terminal-error status.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Browser UI | Use a global Chromium side panel plus explicit per-document enablement. | Keeps controls outside screenshots and supports user-activated directory picking. | Discovery D002, D011; browser research. | Side-panel interaction blocks real target workflows. |
| D02 | Evidence | Capture current-snapshot DOM evidence and one outlined viewport PNG per annotation. | Guarantees the target is visible without full-page stitching or future reattachment complexity. | Discovery D003, D005. | Full-page context or reattachment becomes required. |
| D03 | Artifact | Use schema-v1 `annotations.json` plus relative PNGs in dated `.pi-annotations/` directories. | Transparent, selectively readable, machine-parseable, and latest-session friendly. | Discovery D006-D009. | Ordinary path intake repeatedly fails. |
| D04 | Bridge | Make `/annotate` start one optional authenticated loopback bridge. | Enables project-aware saves without a daemon or native host while preserving standalone use. | Discovery D008, D013. | Fixed-port or pairing behavior fails in practice. |
| D05 | Save | Confirm bridge destination, ask before `.gitignore`, never overwrite, and use manifest-last validity. | Preserves user control and prevents valid partial bundles or Git noise. | Discovery D010, D014. | Users explicitly choose versioned captures or automatic saves. |
| D06 | Intake | Use normal Pi path references and no annotation-specific import surface. | The LLM can read JSON and referenced images without duplicate tooling. | Discovery D006-D007. | Repeated validation or usability failures justify automation. |
| D07 | Trust | Treat page-derived strings and images as untrusted data and narrowly authenticate the local endpoint. | Prevents webpage content or cross-origin requests from becoming instructions or filesystem operations. | Discovery constraints; Chrome API research. | The bridge threat model expands beyond trusted-local use. |
| D08 | Execution | Use two serial implementation slices. | The verified browser artifact/session contract must exist before bridge integration, and combining two new runtimes would materially reduce diagnostic and correction headroom. | To Spec session-fit assessment approved 2026-09-16. | T01 proves trivial enough to merge before implementation starts. |
| D09 | Browser permissions | Include only the narrow `storage` permission in addition to `activeTab`, `scripting`, and `sidePanel`. | Chrome requires `storage` to use `chrome.storage.session`, which is necessary for the already-confirmed service-worker-suspension resilience contract. | Implement source-truth correction approved 2026-09-16; Chrome Storage API documentation. | Chromium provides equivalent session persistence without this permission. |

## Work breakdown

- [x] T01: Deliver the standalone Chromium annotator and canonical bundle contract.
  - Depends on: none.
  - Scope: package foundation, Manifest V3 companion, side-panel and content-script workflow, session state, selectors and bounded target evidence, per-annotation screenshots, edit/delete/cancel, schema-v1 validation, standalone File System Access save, `.gitignore` confirmation, documentation foundation, and focused automated tests.
  - Expected areas: `package.json`, `README.md`, `browser-extension/`, shared browser fixtures/helpers, `tests/browser/`, `tests/bundle/`.
  - Acceptance: the unpacked companion can annotate multiple explicitly enabled pages, correct pending comments, save a valid standalone `.pi-annotations/<capture-id>/` bundle, and retain state across every tested failure without broad host permission or third-party runtime dependencies.
  - Verification: built-in test runner, JavaScript and JSON syntax checks, manifest permission inspection, fixture validation, and focused review.

- [ ] T02: Deliver the Pi bridge and complete integrated workflow.
  - Depends on: T01 passing its segment gate.
  - Scope: Pi package registration, `/annotate`, bridge handshake/token/origin and payload validation, project-aware destination and `.gitignore` prompts, atomic filesystem save, browser bridge detection/transfer/fallback, full documentation, integration tests, packaging checks, and real Chromium checklist.
  - Expected areas: `extensions/pi-web-annotator/`, bridge-related browser files, `tests/bridge/`, integration fixtures, `README.md`, `package.json`.
  - Acceptance: `/annotate` provides one cancellable project-aware session, rejects invalid callers and payloads, saves one complete validated bundle or no valid destination, falls back cleanly to standalone behavior, releases the endpoint on every terminal path, and leaves normal Pi intake path-based.
  - Verification: complete automated suite, package dry run, temporary-repository integration checks, real Chromium checklist, focused final-segment review, and whole-plan contract-quality review.

## Acceptance criteria

- The Pi package and unpacked companion install from documented local or Git package paths without adding a third-party runtime dependency.
- Clicking the companion action opens a side panel and permits annotation only after explicit access to each document.
- A saved annotation includes a non-empty comment, bounded current element evidence, and one target-outlined viewport PNG with no side-panel controls.
- Edit and delete work before Finish, and capture/save errors preserve retryable state.
- Standalone Finish writes a valid dated `.pi-annotations/` bundle under a user-selected project root and asks before the minimal `.gitignore` update.
- `/annotate` binds only to `127.0.0.1:43127`, authenticates the stable companion origin and random session token, reveals no project path, validates the full payload, and shuts down on all terminal lifecycle paths.
- Bridge Finish confirms the proposed project destination, never overwrites, and exposes a valid final directory only after complete validation and write.
- Schema fixtures and saved bundles reject unsupported or unsafe structures and resolve every PNG inside the bundle.
- The latest valid capture can be selected lexicographically and consumed by a fresh Pi session using ordinary path language.
- Automated checks, package checks, manual Chromium scenarios, the medium-assurance focused reviews, final contract review, path/link checks, and `git diff --check` pass with residual uncertainty recorded.

## Testing decisions and seams

- Use the runtime's built-in JavaScript test runner and hand-written Chrome API doubles. Do not add a test framework dependency without approval.
- Keep selector extraction, manifest construction/validation, capture naming, path normalization, Git-ignore merging, and save ordering pure enough for deterministic fixtures.
- Use temporary directories for bridge and filesystem tests. Prove no overwrite, traversal rejection, manifest-last behavior, temp rename, collision suffixes, preserved `.gitignore`, and cleanup/error reporting.
- Mock service-worker suspension and browser session storage rather than claiming full-browser persistence.
- Verify both browser and Pi sides against the same accepted/rejected bundle fixtures.
- Manual Chromium scenarios cover HTTPS, HTTP localhost, scrolling, multiple tabs, navigation, restricted pages, picker cancellation, denied write permission, bridge loss, and target-outline screenshots.
- Review blockers must identify a violated requirement or repository rule, a credible failure path, meaningful harm, and the smallest correction. Medium assurance requires focused segment review and final whole-contract review.

## Verification plan

- Run all automated tests with `node --test`.
- Run JavaScript syntax checks over browser and extracted runtime helpers with `find browser-extension extensions -name '*.js' -print0 | xargs -0 -n1 node --check`.
- Parse `package.json`, `browser-extension/manifest.json`, and JSON fixtures with a focused Node validation command or the automated suite.
- Run `npm pack --dry-run` and inspect that the Pi extension, browser companion, README, and required package metadata are included without generated captures or repository planning artifacts.
- Run the documented temporary-repository bridge integration scenarios, including origin/token rejection, size/schema/path rejection, destination cancellation, `.gitignore` decline/accept, successful atomic save, timeout, and shutdown.
- Run the documented manual Chromium checklist on macOS for standalone and bridge modes.
- Run medium-assurance focused review after T01, focused final-segment review after T02, and one final contract-quality review over all requirements and acceptance.
- Run `uv run spec/scripts/manage-spec-item.py --root . validate --item 260916-1901-pi-web-annotator`, resolve changed Markdown links, verify fenced-code balance, and run `git diff --check` before reporting completion.

## Risks and blockers

- **Transient browser permission:** `activeTab` is lost on navigation or a new tab. Mitigation: explicit enable state and clear restricted/navigation errors without deleting prior annotations.
- **Directory-picker user activation:** delayed calls fail. Mitigation: standalone Finish calls the picker directly in the side-panel click handler before unrelated asynchronous work.
- **Bridge spoofing or CSRF:** a webpage may probe loopback. Mitigation: exact loopback bind, deterministic companion origin, token, strict CORS and request validation, and no generic filesystem API.
- **Memory growth from PNG data:** long sessions may exhaust extension or bridge memory. Mitigation: documented annotation/image/total limits and explicit refusal without clearing state.
- **Divergent browser and Pi validation:** one side could accept unsafe output. Mitigation: shared fixtures, parity assertions, and Pi-side revalidation before writes.
- **Standalone partial directories:** browser APIs lack a guaranteed directory transaction. Mitigation: screenshots first, manifest last, no overwrite, and latest selection requires a valid manifest.
- **Real-browser gaps:** mocks cannot prove Side Panel, screenshot, and File System Access integration. Mitigation: required manual Chromium scenarios and honest residual uncertainty.

## Progress

- [x] Discovery complete and confirmed.
- [x] Two-slice execution mode approved.
- [x] T01 standalone Chromium annotator implemented and automatically verified; real-Chromium checklist remains recorded as residual uncertainty because no Chrome/Chromium executable was available in the implementation environment.
- [ ] T02 Pi bridge and integration not started.
- [ ] Final verification not run.

## Execution handoff

Use `/skill:implement 260916-1901-pi-web-annotator` in a fresh Pi session. Read `item.yaml`, this plan, `implementation/index.md`, and only the Current packet. Execute exactly Current, preserve all approval gates and unrelated work, and do not begin the next slice in the same invocation.

## Proposed durable knowledge updates

After verified implementation, update the repository wiki with the package layout, browser/Pi boundary, annotation bundle schema, bridge and standalone workflows, installation procedure, supported environment, and verification commands. Do not present planned behavior as current before verification.
