# Plan: Pi web annotator

Work item: `260916-1901-pi-web-annotator`
Status: Planned
Created: 2026-09-16
Updated: 2026-09-16

Assurance: medium - the package combines a browser runtime, authenticated local IPC, screenshot and filesystem state, and a public artifact schema, while failures remain local, visible, retryable, and recoverable. R001, R002, and R003 correct browser-action, save-capability, and support-boundary assumptions found through live use.

## Goal

Deliver a KISS Pi package for Brave on macOS that lets a user explicitly authorize and annotate webpage elements, attach plain-text comments, capture direct screenshot evidence, and save a dated machine-readable bundle through an authenticated project-aware bridge for later path-based Pi intake.

## Context

T01 delivered the standalone browser annotator and schema-v1 bundle contract in commit `787bb2d4265347b3253f41c3c3b031d5b953a508`. T02 implemented the bridge but remained uncommitted and unaccepted. Live Brave use then produced three applied same-item revisions:

- [R001](./refinements/R001.md) replaced automatic panel opening with action-event `activeTab` authorization and raised the manifest API floor to Chrome 116.
- [R002](./refinements/R002.md) made default Brave bridge-only while retaining capability-detected standalone saving.
- [R003](./refinements/R003.md) narrowed guaranteed v1 support and live acceptance to Brave on macOS, retained standalone saving as unguaranteed best-effort behavior, and added a generated extension icon.

Completed packet `01.01` remains historical evidence. Attempted packets `02.01`, `03.01`, and `04.01` are frozen non-executable evidence. Their valid source changes and checks may be retained. `plan.md` is the sole implementation authority.

## Requirements

1. **Package, installation, and identity**
   - Provide one dependency-free Pi package with a conventionally discovered TypeScript extension under `extensions/pi-web-annotator/` and an unpacked Manifest V3 companion under `browser-extension/`.
   - Declare Pi-provided packages only as peers when package metadata requires them. Add no third-party runtime or test dependency without separate approval.
   - Keep the checked-in public manifest key or an equivalently deterministic mechanism so the companion retains extension ID `kemcbalaoccidjnoggajcgjhjlpibbkg`. No secret key material belongs in the package.
   - Document local and Git installation, unpacked loading, Brave support, bridge and optional standalone behavior, artifact format, privacy boundary, limits, later intake, and troubleshooting.

2. **Supported environment and permissions**
   - Guarantee v1 operation only on macOS with Brave 1.95.101 or newer. The manifest minimum Chrome version remains 116 because the required Side Panel API surface begins there, not as a Google Chrome or Chromium-proper support promise.
   - Default Brave saves through the authenticated Pi bridge because it disables File System Access. Other Chromium-family browsers, including Google Chrome and Chromium proper, are unguaranteed in v1.
   - Select optional standalone availability by capability detection, never browser-name or user-agent sniffing. When `window.showDirectoryPicker` exists, the established standalone path may be used as best-effort behavior outside guaranteed acceptance.
   - Request exactly `activeTab`, `scripting`, `sidePanel`, and `storage`, plus host access only to `http://127.0.0.1:43127/*`. Use `storage` only for same-browser-session resilience.
   - Do not request persistent HTTP(S), all-sites, broad tab, downloads, or native-messaging access.

3. **Generated extension icon**
   - Use the configured image-generation capability during implementation to create one 1024 by 1024 source PNG for the companion.
   - Use a simple flat cursor-plus-comment-bubble motif on a solid cobalt-blue background, with a high-contrast cursor and white comment bubble. Center a very large motif that fills about 80% of the square with minimal safe padding, no text, and no fine detail.
   - Derive checked-in square PNGs at 16, 32, 48, and 128 pixels using platform-provided tooling without adding a dependency. Retain the generated source artwork under `browser-extension/icons/`.
   - Reference the derived assets through manifest `icons` and action `default_icon` entries. Icon metadata must not change the deterministic extension ID, permissions, or runtime behavior.

