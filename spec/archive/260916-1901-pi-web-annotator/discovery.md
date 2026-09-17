# Discovery: Pi web annotator

Work item: `260916-1901-pi-web-annotator`
Status: Ready for Spec
Created: 2026-09-16
Updated: 2026-09-16

## Objective

Discover a KISS Pi extension workflow for visually annotating web-page elements in a browser and handing a structured local artifact to an LLM during normal planning work.

Assurance: medium - the change crosses Pi, browser-extension, local IPC, screenshot, and filesystem boundaries; incorrect output is recoverable local data, with no production migration or destructive operation.

## Desired outcome

A user starts annotation from Pi, selects one or more elements on one or more web pages, attaches plain-text comments, finishes from the browser, chooses or confirms a local destination, and receives a machine-readable artifact that a later Pi session can consume with minimal instruction.

## Repository and domain context

- Fact: the repository currently contains spec and wiki infrastructure but no product source, package manifest, or tests.
- Fact: Pi extensions can register slash commands and tools, use TUI prompts, own session-scoped processes, and inject a user message. Pi packages can bundle extension resources and runtime dependencies.
- Fact: Pi has no direct page-DOM API. In-page selection requires a browser component or a controlled browser.
- Fact: Chromium `captureVisibleTab()` captures only the visible viewport. Browser downloads can show Save As, but cannot silently choose an arbitrary project path.
- Fact: Playwright supports viewport, full-page, and element screenshots, but adds a browser automation runtime and may not reuse the user's normal authenticated browser session cleanly.
- Fact: repository priming found `wiki/index.md` and no `wiki/**/MEMORY.md` files. No wiki files were modified.
- Fact: the user's planning workflow treats `spec/active/<id>/` as the self-contained task boundary, keeps task-specific research there, and moves the complete item directory into archive.
- Fact: `wiki/raw/` rejects large generated outputs and is reserved for inputs to durable wiki maintenance, so it is not the correct screenshot destination.
- Revised recommendation: export canonical `annotations.json` plus relative `screenshots/`; omit generated Markdown because the intended consumer can parse JSON and a second representation would add drift.
- Confirmed: use dated session directories under project-local `.pi-annotations/`, keep the root ignored by Git, and ask before adding the ignore entry.
- Fact: Chromium `showDirectoryPicker()` can write multiple files and subdirectories, but it requires a secure `Window` context and direct transient user activation; an MV3 service worker cannot show it.
- Recommendation: use a visible extension side panel as the persistent annotation and Finish UI, allowing standalone Finish to invoke the directory picker directly and bridge mode to send the same bundle to Pi.

## Scope

- Ship one installable Pi package containing the Pi extension and an unpacked Chromium companion extension.
- Support Chromium on macOS for the first version.
- Start and end an annotation session from either standalone Chromium or an explicit Pi `/annotate` workflow.
- Select DOM elements and attach plain-text comments.
- Capture screenshot evidence for pages containing annotations.
- Export a versioned, machine-readable annotation manifest with element evidence and screenshot references or data.
- Make the exported artifact straightforward to invoke from a later Pi planning session.
- Provide a project-aware default save location when the selected architecture permits it.

## Out of scope

Proposed KISS boundaries, pending shared-understanding confirmation:

- Cloud sync, accounts, collaboration, and hosted services.
- Editing the target site's source or persisting annotations back into the page.
- Firefox, Safari, Windows, Linux, and mobile-browser support in the first version.
- Guaranteed reattachment of annotations after page changes; v1 captures current-snapshot evidence only.
- A permanent local daemon or OS-specific native-messaging installer unless later evidence makes one necessary.
- Chrome Web Store publication, signing, automatic browser-extension installation, or update infrastructure.
- Persistence or recovery of an unfinished browser annotation session across a full browser restart.
- Annotation of browser-internal or other restricted pages where Chromium disallows script injection.
- Automatic source-code mapping from a DOM element to a framework component or repository file.

## Confirmed facts and evidence

- User requirement: annotation mode must support element selection and plain-text comments.
- User requirement: pages with annotations must have screenshot evidence.
- User requirement: output must identify the referenced element and include the comment and screenshot or screenshot path.
- User requirement: finishing in the browser must save the machine-readable artifact and allow destination choice; project autodetection is desirable.
- User requirement: a later Pi session should be able to consume the artifact during normal planning with the remaining interpretation handled by the LLM.
- Evidence and citations: [research/browser-integration.md](./research/browser-integration.md).

