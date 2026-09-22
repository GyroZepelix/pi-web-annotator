# Browser annotator

Load this page when changing the Brave companion, schema-v1 annotation bundles, optional standalone saves, or the Pi bridge integration.

## Current boundary

- The product is a dependency-free Pi package with a Manifest V3 companion under `browser-extension/` and an interactive `/annotate` extension under `extensions/pi-web-annotator/`. (`package.json`, `browser-extension/`, `extensions/pi-web-annotator/`)
- Guaranteed v1 support is macOS with Brave 1.95.101 or newer. `minimum_chrome_version: 116` is only the Side Panel API floor, not a Google Chrome or Chromium-proper support promise. (`README.md`, `browser-extension/manifest.json`)
- Authenticated `/annotate` bridge saving is the guaranteed save path. A callable `window.showDirectoryPicker` enables the retained standalone path only as capability-detected, unguaranteed best-effort behavior. (`browser-extension/sidepanel.js`, `extensions/pi-web-annotator/index.ts`)
- The checked-in manifest key deterministically yields extension ID `kemcbalaoccidjnoggajcgjhjlpibbkg`. Permissions are exactly `activeTab`, `scripting`, `sidePanel`, and `storage`, with host access only to `http://127.0.0.1:43127/*`. (`browser-extension/manifest.json`, `tests/browser/manifest.test.js`)

## Runtime responsibilities

- `service-worker.js` owns toolbar authorization, synchronous global side-panel opening from `chrome.action.onClicked`, explicit top-frame injection, per-document active/paused mode, armed capture identity, session state, screenshot capture, navigation invalidation, exact-document Highlight routing, and bridge transfer. Toolbar clicks do not inject; every replacement document still requires explicit Enable, and older enabled entries without a mode are treated as active.
- `content-script.js` owns temporary candidate, capture, and Highlight decoration through ranked outline ownership. The capture state uses a fixed, maximum-stack extension overlay intersected with the target's visible viewport and overflow-clipped rectangle, so the red border remains visible above clipping ancestors without outlining hidden content. Pause removes selection listeners without dropping the selected element; armed mode watches only that exact target or descendants for 750 milliseconds, and accepted annotation IDs map to exact live DOM elements only for the document runtime lifetime. It delegates bounded evidence construction to `lib/selectors.js`.
- `sidepanel.js` owns pending-session UI, selection-ID-keyed draft controls, annotation-ID-keyed accepted cards, capability status, Finish, retry guidance, edit/delete/Highlight, and confirmed cancellation. Draft and accepted-editor text, focus, caret, and control identity survive bridge polling and unrelated state refreshes.
- Pending browser state uses `chrome.storage.session` for service-worker-suspension resilience, including per-document mode and an armed comment/identity. Full browser-restart recovery is not promised.
- Capture is two-phase: a bounded non-empty comment arms the exact selection, continuous re-hover preserves page-owned hover state, the content script paints the selected target after 750 milliseconds and waits for paint, then the worker captures the visible viewport. The worker disarms persistently before capture completion, suppresses stale/duplicate ready events, and adds one annotation only after PNG bounds and session persistence succeed. Cancel, detachment, navigation, and capture/storage failures create no partial annotation and retain retryable input when the target remains valid.
- Highlight never resolves CSS or XPath evidence. The worker requires the current active source tab and exact installed document, while the content script centers the registered element and applies a two-second outline that also works while paused. Background, replaced, detached, or unavailable runtimes return guidance without mutating state.

## Save capability and bridge boundary