4. **Toolbar authorization and annotation workflow**
   - Handle the toolbar gesture with `chrome.action.onClicked`. From the same user gesture, retain the action tab's temporary `activeTab` grant and synchronously request the global side panel with `chrome.sidePanel.open({ windowId: tab.windowId })`.
   - Do not use automatic `openPanelOnActionClick` for authorization and do not inject on toolbar click.
   - Require a separate **Enable annotation on this page** action before content-script injection. Every new tab requires its own toolbar authorization and Enable. Every navigation invalidates injected mode; access-revoking navigation also requires a fresh toolbar action.
   - Provide temporary hover and selection outlines, bounded current-snapshot target evidence, plain-text comment entry, edit, delete, confirmed cancel, bridge/save capability status, Finish, and retryable errors.
   - Preserve selected-target text, focus, and caret across bridge polling and unrelated state refreshes. Clear a draft only when its target is accepted, removed, cancelled, or genuinely replaced.
   - Persist unsaved state through Manifest V3 service-worker suspension with `chrome.storage.session`. Full browser-restart recovery is not required.

5. **Element and screenshot evidence**
   - Record generated CSS and XPath locators, tag name, bounded visible text, privacy-aware bounded attributes, bounded `outer_html`, bounding rectangle, scroll position, viewport dimensions, and device-pixel ratio.
   - Exclude current form values, event-handler and executable attributes, extension controls, and other sensitive executable page data. Mark every truncated value explicitly.
   - On comment acceptance, render only the selected-target outline, call `captureVisibleTab()`, and remove temporary capture state. Add the annotation only after PNG capture succeeds.
   - Store one viewport PNG per annotation. Editing does not recapture; deletion removes its pending screenshot.

6. **Canonical bundle contract**
   - Export one dated directory containing only `annotations.json` and `screenshots/<annotation-id>.png` files.
   - Use sortable UTC capture IDs in `YYYYMMDD-HHMMSSZ` form with deterministic non-overwriting numeric collision suffixes.
   - Keep strict integer `schema_version: 1` with capture and generator identity, ordered pages and annotations, comments and timestamps, bounded target evidence, and normalized relative PNG metadata.
   - Reject absolute or traversing paths, base64 screenshots, duplicate IDs, unsupported fields or versions, malformed timestamps, empty comments, unsafe evidence, unresolved images, and extra images.
   - Preserve established conservative limits for comments, target snapshots, attributes, annotation count, images, browser session state, and bridge payload. Reject oversize values or mark documented truncation without silent loss.

7. **Capability-gated optional standalone saving**
   - When the bridge is disconnected and `window.showDirectoryPicker` is callable, Finish may call `showDirectoryPicker({ mode: "readwrite" })` directly from that user gesture.
   - Treat the selected directory as a project root, create `.pi-annotations/<capture-id>/`, and separately ask before creating or minimally appending `.pi-annotations/` in the root `.gitignore`. Declining the ignore edit does not cancel save.
   - Preserve existing `.gitignore` bytes apart from the newline-safe appended entry. Write PNGs first and `annotations.json` last. Never overwrite an existing capture.
   - This path remains tested code but is not guaranteed product behavior and does not require Chrome/Chromium-proper live acceptance.
   - When neither picker nor bridge is available, disable Finish, retain all state, show persistent guidance to run `/annotate`, and do not report a failed save attempt.

8. **Pi bridge lifecycle and trust boundary**
   - Register interactive-TUI-only `/annotate`. Bind exactly to `127.0.0.1:43127`, show a cancellable waiting state, and fail clearly on endpoint collision.
   - Generate a cryptographically random session token. Accept handshake only from the deterministic companion origin, expose no project path, and require the token on every subsequent request.
   - Reject wrong origins, methods, media types, tokens, schemas, sizes, duplicate completion, and malformed or escaping paths before any destination write.
   - Stop on successful save, explicit cancel, inactivity timeout, session replacement or shutdown, or unrecoverable protocol failure.
   - On bridge loss retain annotations, drafts, and screenshots and show `/annotate` guidance. Authenticated reconnection restores Finish without recapture.

9. **Project-aware bridge save**
   - Transfer the bounded final bundle only after browser Finish and retain browser state until Pi reports save success.
   - Propose `<cwd>/.pi-annotations/<capture-id>/`, accept only an explicit replacement inside the project, and separately ask before the project-root `.gitignore` change when applicable.
   - Validate the complete manifest and image set before writing. Write into a unique temporary sibling, write `annotations.json` last inside it, then rename to a final non-existing destination.
   - Prompt cancellation, invalid destination, transfer failure, validation failure, or filesystem failure must expose no valid destination and preserve browser state for retry.