## Constraints and invariants

- Saved artifacts must use a documented schema version and stable relative references.
- A captured element needs enough deterministic evidence for an LLM to understand the target without relying on screenshots alone.
- Side-panel controls must not become part of screenshots. The temporary outline around the selected target is intentional evidence and must be visible.
- Captured page text, attributes, HTML, URLs, comments, and images are untrusted local data, never executable instructions.
- Any local bridge must bind only to `127.0.0.1`, use an unguessable per-session token, allow only the companion extension origin, validate methods, media types, schema, paths, and bounded payload sizes, and stop on finish, cancel, inactivity timeout, or Pi shutdown.
- Output paths must be relative inside the bundle, must not escape their root, and must not overwrite an existing valid capture.
- Cancelling annotation or destination selection must not clear browser state or leave a partially valid final bundle.

## Domain language

- **Annotation**: one plain-text comment tied to one captured DOM element on one page state.
- **Element evidence**: a locator plus a bounded DOM snapshot, visible text, relevant attributes, and geometry captured when the user annotated.
- **Annotation bundle**: one export containing a versioned manifest and its referenced screenshots.
- **Bridge**: temporary local communication between the Pi process and browser component.
- **Valid bundle**: a dated capture directory containing a parseable `annotations.json` whose every relative screenshot reference resolves inside that directory.

## Confirmed architecture

### Package surfaces

- A Pi package exposes one TypeScript extension with `/annotate`, bridge lifecycle, destination confirmation, `.gitignore` confirmation, validation, and local atomic save behavior.
- A dependency-free Manifest V3 Chromium extension is loaded unpacked from the package's documented `browser-extension/` directory in v1.
- The companion uses a service worker for tab injection and screenshots, a content script for hover/select/target-outline behavior, and one global side panel for comments, edit/delete, bridge status, Finish, and cancel.
- The browser extension uses narrow `activeTab`, `scripting`, and `sidePanel` capabilities plus host access only to the documented loopback bridge endpoint. It does not request all-sites host access.

### Browser session

1. Clicking the browser action opens the side panel and grants temporary access to the active tab. The side panel enables selection on that tab. Each additional tab or post-navigation page must be explicitly enabled by a user action.
2. Hover outlines the candidate element. Clicking selects it and sends current-snapshot evidence to the side panel. A non-empty plain-text comment is required.
3. Accepting the comment temporarily renders only the target outline, captures the current visible viewport through `captureVisibleTab()`, removes the temporary capture state, and adds the annotation only when the screenshot succeeds.
4. The side panel keeps one session across explicitly enabled tabs/pages, lists annotations, and allows comment edit and annotation delete before Finish. Editing a comment does not recapture; deleting an annotation removes its pending screenshot.
5. Unsaved state survives MV3 service-worker suspension through browser session storage but is not guaranteed across full browser restart. Cancel requires confirmation when annotations exist.

### Optional Pi bridge

1. `/annotate` is interactive-TUI-only. It starts one bridge on a documented fixed loopback endpoint, creates a random per-session token, displays a cancellable waiting state, and fails clearly if the endpoint is unavailable.
2. The browser side panel probes only that endpoint. A handshake accepted only from the fixed companion extension origin returns the current session token; subsequent requests require it. Web pages cannot read or submit accepted bridge payloads.
3. The bridge never exposes the absolute project path to the browser. It only reports connected/standalone mode and accepts a bounded final bundle payload.
4. The bridge stops after successful save, explicit cancel, inactivity timeout, Pi session replacement/shutdown, or unrecoverable protocol failure. If it disappears, the browser retains annotations and can Finish through standalone save.

### Save behavior

- Capture directory names use sortable UTC timestamps such as `YYYYMMDD-HHMMSSZ`, with a deterministic non-overwriting suffix on collision. The latest bundle means the lexicographically latest directory containing a valid `annotations.json`.
- Bridge mode sends the final bundle to Pi. Pi prompts with `<cwd>/.pi-annotations/<capture-id>/`, accepts an explicit replacement path, asks before appending `.pi-annotations/` to the project-root `.gitignore`, validates everything, writes to a unique temporary sibling, writes `annotations.json` last, and renames the complete directory into place.
- Standalone mode calls `showDirectoryPicker({ mode: "readwrite" })` directly from the side-panel Finish click. The user selects the project root; the extension creates `.pi-annotations/<capture-id>/`, offers the same `.gitignore` update, writes screenshots first, and writes `annotations.json` last as the validity marker.
- A cancelled picker, declined path, denied permission, failed screenshot, failed bridge transfer, or failed write preserves browser state for retry. An interrupted standalone write may leave an incomplete directory, but it has no valid manifest and is ignored by latest-bundle selection.
- After a successful save, the side panel reports the relative bundle location and clears the completed browser session. No LLM turn starts automatically.

