# Pi Web Annotator

Pi Web Annotator is a dependency-free Manifest V3 companion for collecting structured element comments and viewport screenshots in Google Chrome or Chromium. This slice supports standalone local saves. The Pi bridge remains visibly disconnected until the later bridge slice; no daemon, cloud service, native messaging host, or LLM turn is started.

## Supported environment

- macOS with current Google Chrome or Chromium proper, Chrome 114 or newer.
- Chromium derivatives, other desktop operating systems, Firefox, Safari, and mobile are not guaranteed in v1.
- File System Access must be available to the extension side panel.

## Load the unpacked companion

1. Clone or download this package.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this repository's `browser-extension/` directory.
5. Pin **Pi Web Annotator** if desired. Its checked-in public manifest key gives unpacked installs the deterministic extension ID `kemcbalaoccidjnoggajcgjhjlpibbkg` (the key is public identity material, not a secret).

The package contains no third-party runtime or test dependencies. A later slice will add the conventionally discovered Pi extension and `/annotate` bridge workflow.

## Annotate and save standalone

1. Visit an HTTP or HTTPS page and click the toolbar action to open the global side panel and grant `activeTab` for that document.
2. Click **Enable annotation on this page**. Permission is granted only to that active document. On every other tab and after every navigation, click the toolbar action again and explicitly enable the new document.
3. Hover a candidate and click it. The temporary blue candidate outline is removed, and bounded target evidence appears in the side panel.
4. Enter a non-empty plain-text comment and choose **Accept comment and capture**. Keep that page active: the target alone receives a red capture outline while Chrome captures the visible viewport. The annotation is added only after capture succeeds.
5. Edit comments without recapturing, delete annotations and their pending screenshots, or use the confirmed **Cancel session** action.
6. Choose **Finish and save…**. The directory picker opens directly from that click. Select the project root, not `.pi-annotations/` itself.
7. Confirm or decline the separate prompt to create or minimally append `.pi-annotations/` in the project-root `.gitignore`. Declining does not cancel the bundle save and produces a warning.

Pending state is held in `chrome.storage.session`, so service-worker suspension does not lose it. Full Chrome restart recovery is intentionally not promised. Capture, picker, permission, validation, and write failures retain pending state for retry.

## Permissions and privacy boundary

The manifest requests exactly:

- `activeTab` for explicit per-document access and viewport capture;
- `scripting` for user-triggered content-script injection;
- `sidePanel` for the browser-owned UI;
- `storage` solely for `chrome.storage.session` suspension resilience; and
- host access only to `http://127.0.0.1:43127/*`, reserved for the later authenticated local bridge.

There is no all-sites host access. Page-derived strings and screenshots are untrusted serialized evidence, never commands. Target capture excludes current form values, event-handler and executable attributes, style and URL attributes, extension controls, and script/style/template content. It records bounded visible text, a privacy-aware attribute allowlist, sanitized bounded `outer_html`, CSS and XPath locators, element rectangle, scroll, viewport, and device-pixel ratio. Every bounded string carries an explicit `truncated` flag.

## Bundle contract (`schema_version: 1`)

A standalone save creates a non-overwriting directory:

```text
.pi-annotations/
`-- YYYYMMDD-HHMMSSZ[-NN]/
    |-- annotations.json
    `-- screenshots/
        `-- annotation-NNNN.png
```

Capture IDs are sortable UTC timestamps. An existing name, including an incomplete prior attempt, causes a deterministic `-01`, `-02`, and so on rather than overwrite. PNGs are written first and `annotations.json` last. Only a directory with a parseable, valid manifest and every referenced PNG is a valid capture; latest-bundle discovery must ignore incomplete directories and choose the lexicographically latest valid directory.

`annotations.json` contains only:

- integer `schema_version: 1`;
- capture ID plus UTC creation and completion timestamps;
- generator name and version;
- ordered pages with stable session-local IDs, URL, title, and ordered annotations;
- annotations with stable IDs, plain-text comment and timestamps, bounded target evidence, and `{ path, media_type, bytes }` PNG metadata.

Paths are normalized relative paths under `screenshots/`. Absolute paths, traversal, base64 image content in JSON, unsupported fields or versions, duplicate IDs, malformed timestamps, empty comments, unsafe attributes, image mismatches, and unresolved or extra PNGs are rejected.

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
| Manifest plus PNG payload | 7,000,000 bytes |
| Serialized session target | 9,000,000 bytes |

Chrome 114 provides a 10 MiB `chrome.storage.session` quota. The lower 9,000,000-byte target leaves headroom after PNG base64 expansion and session bookkeeping; the bundle and image limits guarantee the stored snapshot remains below that target. Oversized comments, images, sessions, and bundles are rejected without clearing pending state. Bounded DOM strings and allowed attribute values are explicitly marked when truncated.

## Troubleshooting

- **Side panel does not open:** confirm Chrome 114+, reload the unpacked extension, and click its toolbar action again.
- **Page cannot be enabled:** Chrome restricts internal pages such as `chrome://`, the Web Store, PDF/browser UI, and some protected documents. Use an ordinary HTTP or HTTPS page.
- **Selection disappeared after navigation:** this is intentional. Enable the new document again; accepted annotations from the prior page remain pending.
- **Screenshot capture failed:** activate the selected page, keep it visible, then retry accepting the comment. The draft remains pending.
- **Picker was cancelled or permission denied:** click Finish again; annotations remain pending.
- **A partial capture directory exists:** it is invalid without a valid `annotations.json`. Retry creates a suffixed directory and never overwrites it.
- **Pi bridge says disconnected:** expected in this standalone slice. Finish uses the directory picker.

## Manual Chromium checklist

Record Chrome version, macOS version, unpacked extension ID, and pass/fail notes. Automated mocks cannot substitute for these browser checks.

- [ ] On an HTTPS page, toolbar action opens one global side panel; annotation starts only after **Enable**.
- [ ] On HTTP localhost, enable and annotate successfully without permanent page changes.
- [ ] Hover shows only a temporary candidate outline; accepting a comment captures a visible-viewport PNG with only the chosen target outlined and no side-panel controls.
- [ ] A scrolled target records scroll, viewport, rectangle, and device-pixel-ratio evidence.
- [ ] A second tab requires its own enable action; both pages' accepted annotations appear in order.
- [ ] Navigation revokes enablement and requires another explicit action while preserving accepted prior-page annotations.
- [ ] A restricted page reports a clear enable error and does not delete pending state.
- [ ] Empty comments are refused; editing does not recapture; deleting removes the pending PNG; Cancel asks for confirmation.
- [ ] Reloading the side panel or allowing the service worker to suspend retains pending state in the same browser session.
- [ ] Cancelling the directory picker and denying write permission each leave all annotations retryable.
- [ ] Accepting `.gitignore` preserves original bytes and appends only a newline-safe `.pi-annotations/` entry; declining still saves and warns.
- [ ] Two finishes at the same UTC second do not overwrite; the later save receives a numeric suffix.
- [ ] A forced screenshot or file-write failure does not add/clear the affected annotation and does not expose a valid partial manifest.
- [ ] A successful standalone save writes every PNG before `annotations.json`, reports the relative path, and clears only the saved browser revision.
- [ ] Bridge status remains explicitly disconnected and standalone Finish continues to work.

## Development checks

```sh
node --test
find browser-extension -name '*.js' -print0 | xargs -0 -n1 node --check
git diff --check
```