10. **Completion, later intake, and verification**
    - After successful save, report the relative manifest path and clear only the saved browser revision. Do not start an LLM turn automatically.
    - Later Pi sessions consume a named valid manifest or the lexicographically latest valid dated directory under `.pi-annotations/` through ordinary path language.
    - Keep manifest, action authorization, draft rendering, capability resolution, selector extraction, bridge validation, destination, save ordering, `.gitignore`, and icon metadata in deterministic test seams.
    - Use platform-provided test tooling and mocks only. Reuse the passing Brave live matrix and validated bundles, then manually verify the generated icon after reloading the unpacked companion in Brave.

## Out of scope

- Guaranteed Google Chrome, Chromium proper, other Chromium derivatives, Firefox, Safari, Windows, Linux, or mobile compatibility.
- Guaranteed standalone File System Access saving or a requirement to enable Brave's experimental File System Access flag.
- Browser downloads, ZIP output, changed bundle format, native messaging, a permanent daemon, remote binding, or concurrent bridge sessions.
- Cloud services, accounts, synchronization, collaboration, or hosted storage.
- Chrome Web Store publication, signing, automatic companion installation, update infrastructure, store-listing artwork, alternate icon concepts, animation, or a broader branding system.
- Full-page screenshot stitching, persistent site access, all-sites permission, automatic annotation enablement, browser-restart recovery, framework source mapping, target-site editing, or automatic wiki/spec/LLM-context mutation.

## Assumptions

- One trusted local user, one Pi session, one companion extension, and one bridge operate at a time on macOS.
- The relevant threat is an untrusted webpage reaching loopback. Malicious local processes or separately installed malicious extensions remain outside v1.
- Brave retains the required Chromium action-grant and Side Panel behavior. Revisit when Brave materially changes those APIs.
- Default Brave continues to omit `showDirectoryPicker`; capability detection owns future divergence.
- The user manually loads the unpacked companion and explicitly authorizes and enables every annotated document.
- Image generation availability follows the configured provider. If generation is unavailable, stop rather than substituting hand-drawn or downloaded artwork without approval.

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
        `-- filesystem.js
browser-extension/
|-- icons/
|   |-- icon-source.png
|   |-- icon-16.png
|   |-- icon-32.png
|   |-- icon-48.png
|   `-- icon-128.png
|-- manifest.json
|-- service-worker.js
|-- sidepanel.html
|-- sidepanel.css
|-- sidepanel.js
|-- content-script.js
`-- lib/
    |-- annotations.js
    |-- bridge.js
    |-- bundle.js
    |-- constants.js
    |-- filesystem.js
    `-- selectors.js
tests/
|-- browser/
|-- bridge/
|-- bundle/
`-- fixtures/
```

### Runtime and save-mode resolution

- The service worker owns action authorization, global side-panel opening, injection, screenshots, and session state.
- The side panel owns explicit Enable, stable draft controls, capability status, and Finish.
- A connected authenticated bridge takes precedence. With no bridge, a callable picker enables optional standalone save. With neither, Finish is disabled with persistent guidance and unchanged pending state.
- Bridge loss and reconnection recompute capability state without recapture.

### Icon pipeline

- Generate one 1024 by 1024 project-owned PNG with the confirmed motif.
- Derive 16, 32, 48, and 128 pixel PNGs from that source using macOS `sips` or an equivalently available platform command, without installing a package.
- Keep the source and derived assets inside `browser-extension/icons/`; package inclusion follows the existing `browser-extension` package entry.
- Tests parse PNG headers and assert square dimensions, manifest mapping, file existence, and unchanged permissions.

### Bundle and bridge validity