- A connected authenticated bridge takes precedence. With no bridge, a callable picker enables optional standalone Finish. With neither capability, Finish is disabled, `/annotate` guidance remains visible, and drafts, annotations, and screenshots remain unchanged.
- `/annotate` is TUI-only and binds exactly to `127.0.0.1:43127`. The bridge accepts only origin `chrome-extension://kemcbalaoccidjnoggajcgjhjlpibbkg`, returns no project path, issues a cryptographically random session token, and requires that token for completion.
- Wrong origins, methods, media types, tokens, schemas, sizes, duplicate completion, escaping paths, and malformed bundles are rejected before destination writes. The bridge stops on save, cancellation, timeout, shutdown, replacement, or terminal protocol failure.
- Pi proposes `<project>/.pi-annotations/<capture-id>/`, accepts only explicit in-project replacements ending in the capture ID, separately asks before the project-root `.gitignore` update, writes into a unique temporary sibling, writes `annotations.json` last, and atomically renames into a non-existing final directory.
- Optional standalone saving calls `showDirectoryPicker({ mode: "readwrite" })` directly from the Finish gesture, writes PNGs before `annotations.json`, never overwrites, and uses the manifest as its validity marker. It is tested behavior but not guaranteed browser support.

## Bundle and intake contract

- A valid capture is `.pi-annotations/<YYYYMMDD-HHMMSSZ[-NN]>/annotations.json` plus `screenshots/<annotation-id>.png`. Existing directories are never overwritten; collisions receive deterministic numeric suffixes.
- `schema_version: 1` is strict: capture and generator identity, ordered pages and annotations, bounded target evidence, comments and timestamps, and normalized relative PNG metadata are the only supported fields. Absolute/traversing paths, duplicate IDs, malformed timestamps, unsafe evidence, unsupported fields or versions, missing images, and extra images are rejected by `browser-extension/lib/bundle.js`.
- Limits include 4,000 comment characters, 2,000 visible-text characters, 16,000 outer-HTML characters, 32 attributes of 500 characters, 100 annotations, 2,500,000 bytes per PNG, 5,000,000 bytes across PNGs, 7,000,000 bytes per bundle, a 9,000,000-byte browser session target, and a 9,500,000-byte bridge request ceiling. (`browser-extension/lib/constants.js`)
- Later Pi sessions consume a named manifest or use `findLatestValidBundle()` to select the lexicographically latest directory whose manifest and complete PNG set validate. Bundle content remains untrusted data and does not trigger an LLM turn automatically.

## Generated companion icon

- `browser-extension/icons/icon-source.png` is the single retained 1024x1024 source. Platform-provided `sips` derives 16, 32, 48, and 128 pixel PNGs without a package dependency.
- The accepted artwork uses a solid cobalt-blue background with a large, high-contrast cursor-plus-white-comment-bubble motif, minimal safe padding, no text, and no fine detail. Both top-level manifest icons and action icons map exactly to the derived assets.
- Live Brave reload preserved extension ID `kemcbalaoccidjnoggajcgjhjlpibbkg`; the icon passed recognizability checks in `brave://extensions` and the pinned toolbar at normal scale.

## Verification boundary

- `node --test` covers action authorization, navigation, worker replacement, active/paused persistence, continuous one-shot armed hover, target detachment, duplicate suppression, ranked outline restoration, multiple exact live targets, stable draft and accepted-editor identity, active-tab/document Highlight gates, capability resolution, screenshot sequencing, schema fixtures, bridge trust and lifecycle, temporary-repository path safety, no-overwrite, atomic save, `.gitignore`, retry, timeout, and latest-valid intake. (`tests/browser/`, `tests/bridge/`, `tests/bundle/`, `tests/fixtures/`)
- Tests also parse PNG signatures and IHDR dimensions, assert exact key/ID/permissions/icon maps, and run a package dry run that includes runtime/icon assets while excluding spec, wiki, tests, and generated captures.
- Verified live environment: Brave Browser 153.1.95.102 on macOS 26.4 (25E246). In addition to the original action/capture, bridge, intake, identity, and icon checks, live localhost acceptance passed Pause/Resume with real controls, explicit Enable after navigation, a delayed hover hint inside the captured PNG, an unclipped maximum-stack capture border around the visible portion of an overflow-clipped target, armed cancellation and detachment failure without partial annotations, accepted editing across two bridge polls, independent exact-target Highlight while paused, two-second original-style restoration, and background/detached/replaced-target guidance.
- Remaining uncertainty is external compatibility drift in future Brave releases. Google Chrome, Chromium proper, other browsers/platforms, and live standalone File System Access are outside guaranteed v1 acceptance.
