# Browser integration research

Date: 2026-09-16
Status: Current frontier evidence

## Question

What is the smallest practical way for a Pi extension to support in-page element annotation, screenshots, and a user-chosen local export?

## Findings

### Pi extension capabilities

- Pi extensions are TypeScript modules that can register slash commands and tools, prompt through `ctx.ui`, start and clean up session-scoped processes, and inject a user message with `pi.sendUserMessage()`.
- Pi packages can bundle an extension and runtime dependencies. Third-party runtime dependencies belong in `dependencies`; Pi's own packages belong in `peerDependencies`.
- Pi does not itself expose a web-page DOM. In-page highlighting and element selection therefore require either a browser component or a browser controlled through automation.

Evidence: local Pi documentation at `docs/extensions.md`, `docs/packages.md`, and `examples/extensions/send-user-message.ts` in the installed `@earendil-works/pi-coding-agent` package.

### Chromium companion extension

- A Manifest V3 extension can use a content script for page interaction and communicate with its service worker.
- `tabs.captureVisibleTab()` captures the visible area of the active tab, returns an image data URL, and can operate under temporary `activeTab` permission after a user gesture. It does not capture an entire scrollable page by itself.
- `downloads.download({ saveAs: true })` opens a file chooser, but suggested paths are relative to the browser's Downloads directory. It cannot silently target an arbitrary project path.
- An extension service worker can send data to a loopback HTTP endpoint when the matching localhost host permission is declared. A short-lived Pi-side server can therefore bridge the browser to the active Pi project's `ctx.cwd` without installing a native-messaging host.
- Native messaging can write through a separately installed desktop host, but that adds OS-specific registration and installation work.

Implication: for an existing logged-in browser session and project-aware output, the pragmatic architecture is a small Chromium extension plus a short-lived authenticated loopback server owned by the Pi command. It is more integrated than a browser-only download, but materially simpler to install than native messaging.

Sources:
- [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Chrome Downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads)
- [Chrome cross-origin network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Chrome native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)

### Standalone directory save

- Chromium's File System Access API can show a directory picker and then create multiple files and subdirectories under the returned directory handle.
- `showDirectoryPicker({ mode: "readwrite" })` requires a secure context and transient user activation. It is a `Window` API, so an MV3 service worker cannot call it.
- The most reliable extension context is a visible extension-owned page, popup, or side panel with a Save/Finish button that calls the picker directly. Deferring the picker through a service-worker message can lose user activation.
- The extension can write screenshots first and `annotations.json` last. The manifest's presence is the standalone commit marker; an interrupted earlier write may leave an incomplete dated directory but not a valid bundle.

Implication: a browser side panel is the strongest KISS UI candidate because it can remain visible during page selection, host comments and Finish, and invoke the standalone directory picker directly. In bridge mode the same Finish action can send the bundle to Pi instead.

Sources:
- [Chrome File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)
- [MDN `showDirectoryPicker()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)

### Playwright-controlled browser

- Playwright directly supports viewport, full-page, and element screenshots.
- It can execute JavaScript against a located DOM element and run a headed browser.
- This removes the need for a separately loaded browser extension, but adds Playwright and browser-runtime dependencies and may not naturally reuse the user's normal authenticated browser profile.

Implication: Playwright is attractive when full-page capture and deterministic automation matter more than using the user's current browser session. It is not the default KISS choice for annotating arbitrary pages already open in a normal browser.

Sources:
- [Playwright screenshots](https://playwright.dev/docs/screenshots)
- [Playwright locator API](https://playwright.dev/docs/api/class-locator)
- [Playwright Chrome extensions](https://playwright.dev/docs/chrome-extensions)

## Current recommendation

Start with a Chromium-only companion extension and an optional short-lived token-authenticated loopback server launched by a Pi slash command. Keep browser permissions narrow and bind the server only to loopback. Use one extension-owned visible UI for annotation state and Finish. When the bridge is active, transfer the bundle to Pi for project-aware save; otherwise call the Chromium directory picker directly and write under the user-selected project root.

Main trade-off: bridge mode requires two cooperating pieces, while standalone mode relies on Chromium's non-cross-browser File System Access API. This is proportionate to the confirmed Chromium-on-macOS scope and avoids a permanent daemon, native host, ZIP, or base64 screenshots.