- Browser and bridge paths validate against the same schema-v1 fixtures. Captured strings and screenshots remain untrusted serialized data.
- Bridge writes are directory-atomic through temporary sibling rename. Optional standalone saving uses manifest-last as the validity marker.
- The fixed endpoint, deterministic extension origin, random token, bounded completion payload, and no-cwd handshake remain the complete bridge authority.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Browser UI | Use a global side panel plus explicit per-document enablement. | Keeps controls outside screenshots and preserves explicit injection consent. | Discovery D002, D011. | Side-panel interaction blocks real target workflows. |
| D02 | Evidence | Capture current-snapshot DOM evidence and one outlined viewport PNG per annotation. | Guarantees a visible target without full-page stitching or reattachment complexity. | Discovery D003, D005. | Full-page context or reattachment becomes required. |
| D03 | Artifact | Use strict schema-v1 `annotations.json` plus relative PNGs in dated `.pi-annotations/` directories. | Transparent, machine-parseable, and latest-session friendly. | Discovery D006-D009. | Ordinary path intake repeatedly fails. |
| D04 | Bridge | Make `/annotate` start one authenticated loopback bridge. | Enables project-aware saves without a daemon or native host. | Discovery D008, D013. | Fixed-port or pairing behavior fails in practice. |
| D05 | Save | Confirm destination, ask before `.gitignore`, never overwrite, and use atomic rename or manifest-last validity. | Preserves user control and prevents valid partial bundles. | Discovery D010, D014. | Users explicitly choose versioned captures or automatic saves. |
| D06 | Intake | Use ordinary Pi path references and no annotation-specific import surface. | Pi can read JSON and referenced images without duplicate tooling. | Discovery D006-D007. | Repeated usability failures justify automation. |
| D07 | Trust | Treat page-derived content as untrusted data and narrowly authenticate loopback. | Prevents webpage content or cross-origin requests from becoming commands or filesystem operations. | Discovery constraints and browser research. | The threat model expands beyond trusted-local use. |
| D08 | Execution | Preserve completed and frozen sliced history and use fresh replacement work for material corrections. | Completed and attempted packets contain durable evidence that cannot be rewritten. | Original slicing decision and revisions. | Remaining work develops a new independent dependency boundary. |
| D09 | Browser permissions | Include only `storage` in addition to `activeTab`, `scripting`, and `sidePanel`. | `chrome.storage.session` resilience requires `storage`; broader permissions remain unnecessary. | Approved source-truth correction. | Equivalent session persistence no longer needs this permission. |
| D10 | Applied revision R001 | Require the Chrome 116 API floor, use action-event global opening, and retain explicit Enable and narrow permissions. | Live Brave testing proved automatic side-panel opening did not grant `activeTab`. | Applied [R001](./refinements/R001.md). | Brave materially diverges from the required action-panel behavior. |
| D11 | Applied revision R002 | Make default Brave bridge-only and disable Finish with persistent `/annotate` guidance when neither save capability exists. | Brave disables File System Access; the bridge preserves artifact and trust boundaries. | Applied [R002](./refinements/R002.md). | Brave enables stable File System Access by default or bridge-only recovery proves unusable. |
| D12 | Applied revision R003 | Guarantee only Brave on macOS, retain standalone saving as unguaranteed capability-based behavior, and add a generated cursor-plus-comment-bubble icon suite. | Completion should rest on directly verified browser evidence, while preserving useful existing capability code and completing the unpacked companion identity. | Applied [R003](./refinements/R003.md). | The user requires another supported browser or the generated icon fails small-size acceptance. |
| D13 | Live icon legibility correction | Keep the confirmed cursor-plus-comment-bubble concept but use a solid cobalt-blue background and a very large high-contrast motif filling about 80% of the square with minimal safe padding. Preserve one final 1024 source, no text, no fine detail, and no alternate concept. | The first generated charcoal-background, generously padded icon was not recognizable enough in live Brave inspection. | User live-legibility rejection during Current 05.01 on 2026-09-16. | The corrected icon still fails recognition in `brave://extensions` or the normal-scale toolbar. |

## Work breakdown

- [x] T01: Deliver the standalone browser annotator and canonical bundle contract.
  - Completed in checkpoint `787bb2d4265347b3253f41c3c3b031d5b953a508`.
  - Retained evidence: schema, privacy, state, screenshot, filesystem helpers, fixtures, automated checks, and focused review.
  - Invalidated evidence: original toolbar authorization and universal standalone assumptions.

