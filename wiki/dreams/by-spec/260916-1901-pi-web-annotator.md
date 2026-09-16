# Dream learnings: 260916-1901-pi-web-annotator

Work item: `260916-1901-pi-web-annotator`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 260916-1901-pi-web-annotator/01.01

Date: 2026-09-16
Dream log: [2026-09-16-2023-gamemaster-checkpoint-260916-1901-pi-web-annotator-01-01.md](../2026-09-16-2023-gamemaster-checkpoint-260916-1901-pi-web-annotator-01-01.md)
Outcome: retained learning

### Standalone browser contract

- **Exact written text:**
  > # Browser annotator
  >
  > Load this page when changing the Chromium companion, schema-v1 annotation bundles, standalone saves, or the Pi bridge integration that consumes the browser contract.
  >
  > ## Current boundary
  >
  > - The implemented surface is a dependency-free Manifest V3 companion under `browser-extension/`; the Pi bridge is not implemented yet and the side panel deliberately reports it as disconnected. Current 02.01 must extend this browser contract rather than replacing standalone Finish. (`package.json`, `browser-extension/`, `spec/active/260916-1901-pi-web-annotator/implementation/index.md`)
  > - The manifest permits exactly `activeTab`, `scripting`, `sidePanel`, and `storage`, plus `http://127.0.0.1:43127/*`. `storage` exists solely for `chrome.storage.session` resilience; do not add broad host access. (`browser-extension/manifest.json`, plan decision D09)
  >
  > ## Runtime responsibilities
  >
  > - `service-worker.js` owns explicit top-frame injection, per-document enablement, session state, screenshot capture, and navigation invalidation. An accepted annotation is persisted only after the content script paints the target outline and `captureVisibleTab()` returns a bounded PNG.
  > - `content-script.js` owns temporary hover/selection/capture outlines and delegates evidence construction to `lib/selectors.js`. Evidence excludes form values, executable or URL-bearing attributes, extension controls, hidden text, and script/style/template content; bounded strings carry explicit truncation markers.
  > - `sidepanel.js` owns the global pending-session UI. It invokes `showDirectoryPicker({ mode: "readwrite" })` synchronously from Finish, while `lib/filesystem.js` handles confirmed `.gitignore` changes and standalone write ordering.
  > - Browser messages use a closed action vocabulary and strict field-shape validation. Capture, storage, picker, validation, and write failures retain pending state for retry; completion clears only the exact saved revision.
  >
  > ## Bundle and save contract
  >
  > - A valid capture is `.pi-annotations/<YYYYMMDD-HHMMSSZ[-NN]>/annotations.json` plus `screenshots/<annotation-id>.png`. Existing directories are never overwritten; PNGs are written first and `annotations.json` last, making a valid manifest the completion marker.
  > - `schema_version: 1` is strict: capture and generator identity, ordered pages, ordered annotations, bounded target evidence, comments and timestamps, and normalized relative PNG metadata are the only supported fields. Absolute or traversing paths, duplicate IDs, malformed timestamps, unsafe evidence, unsupported fields or versions, and missing or extra images are rejected by `lib/bundle.js`.
  > - Limits are 4,000 comment characters, 2,000 visible-text characters, 16,000 outer-HTML characters, 32 attributes of 500 characters, 100 annotations, 2,500,000 bytes per PNG, 5,000,000 bytes across PNGs, 7,000,000 bytes per bundle, and a measured 9,000,000-byte serialized-session budget below Chrome 114's 10 MiB session quota. (`browser-extension/lib/constants.js`)
  > - `.gitignore` editing is independently confirmed and byte-preserving apart from a newline-safe `.pi-annotations/` append. A declined or failed ignore edit warns without cancelling a successful bundle; an accepted ignore edit may remain if a later bundle write fails, but no valid partial manifest is exposed.
  >
  > ## Verification boundary
  >
  > - Deterministic Node tests cover schema fixtures, permissions, suspension mocks, capture failure, editing/deletion, revision-safe completion, privacy filters, limits, collision naming, `.gitignore` behavior, and manifest-last ordering. The T01 focused re-review passed. (`tests/browser/`, `tests/bundle/`, `tests/fixtures/`)
  > - **Needs review:** no Google Chrome or Chromium proper executable was available for T01, so live Side Panel, `activeTab`, screenshot paint timing, File System Access, and actual session-quota accounting remain unproven. Run the README manual Chromium checklist during Current 02.01 before claiming the integrated workflow complete.
- **Destination and classification:** `wiki/browser-annotator.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The completed T01 source, fixtures, automated checks, and passing focused review establish the browser runtime boundary and bundle contract; the active implementation index makes this contract the dependency for Current 02.01.
- **Expected future benefit:** Future browser and bridge work can preserve permissions, message ownership, privacy filters, save validity, retry semantics, limits, and the outstanding live-browser verification boundary instead of rediscovering or silently weakening them.
- **Why this tier:** These facts form a coherent browser-annotation topic used by T02 and later maintenance, but they are too component-specific for repository-wide conventions and too stable and actionable for an observation.
