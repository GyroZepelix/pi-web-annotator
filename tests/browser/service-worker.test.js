"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const extensionDirectory = path.join(__dirname, "..", "..", "browser-extension");
const valid = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "valid-manifest.json"), "utf8"));
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

class ChromeEvent {
  constructor() { this.listeners = []; }
  addListener(listener) { this.listeners.push(listener); }
  emit(...arguments_) { return this.listeners.map((listener) => listener(...arguments_)); }
}

function createHarness(shared = {}) {
  shared.storage ||= {};
  shared.calls ||= [];
  shared.failNextSet ||= false;
  const runtimeMessage = new ChromeEvent();
  const tabsUpdated = new ChromeEvent();
  const tabsRemoved = new ChromeEvent();
  const tab = { id: 7, windowId: 2, active: true, url: "https://example.com/page", title: "Example" };
  const clone = (value) => value === undefined ? undefined : structuredClone(value);
  const chrome = {
    storage: {
      session: {
        async get(key) { return Object.prototype.hasOwnProperty.call(shared.storage, key) ? { [key]: clone(shared.storage[key]) } : {}; },
        async set(values) {
          if (shared.failNextSet) { shared.failNextSet = false; throw new Error("mock session quota failure"); }
          Object.assign(shared.storage, clone(values));
        },
        async remove(key) { delete shared.storage[key]; }
      }
    },
    runtime: {
      onMessage: runtimeMessage,
      onInstalled: new ChromeEvent(),
      onStartup: new ChromeEvent(),
      async sendMessage(message) { shared.calls.push(["runtime.sendMessage", message]); return undefined; }
    },
    sidePanel: { async setPanelBehavior(options) { shared.calls.push(["setPanelBehavior", options]); } },
    scripting: {
      async executeScript(options) {
        shared.calls.push(["executeScript", options]);
        return [{ frameId: 0, documentId: "document-A" }];
      }
    },
    tabs: {
      onUpdated: tabsUpdated,
      onRemoved: tabsRemoved,
      async get(tabId) { assert.equal(tabId, tab.id); return clone(tab); },
      async sendMessage(tabId, message, options) {
        shared.calls.push(["tabs.sendMessage", tabId, message, options]);
        if (message.type === "PREPARE_CAPTURE") return { ok: true };
        return { ok: true };
      },
      async captureVisibleTab(windowId, options) {
        shared.calls.push(["captureVisibleTab", windowId, options]);
        return png;
      }
    }
  };

  const context = vm.createContext({
    chrome,
    console,
    crypto: webcrypto,
    URL,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    ArrayBuffer,
    Buffer,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    setTimeout,
    clearTimeout
  });
  context.importScripts = (...names) => {
    for (const name of names) vm.runInContext(fs.readFileSync(path.join(extensionDirectory, name), "utf8"), context, { filename: name });
  };
  vm.runInContext(fs.readFileSync(path.join(extensionDirectory, "service-worker.js"), "utf8"), context, { filename: "service-worker.js" });

  async function message(payload, sender = {}) {
    const listener = runtimeMessage.listeners[0];
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("message response timeout")), 1000);
      listener(payload, sender, (response) => { clearTimeout(timeout); resolve(response); });
    });
  }
  return { chrome, message, shared, tab, tabsUpdated };
}

test("explicit enablement and session storage survive service-worker replacement", async () => {
  const first = createHarness();
  const enabled = await first.message({ type: "ENABLE_TAB", tabId: 7 });
  assert.equal(enabled.ok, true);
  assert.equal(enabled.state.enabled["7"].documentId, "document-A");
  assert.deepEqual(Array.from(first.shared.calls.find((call) => call[0] === "executeScript")[1].files), [
    "lib/constants.js", "lib/selectors.js", "content-script.js"
  ]);

  const second = createHarness(first.shared);
  const recovered = await second.message({ type: "GET_STATE" });
  assert.equal(recovered.state.enabled["7"].pageId, "page-0001");
  assert.equal(recovered.state.annotationCount, 0);
  assert.equal(recovered.state.bridge.status, "disconnected");
});