- T02 historical attempt: implement the Pi bridge and complete integration.
  - Packet `02.01` is frozen, non-executable evidence.
  - Reusable: bridge, filesystem, browser transfer, documentation, automated checks, and focused review.
  - Replaced by T03 after R001.

- T03 historical attempt: correct toolbar authorization and complete integration.
  - Packet `03.01` is frozen, non-executable evidence.
  - Reusable: action correction, stable drafts, tests, package/Pi/integration checks, and focused review.
  - Replaced by T04 after R002.

- T04 historical attempt: reconcile capability-gated saving and complete integration.
  - Packet `04.01` is frozen, non-executable evidence.
  - Reusable: capability-gated Finish, disconnected guidance, bridge loss/reconnection, full 62-test result, focused review, Brave live evidence, and validated bundles.
  - Invalidated: separate Chrome/Chromium-proper acceptance as a completion gate.
  - Replaced by T05 after R003.

- [x] T05: Finalize Brave-only support, generated icon, and integrated completion.
  - Depends on: retained T01 source/evidence and frozen T02/T03/T04 implementation/evidence.
  - Scope: reconcile Brave-only documentation and acceptance, generate and derive icon assets, wire manifest icon metadata, add focused icon/package tests, rerun complete checks, run icon acceptance in Brave, complete reviews, consolidate verification, and execute approved completion lifecycle gates.
  - Expected areas: `README.md`, `browser-extension/icons/`, `browser-extension/manifest.json`, browser tests, final verification and outcome artifacts.
  - Acceptance: Brave-supported action, annotation, bridge save, recovery, bundle, and intake behavior remains accepted; unsupported browser claims are removed; all icon assets and manifest references pass automated and live Brave checks; frozen history is unchanged.
  - Verification: complete automated suite, syntax, image metadata, package dry run, Pi loader and loopback integration, saved-bundle validation, Brave icon reload check, focused final-segment review, and final whole-contract review.

## Acceptance criteria

- The dependency-free package and unpacked companion install from documented local or Git paths.
- On Brave 1.95.101+ for macOS, toolbar authorization opens the global side panel and explicit Enable gates injection for every applicable document.
- New tabs and access-revoking navigation require fresh toolbar authorization; every new document requires Enable; restricted pages fail without deleting pending state.
- Draft text, focus, and caret survive polling and unrelated refreshes. Accepted, cancelled, removed, or replaced targets clear only the intended draft.
- Saved annotations contain non-empty comments, bounded target evidence, and one target-outlined viewport PNG without side-panel controls.
- Capture, edit, delete, prompt, transfer, validation, and save failures preserve retryable state as specified.
- Default Brave with no bridge and no picker disables Finish, displays persistent `/annotate` guidance, and retains state. Authenticated reconnection restores Finish without recapture.
- `/annotate` binds only to `127.0.0.1:43127`, authenticates the stable extension origin and random token, reveals no project path, validates complete payloads, and stops on every terminal path.
- Bridge Finish confirms an in-project destination, never overwrites, and exposes a valid final directory only after complete validation and atomic write.
- Schema fixtures and saved bundles reject unsupported or unsafe structures and resolve every referenced PNG.
- A later Pi session can consume a named or latest valid bundle through ordinary path language.
- The extension contains source plus 16, 32, 48, and 128 pixel generated PNG icons; manifest and action mappings resolve, package output includes them, permissions remain exact, and the icon is recognizable in Brave at toolbar size.
- Complete checks, focused review, final contract review, spec/link/fence checks, and `git diff --check` pass with residual uncertainty recorded.

## Testing decisions and seams

- Use the runtime's built-in JavaScript test runner and hand-written browser API doubles. Add no test dependency.
- Preserve tests for action grants, navigation, worker replacement, stable drafts, capability status, bridge loss, reconnection, bundle validation, path safety, save ordering, and `.gitignore` behavior.
- Add manifest assertions for exact icon maps, exact unchanged permissions, Chrome 116 API floor, and deterministic key.
- Parse PNG signatures and IHDR dimensions with Node's built-in `fs` and buffer APIs. Assert 16, 32, 48, 128, and 1024 square images at expected paths.
- Use temporary directories for bridge/filesystem checks and retain no-overwrite, traversal and symlink rejection, atomic rename, collision, cleanup, and latest-valid evidence.
- Reuse the recorded Brave Browser 153.1.95.102 on macOS 26.4 workflow matrix and validated bundles. Manually reload the extension after icon wiring and inspect `brave://extensions` plus the toolbar at normal display scale.
- Medium assurance requires one focused final-segment review and one final whole-contract review. Findings must identify a violated contract, credible failure path, meaningful harm, and smallest correction.