## Manifest contract

`annotations.json` is UTF-8 JSON and the sole bundle authority. Its initial schema has:

- top-level `schema_version`, `capture_id`, `created_at`, `completed_at`, `generator`, and ordered `pages`;
- each page's stable session-local `id`, captured `url`, `title`, and ordered `annotations`;
- each annotation's stable session-local `id`, plain-text `comment`, `created_at`, `updated_at`, `target`, and `screenshot`;
- target evidence containing generated CSS and XPath locators, tag name, bounded visible text, a privacy-aware bounded attribute map, bounded `outer_html`, bounding rectangle, scroll position, viewport size, and device-pixel ratio;
- screenshot evidence containing only a normalized relative PNG path, media type, and pixel dimensions.

Potentially sensitive form values, event-handler attributes, and extension UI are excluded. Bounded fields carry explicit truncation flags rather than silently losing evidence. Base64 images and absolute filesystem paths are forbidden in the saved manifest.

## Decision tree

All consequential branches are resolved: Chromium on macOS selects the companion extension; standalone directory access plus optional bridge selects the side panel; current-snapshot evidence selects bounded locators and DOM context; per-annotation viewport capture selects one relative PNG per annotation; ordinary Pi path prompts select dated `.pi-annotations/` bundles without a custom import command.

## Confirmed decisions

| ID | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- |
| D001 | Use `Pi web annotator` as the discovery title. | User selected the recommended working title. | User answer, 2026-09-16. | A later product name is chosen. |
| D002 | Target Chromium on macOS in v1. | This is the smallest useful environment and matches the user's current platform. | User answer, 2026-09-16. | Cross-platform or cross-browser support becomes a stated goal. |
| D003 | Capture current-snapshot element evidence without promising future reattachment. | Keeps the locator contract proportionate while still giving the LLM selector, DOM, text, attributes, and geometry evidence. | User answer, 2026-09-16. | Reopening saved annotations against changed pages becomes required. |
| D004 | Use medium assurance. | The bridge, browser, schema, and filesystem boundaries merit focused failure and security checks, while outputs remain reversible local artifacts. | User answer, 2026-09-16. | New evidence raises blast radius or the user requests a prototype. |
| D005 | Capture one viewport screenshot per annotation with the selected element visibly outlined and controls hidden. | Guarantees each comment has direct visual evidence without full-page stitching complexity. | User answer, 2026-09-16. | File volume becomes problematic or full-page context is required. |
| D006 | Use ordinary Pi path references and natural-language prompts for later intake, including asking Pi to load the latest dated bundle. | The user prefers the normal planning interaction over a dedicated import command; dated directories make latest selection deterministic. | User answer, 2026-09-16. | Repeated intake errors demonstrate a need for custom validation or automation. |
| D007 | Export only canonical `annotations.json` plus relative PNG screenshots. | A generated Markdown summary is unnecessary for the LLM-first workflow and would duplicate information. | User answer, 2026-09-16. | Human browsing without Pi becomes important. |
| D008 | Use an optional short-lived Pi loopback bridge. When active it targets Pi's current project; when absent the browser extension asks for a save location. | Preserves standalone browser usefulness while enabling project-aware saves during Pi work. | User answer, 2026-09-16. | Standalone multi-file saving proves unreliable or the bridge becomes unnecessary. |
| D009 | Store dated sessions under project-local `.pi-annotations/` by default. | Clearly identifies Pi-owned local intake and makes latest-session discovery deterministic. | User answer, 2026-09-16. | A shared non-Pi consumer requires a neutral name. |
| D010 | If `.pi-annotations/` is not ignored, ask before appending it to project `.gitignore`. | Prevents screenshot noise without silently modifying repository configuration. | User answer, 2026-09-16. | The user later wants captures versioned. |
| D011 | Use a persistent Chromium side panel for comments, annotation list, session controls, and Finish. | It stays available while interacting with the page and can invoke the standalone directory picker directly from a user gesture. | User answer and File System Access constraints, 2026-09-16. | Side-panel interaction materially obstructs page annotation. |
| D012 | Allow edit and delete before Finish. | Minimal correction controls prevent a mistaken comment from forcing session restart. | User answer, 2026-09-16. | State complexity proves disproportionate in implementation. |
| D013 | Start the bridge only through explicit `/annotate`. | Keeps the loopback listener session-scoped and avoids unnecessary always-on behavior. | User answer, 2026-09-16. | Repeated explicit startup becomes a demonstrated usability problem. |
| D014 | In bridge mode, Pi prompts with the dated project default and allows replacement before writing. | Preserves the original destination-choice requirement while keeping the common path one confirmation away. | User answer, 2026-09-16. | The user later prefers zero-click default saving. |
| D015 | Confirm the complete v1 shared understanding and boundaries. | The final synthesis accurately captures the desired outcome, architecture, artifact, failure behavior, non-goals, and medium assurance. | User confirmation, 2026-09-16. | New evidence contradicts the confirmed contract. |