test("capture is outlined, added only after PNG persistence, editable, and deletable", async () => {
  const harness = createHarness();
  await harness.message({ type: "ENABLE_TAB", tabId: 7 });
  const target = structuredClone(valid.pages[0].annotations[0].target);
  const sender = { tab: harness.tab, documentId: "document-A" };
  assert.equal((await harness.message({ type: "TARGET_SELECTED", selectionId: "12345678-1234-4123-8123-123456789abc", target }, sender)).ok, true);

  harness.shared.failNextSet = true;
  const failed = await harness.message({ type: "ACCEPT_COMMENT", pageId: "page-0001", comment: "Keep this retryable" });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /session quota failure/);
  let current = await harness.message({ type: "GET_STATE" });
  assert.equal(current.state.annotationCount, 0);
  assert.ok(current.state.drafts["page-0001"]);
  assert.equal(harness.shared.calls.filter((call) => call[0] === "captureVisibleTab").length, 1);
  assert.ok(harness.shared.calls.some((call) => call[0] === "tabs.sendMessage" && call[2].type === "CLEAR_CAPTURE"));

  const accepted = await harness.message({ type: "ACCEPT_COMMENT", pageId: "page-0001", comment: "Keep this retryable" });
  assert.equal(accepted.ok, true);
  current = await harness.message({ type: "GET_STATE" });
  assert.equal(current.state.annotationCount, 1);
  assert.equal(Object.keys(current.state.drafts).length, 0);
  assert.equal(harness.shared.calls.filter((call) => call[0] === "captureVisibleTab").length, 2);

  await harness.message({ type: "EDIT_COMMENT", annotationId: "annotation-0001", comment: "Edited without recapture" });
  assert.equal(harness.shared.calls.filter((call) => call[0] === "captureVisibleTab").length, 2);
  current = await harness.message({ type: "GET_STATE" });
  assert.equal(current.state.pages[0].annotations[0].comment, "Edited without recapture");

  await harness.message({ type: "DELETE_ANNOTATION", annotationId: "annotation-0001" });
  current = await harness.message({ type: "GET_STATE" });
  assert.equal(current.state.annotationCount, 0);
  const storageState = Object.values(harness.shared.storage)[0];
  assert.deepEqual(storageState.screenshots, {});
});

test("navigation revokes document enablement without deleting accepted annotations", async () => {
  const harness = createHarness();
  await harness.message({ type: "ENABLE_TAB", tabId: 7 });
  await harness.message({
    type: "TARGET_SELECTED",
    selectionId: "12345678-1234-4123-8123-123456789abc",
    target: structuredClone(valid.pages[0].annotations[0].target)
  }, { tab: harness.tab, documentId: "document-A" });
  await harness.message({ type: "ACCEPT_COMMENT", pageId: "page-0001", comment: "Persist after navigation" });
  harness.tabsUpdated.emit(7, { status: "loading" });
  const current = await harness.message({ type: "GET_STATE" });
  assert.equal(current.state.annotationCount, 1);
  assert.equal(Object.keys(current.state.enabled).length, 0);
});

test("message boundaries reject unsupported fields and missing completion revisions", async () => {
  const harness = createHarness();
  const extra = await harness.message({ type: "GET_STATE", unexpected: true });
  assert.equal(extra.ok, false);
  assert.match(extra.error, /unsupported or missing fields/);
  const incomplete = await harness.message({ type: "COMPLETE_SESSION" });
  assert.equal(incomplete.ok, false);
  assert.match(incomplete.error, /unsupported or missing fields/);
});

test("completion refuses to clear state changed after the saved snapshot", async () => {
  const harness = createHarness();
  await harness.message({ type: "ENABLE_TAB", tabId: 7 });
  await harness.message({
    type: "TARGET_SELECTED",
    selectionId: "12345678-1234-4123-8123-123456789abc",
    target: structuredClone(valid.pages[0].annotations[0].target)
  }, { tab: harness.tab, documentId: "document-A" });
  await harness.message({ type: "ACCEPT_COMMENT", pageId: "page-0001", comment: "Snapshot" });
  const finish = await harness.message({ type: "GET_FINISH_DATA" });
  await harness.message({ type: "EDIT_COMMENT", annotationId: "annotation-0001", comment: "Newer state" });
  const completion = await harness.message({ type: "COMPLETE_SESSION", revision: finish.data.revision });
  assert.equal(completion.ok, false);
  assert.match(completion.error, /changed while saving/);
  assert.equal((await harness.message({ type: "GET_STATE" })).state.annotationCount, 1);
});
