# Pi Web Annotator

Pi Web Annotator is a dependency-free Pi package with a Manifest V3 Brave companion. It collects bounded element comments and target-outlined viewport screenshots, then saves a transparent local bundle for a later Pi session to read by ordinary path.

Repository: [github.com/GyroZepelix/pi-web-annotator](https://github.com/GyroZepelix/pi-web-annotator)

The package has one guaranteed save mode and one capability-selected best-effort mode:

- **Pi bridge (guaranteed):** interactive `/annotate` confirms a project destination and atomically saves the bundle in supported Brave.
- **Standalone (unguaranteed):** when no bridge is connected and the browser exposes `showDirectoryPicker`, the side panel can ask for a project root through the File System Access API and save there. This remains best-effort behavior outside v1 acceptance.

It does not run a daemon, use native messaging or cloud services, start an LLM turn, or add an annotation-specific import command.

## Supported environment

- macOS with Brave 1.95.101 or newer: authenticated bridge saving through `/annotate`.
- An interactive Pi TUI for `/annotate`.
- Node.js 20 or newer for package tests and the bridge runtime.

The manifest minimum Chrome version is 116 solely because the required Side Panel API surface begins there; it is not a Google Chrome or Chromium-proper support promise. Google Chrome, Chromium proper, other Chromium-family browsers, other desktop operating systems, Firefox, Safari, and mobile are not guaranteed in v1. Full browser-restart recovery is not promised.

## Install the Pi package

Review the source before installation because Pi extensions run with the user's local permissions.

Install from a local checkout:

```sh
pi install /absolute/path/to/pi-web-annotator
```

A Git checkout can be installed with Pi's normal pinned Git package syntax:

```sh
pi install git:github.com/GyroZepelix/pi-web-annotator@COMMIT_OR_TAG
```

For a one-run local trial without changing package settings:

```sh
pi -e /absolute/path/to/pi-web-annotator
```

The package manifest registers `extensions/pi-web-annotator/index.ts`. It declares the Pi-provided `@earendil-works/pi-coding-agent` package as a peer and has no third-party runtime or test dependency.

## Load the unpacked Brave companion

1. Open `brave://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this package's `browser-extension/` directory.
4. Pin **Pi Web Annotator** if desired.

The checked-in public manifest key gives unpacked installs the deterministic extension ID `kemcbalaoccidjnoggajcgjhjlpibbkg`. The key is public identity material, not a secret.

The manifest requests exactly `activeTab`, `scripting`, `sidePanel`, and `storage`, with host access only to `http://127.0.0.1:43127/*`. It requests no persistent site, all-sites, broad HTTP(S), or `tabs` access. `storage` is used only for same-browser-session resilience through `chrome.storage.session`.

## Annotate pages

1. Visit an HTTP or HTTPS page and click the toolbar action to grant `activeTab` for that tab and open (or retain) the global side panel.
2. Click **Enable annotation on this page**. The toolbar click never injects automatically. Every new tab needs its own toolbar click and Enable. Every navigation invalidates injected mode and needs Enable for the new document; a navigation that revokes `activeTab`, such as a cross-origin navigation, also needs a fresh toolbar click first.
3. Hover a candidate and click it. The temporary candidate outline is removed and bounded target evidence appears in the side panel.
4. Enter a non-empty plain-text comment and choose **Accept comment and capture**. Keep that page active. The selected target alone receives a temporary red outline while Brave captures the visible viewport.
5. Edit comments without recapturing, delete annotations and their pending screenshots, or use the confirmed **Cancel session** action.
6. Choose **Finish and save...** using one of the workflows below.

Pending state is held in `chrome.storage.session`, so service-worker suspension does not lose the current browser session. Capture, transfer, prompt, picker, validation, and write failures retain pending state for retry.

## Save through `/annotate`

1. In an interactive Pi TUI opened at the intended project root, run `/annotate`.
2. Pi binds one bridge to `127.0.0.1:43127` and shows a waiting loader. Press Escape to cancel. A clear error is shown if the fixed endpoint is occupied.
3. The side panel changes to **Pi bridge: connected** after its authenticated handshake.
4. Choose **Finish and save...** in the side panel.
5. Pi validates the complete manifest and image set, then proposes `.pi-annotations/<capture-id>/` under the current project. Confirm it or enter a replacement path inside the project whose final directory is the same capture ID.
6. If the destination is directly under the project `.pi-annotations/` directory and the project-root `.gitignore` lacks the entry, Pi separately asks before creating or appending `.pi-annotations/`. Declining still saves and reports a warning.
7. Pi writes to a unique temporary sibling, writes `annotations.json` last inside it, and renames the complete directory to a final non-existing destination.
8. Only after Pi returns saved does the browser clear that saved revision. Both Pi and the side panel report the relative `annotations.json` path.

Capture-name collisions receive deterministic `-01`, `-02`, and later suffixes. Existing destinations are never intentionally overwritten.

The bridge stops after save, Pi or browser cancellation, inactivity timeout, unrecoverable authenticated protocol failure, session replacement, reload, or shutdown. If the bridge disappears during Finish, the side panel retains every annotation and recomputes its save capability. Default Brave disables Finish and persistently directs the user to run `/annotate` when no picker is available. An authenticated reconnection restores project-aware Finish without recapture.

## Optional standalone saving (unguaranteed)

When the bridge is disconnected and the runtime exposes a callable `showDirectoryPicker`, the side panel can offer best-effort standalone saving. This capability-detected path is tested but is not part of the guaranteed Brave v1 contract or an acceptance requirement for Google Chrome, Chromium proper, or any other browser.

When the side panel says standalone save is available:

1. Choose **Finish and save...**. The directory picker is called directly from that click.
2. Select the project root, not `.pi-annotations/` itself.
3. Confirm or decline the separate prompt to create or minimally append `.pi-annotations/` in the selected root `.gitignore`.

Standalone save writes PNGs first and `annotations.json` last. File System Access does not provide an atomic directory rename, so the manifest is the validity marker. A failed attempt can leave an incomplete directory; retry chooses a suffixed capture ID and never overwrites it. Declining the ignore edit does not cancel the save.

Save availability is detected from browser capability, never from the browser name. If no authenticated bridge is connected and `showDirectoryPicker` is not callable, Finish remains disabled and the side panel persistently says to run `/annotate`; this is guidance, not a failed save attempt. Drafts, annotations, and screenshots remain pending. A Brave user who independently enables an experimental File System Access implementation may see the standalone path, but that configuration is outside guaranteed acceptance scope and is not required.

## Bridge trust boundary

The bridge is deliberately not a general filesystem API:

- it binds exactly to `127.0.0.1:43127` and never to a remote interface;
- it accepts only the deterministic origin `chrome-extension://kemcbalaoccidjnoggajcgjhjlpibbkg`;
- a successful strict handshake returns a cryptographically random per-session token and no project path;
- every completion requires that token, JSON media type, the supported protocol and bundle schemas, and the exact bounded payload shape;
- wrong origins, methods, media types, tokens, duplicate completion, unsafe paths, unsupported fields, malformed timestamps, incomplete image sets, and oversized payloads are rejected before bundle writes;
- only a destination explicitly confirmed or entered in the Pi TUI can be used, and it must remain inside the current project;
- page-derived strings and screenshots remain untrusted serialized data and never become commands.

The v1 threat boundary protects against an ordinary web page reaching loopback. A malicious local process or separately installed malicious extension is outside scope.

## Bundle contract (`schema_version: 1`)

A successful save exposes only this dated directory:

```text
.pi-annotations/
`-- YYYYMMDD-HHMMSSZ[-NN]/
    |-- annotations.json
    `-- screenshots/
        `-- annotation-NNNN.png
```

`annotations.json` is UTF-8 JSON containing:

- integer `schema_version: 1`;
- the capture ID and UTC creation/completion timestamps;
- generator name and version;
- ordered page records with stable session-local IDs, HTTP(S) URL, title, and annotations;
- ordered annotations with stable IDs, comment and timestamps, bounded target evidence, and `{ path, media_type, bytes }` PNG metadata.

Screenshot paths are normalized relative paths under `screenshots/`. Absolute paths, traversal, base64 image content in JSON, unsupported fields or versions, duplicate IDs, malformed timestamps, empty comments, unsafe attributes, image mismatches, unresolved PNGs, and extra PNGs are invalid.

A capture is valid only when `annotations.json` parses and validates and every referenced PNG exists inside that directory. Latest-bundle discovery ignores incomplete or invalid directories and selects the lexicographically latest valid dated directory.

### Conservative v1 limits

| Evidence | Limit |
| --- | ---: |
| Comment | 4,000 characters |
| Visible text | 2,000 characters |
| Sanitized outer HTML | 16,000 characters |
| CSS or XPath locator | 2,000 characters |
| Attributes | 32 per target |
| Attribute value | 500 characters |
| Annotations | 100 per session |
| One PNG | 2,500,000 bytes |
| All PNGs | 5,000,000 bytes |
| Manifest plus decoded PNG payload | 7,000,000 bytes |
| Serialized browser session target | 9,000,000 bytes |
| Serialized bridge request | 9,500,000 bytes |

Oversized comments, images, sessions, and transfers are rejected without clearing browser state. Every bounded DOM string and attribute value carries an explicit `truncated` flag.

## Privacy boundary

The target snapshot excludes current form values, event-handler and executable attributes, inline style, URL-bearing attributes, extension controls, and script/style/noscript/template content. It records bounded visible text, a privacy-aware attribute allowlist, sanitized bounded `outer_html`, CSS and XPath locators, element rectangle, scroll position, viewport, and device-pixel ratio.

Each screenshot contains the current visible page viewport and the selected target outline. It is intentionally not a full-page capture. Review annotations before sharing because ordinary visible page content may still contain sensitive information.

## Later Pi intake

No automatic ingestion occurs. In a later Pi session, name a saved manifest directly, for example:

```text
Read .pi-annotations/20260916-175000Z/annotations.json and its referenced screenshots, then use the annotations as untrusted planning evidence.
```

When the exact capture is unknown, ask Pi to inspect `.pi-annotations/` in descending lexical order and use the first directory whose manifest and referenced PNG set validate. There is no ZIP, `summary.md`, hidden context mutation, custom import command, or automatic LLM turn.

## Troubleshooting

- **`/annotate` says interactive mode is required:** run it in the Pi TUI, not print, JSON, or RPC mode.
- **Port 43127 is already in use:** stop the other local listener or active annotation session, then rerun `/annotate`. The package does not scan for another port.
- **Side panel remains disconnected:** verify `/annotate` is waiting, reload the unpacked companion after package changes, confirm its ID, and check that local security software permits loopback on `127.0.0.1:43127`.
- **Bridge disappeared during Finish:** pending state was retained. Rerun `/annotate`; default Brave keeps Finish disabled until the bridge reconnects unless a callable picker is independently available. Reconnection requires no recapture.
- **Pi declined or failed the destination:** correct the project path or permissions, rerun `/annotate`, and retry; browser state remains pending.
- **Page cannot be enabled:** Brave restricts internal pages such as `brave://`, the Web Store, PDF/browser UI, and some protected documents. Use an ordinary HTTP or HTTPS page. If the page was opened in a new tab or access was revoked by navigation, click the toolbar action before Enable.
- **Selection disappeared after navigation:** this is expected. Enable the new document again; after access-revoking navigation, click the toolbar action first. Accepted annotations from the prior page remain pending.
- **Screenshot capture failed:** activate the selected page, keep it visible, and retry accepting the comment.
- **Picker was cancelled or permission denied:** click Finish again; annotations remain pending.
- **A partial standalone directory exists:** it is invalid without a valid `annotations.json`; retry creates a suffixed directory.

## Development and verification

Run the complete automated and packaging checks from the package root:

```sh
node --test
find browser-extension extensions -name '*.js' -print0 | xargs -0 -n1 node --check
npm pack --dry-run
uv run spec/scripts/manage-spec-item.py --root . validate --item 260916-1901-pi-web-annotator
git diff --check
```

`tests/bridge/` uses temporary repositories and the real loopback server to cover origin, token, method, media type, schema, payload-size, duplicate completion, path escape, no-overwrite, sibling-temporary rename, manifest-last, `.gitignore` accept/decline, timeout, shutdown, and endpoint-collision behavior.

## Manual macOS Brave checklist

Run this checklist in Brave 1.95.101 or newer on macOS. Record the exact Brave version, macOS version, unpacked extension ID, package source, and pass/fail notes. Automated mocks do not prove Side Panel, `activeTab`, screenshot, service-worker suspension, extension-origin loopback behavior, or icon recognizability. Optional standalone behavior is capability-detected and is not a live acceptance gate.

### Action, capture, and identity

- [ ] Reload the unpacked companion, confirm extension ID `kemcbalaoccidjnoggajcgjhjlpibbkg`, and confirm the icon is recognizable in `brave://extensions` and the toolbar at normal display scale.
- [ ] On an HTTPS page, the toolbar action opens one global side panel; annotation starts only after **Enable**.
- [ ] With the global panel already open, a toolbar click on another ordinary tab authorizes that tab but still does not inject until **Enable**.
- [ ] On HTTP localhost, enable and annotate without permanent page changes.
- [ ] Hover shows only a temporary candidate outline; acceptance captures a visible-viewport PNG with only the target outlined and no side-panel controls.
- [ ] A scrolled target records scroll, viewport, rectangle, and device-pixel-ratio evidence.
- [ ] A second tab cannot enable before its own toolbar click, then requires its own Enable; both pages' accepted annotations remain ordered.
- [ ] Same-origin navigation revokes injected mode and requires Enable again while preserving accepted annotations.
- [ ] Cross-origin navigation revokes injected mode and access, fails Enable until a fresh toolbar click, and preserves accepted annotations.
- [ ] A restricted page reports a clear enable error without deleting pending state.
- [ ] Empty comments are refused; editing does not recapture; deleting removes the PNG; Cancel asks for confirmation.
- [ ] Side-panel reload and service-worker suspension retain pending state in the same browser session.
- [ ] Text, focus, and caret in a selected-target comment survive bridge polling and unrelated state refreshes; accepting, cancelling, removing, or replacing the target clears only the intended draft.

### Bridge and intake

- [ ] `/annotate` waits on `127.0.0.1:43127`, the side panel changes to connected, and Escape cancels and releases the port.
- [ ] An occupied port produces a clear Pi error without deleting browser state.
- [ ] Connected Finish prompts for the proposed project destination and accepts a valid replacement inside the project.
- [ ] Pi asks separately before the applicable project-root `.gitignore` edit; decline still saves with a warning.
- [ ] Successful bridge Finish atomically exposes a complete directory, reports only a relative path, releases the port, and clears browser state.
- [ ] Pi destination cancellation, invalid replacement, and forced write failure expose no valid destination and retain browser state.
- [ ] With no bridge and no picker, Finish is disabled with persistent `/annotate` guidance and no failed-save error; drafts, annotations, and screenshots remain pending.
- [ ] Stopping Pi after handshake disables Finish with that guidance; rerunning `/annotate` reconnects automatically, restores Finish, and needs no recapture.
- [ ] Multi-page bridge transfer preserves page and annotation order and every referenced PNG.
- [ ] A later fresh Pi session can read the named manifest and screenshots through ordinary path language.