## Rejected alternatives

- Native messaging is rejected for v1 because it requires a separately installed, OS-registered host.
- Playwright is rejected for v1 because its browser/runtime footprint conflicts with the requested KISS posture and may separate annotation from the user's normal logged-in browser.
- Full-page stitching is rejected for v1 because per-annotation viewport captures guarantee target visibility with less dynamic-page risk.
- Generated `summary.md`, ZIP packaging, base64 screenshots, a custom import command, and an LLM-only reader tool are rejected as unnecessary layers for the confirmed ordinary path-based Pi intake.

## Open questions and prerequisites

No consequential question remains. Numeric payload, comment, and DOM-field limits may be selected during planning as implementation constants, provided they are documented, tested, proportionate to personal desktop use, and report truncation or rejection clearly.

## Current frontier

Run the readiness transition and validation, then hand the same item to `/skill:to-spec 260916-1901-pi-web-annotator`.

## Research index

- [Research index](./research/index.md)
- [Browser integration research](./research/browser-integration.md)
- [Workflow artifact fit](./research/workflow-artifact-fit.md)

## Proposed test seams and acceptance evidence

- Schema fixtures parse valid multi-page bundles and reject unsupported versions, malformed IDs/timestamps, empty comments, duplicate IDs, base64/absolute/traversal paths, missing PNGs, and unexpected fields.
- Pure target-extraction fixtures verify selector generation, privacy-aware attributes, bounded HTML/text, truncation flags, geometry, viewport, and scroll metadata on static, nested, repeated, and client-rendered DOM.
- Browser API mocks verify explicit tab enablement, hover/select, screenshot-before-add, edit/delete, navigation handling, side-panel persistence, bridge detection, and state retention on every save failure.
- Chromium manual integration covers a normal HTTPS page, an HTTP localhost app, scrolling, multiple tabs/pages, restricted-page errors, and screenshots with target outline but no controls.
- Bridge tests bind loopback only and reject wrong origin, token, method, media type, size, schema, and path. Finish, cancel, timeout, and Pi shutdown release the endpoint.
- Filesystem tests use temporary repositories to verify destination prompting, no overwrite, temp-directory commit, manifest-last validity, collision suffixes, optional `.gitignore` append with preserved content, and failure cleanup.
- Standalone File System Access mocks verify user-gesture picker invocation, project-root selection, manifest-last writes, permission cancellation, retry, and incomplete-directory exclusion from latest selection.
- A fresh Pi planning session can follow an explicit bundle path or identify the latest valid dated bundle, read `annotations.json`, and inspect only its referenced PNGs without annotation-specific tooling.

## Proposed wiki updates after implementation

If implementation establishes stable architecture and commands, document the package layout, browser/Pi bridge lifecycle, artifact schema, and user workflow in the wiki after verification.

## Resume state

Mode: initial discovery. D002-D015 settle and confirm the complete v1 contract at medium assurance. Exact next action: transition this item to `ready_for_spec`, validate it, and hand it to `/skill:to-spec 260916-1901-pi-web-annotator`.

## Readiness for To Spec

- [x] Every consequential branch is resolved or explicitly out of scope.
- [x] Facts are distinguished from user decisions and hypotheses.
- [x] Requirements, constraints, and non-goals are clear.
- [x] Acceptance evidence and proposed test seams are defined.
- [x] The user confirmed shared understanding.