## Verification plan

- Run `node --test`.
- Run `find browser-extension extensions -name '*.js' -print0 | xargs -0 -n1 node --check`.
- Parse package, manifest, JSON fixtures, and icon PNG headers/dimensions through automated tests or a focused Node command.
- Run the actual Pi package discovery/load and non-TUI `/annotate` refusal smoke checks.
- Run `npm pack --dry-run --json`; verify the Pi extension, browser companion, source and derived icons, README, and metadata are included without spec, wiki, tests, or generated annotation bundles.
- Run temporary-repository and loopback scenarios for authentication, bounds, validation, path safety, no-overwrite, atomic save, `.gitignore`, timeout, cancel, shutdown, bridge loss, reconnection, and retry.
- Validate the recorded `.pi-annotations/` bundles and latest-valid selection without treating bundle contents as instructions.
- Reload the unpacked extension in current Brave, verify extension ID remains `kemcbalaoccidjnoggajcgjhjlpibbkg`, and confirm the icon is clear in `brave://extensions` and at toolbar size.
- Run one focused review over T05 and its integration with retained T01 and frozen T02/T03/T04 work, then one final contract-quality review over the complete Brave-only plan.
- Run `uv run spec/scripts/manage-spec-item.py --root . validate --item 260916-1901-pi-web-annotator`, resolve changed Markdown links, verify fenced-code balance, and run `git diff --check` before completion.

## Risks and blockers

- **Generated icon legibility:** detailed or undersized artwork can collapse at 16 pixels. Mitigation: a very large simple high-contrast motif with minimal safe padding, deterministic downscaling, automated dimensions, and live toolbar review.
- **Image-generation availability:** provider access may fail. Mitigation: stop and report the blocker rather than substitute unapproved artwork.
- **Action-grant timing:** panel opening must remain inside the toolbar gesture. Mitigation: retain action-event tests and passing Brave evidence.
- **Draft regression:** refreshes can replace active controls. Mitigation: stable selection-keyed views, focused tests, and retained live evidence.
- **Bridge-only recovery:** missing bridge prevents guaranteed Brave save. Mitigation: persistent guidance, retained state, automatic reconnection, and lifecycle tests.
- **Capability drift:** Brave or another browser may change File System Access availability. Mitigation: capability detection and no support claim based on optional standalone behavior.
- **Bridge spoofing or CSRF:** webpages may probe loopback. Mitigation: exact loopback bind, stable extension-origin allowlist, random token, strict request validation, and no generic filesystem API.
- **Memory, validation, and partial-output risk:** enforce established limits, shared fixtures, Pi-side revalidation, atomic bridge writes, and manifest-last optional standalone validity.

## Progress

- [x] Initial discovery and plan confirmed.
- [x] T01 completed and checkpointed; affected assumptions were later invalidated by live evidence.
- [x] R001 and R002 confirmed and applied; T02 and T03 preserved as frozen attempted work.
- [x] R003 confirmed and applied; T04 capability work and Brave evidence preserved as frozen attempted work.
- [x] T05 Brave-only support and generated icon completion verified.
- [ ] Completion archival pending explicit terminal approval.

## Execution handoff

Use `/skill:gamemaster-implement 260916-1901-pi-web-annotator` in a fresh Pi session. Read `item.yaml`, this plan, `implementation/index.md`, and only Current packet `05.01`. Treat packets `02.01`, `03.01`, and `04.01` as frozen history, preserve their valid source work, and do not rewrite completed or frozen packets.

## Proposed durable knowledge updates

After verified implementation, update the repository wiki with the Brave-only support boundary, action authorization, stable drafts, bridge-only guaranteed save mode, optional capability-detected standalone behavior, generated icon assets, bundle schema, installation, and final verification commands. Do not present planned behavior as current before verification.
