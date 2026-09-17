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
  shared.authorizedTabIds ||= new Set();
  shared.tabs ||= {
    7: { id: 7, windowId: 2, active: true, url: "https://example.com/page", title: "Example" },
    8: { id: 8, windowId: 2, active: false, url: "https://other.example/page", title: "Other" }
  };
  shared.documentIds ||= { 7: "document-A", 8: "document-B" };
  const runtimeMessage = new ChromeEvent();
  const actionClicked = new ChromeEvent();
  const tabsUpdated = new ChromeEvent();
  const tabsRemoved = new ChromeEvent();
  const clone = (value) => value === undefined ? undefined : structuredClone(value);
  const visibleTab = (tabId) => {
    const tab = shared.tabs[tabId];
    if (!tab) throw new Error(`No tab with id: ${tabId}`);
    if (shared.authorizedTabIds.has(tabId) || !/^https?:/.test(tab.url)) return clone(tab);
    return { id: tab.id, windowId: tab.windowId, active: tab.active };
  };
  const chrome = {
    action: { onClicked: actionClicked },
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
      async sendMessage(message) { shared.calls.push(["runtime.sendMessage", message]); return undefined; }
    },
    sidePanel: {
      async open(options) {
        shared.calls.push(["sidePanel.open", options]);
        if (shared.rejectOpen) throw new Error("panel is already open");
        shared.panelOpen = true;
      }
    },
    scripting: {
      async executeScript(options) {
        shared.calls.push(["executeScript", options]);
        const tab = shared.tabs[options.target.tabId];
        if (!shared.authorizedTabIds.has(options.target.tabId) || !tab || !/^https?:/.test(tab.url)) {
          throw new Error("Cannot access contents of the page");
        }
        return [{ frameId: 0, documentId: shared.documentIds[options.target.tabId] }];
      }
    },
    tabs: {
      onUpdated: tabsUpdated,
      onRemoved: tabsRemoved,
      async get(tabId) { return visibleTab(tabId); },
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
    AbortController,
    Buffer,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    fetch: (...arguments_) => shared.fetch
      ? shared.fetch(...arguments_)
      : Promise.reject(new Error("mock bridge unavailable")),
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
  function clickAction(tabId = 7) {
    shared.authorizedTabIds.add(tabId);
    actionClicked.emit(clone(shared.tabs[tabId]));
  }
  function navigate(tabId, url, { revokeAccess = false } = {}) {
    shared.tabs[tabId].url = url;
    shared.tabs[tabId].title = "Navigated";
    shared.documentIds[tabId] = `${shared.documentIds[tabId]}-next`;
    if (revokeAccess) shared.authorizedTabIds.delete(tabId);
    tabsUpdated.emit(tabId, { status: "loading" }, clone(shared.tabs[tabId]));
  }
  return { chrome, clickAction, message, navigate, shared, tab: shared.tabs[7], tabsUpdated };
}

test("missing sensitive tab metadata fails until an action event grants access and opens the global panel", async () => {
  const harness = createHarness();
  const beforeAction = await harness.message({ type: "ENABLE_TAB", tabId: 7 });
  assert.equal(beforeAction.ok, false);
  assert.match(beforeAction.error, /toolbar action/);
  assert.equal(harness.shared.calls.some((call) => call[0] === "executeScript"), false);

  harness.clickAction(7);
  const openCall = harness.shared.calls.find((call) => call[0] === "sidePanel.open");
  assert.equal(openCall[0], "sidePanel.open");
  assert.equal(openCall[1].windowId, 2);
  assert.equal(harness.shared.calls.some((call) => call[0] === "executeScript"), false, "toolbar action must not inject");

  const enabled = await harness.message({ type: "ENABLE_TAB", tabId: 7 });
  assert.equal(enabled.ok, true);
  assert.equal(enabled.state.enabled["7"].documentId, "document-A");
});

test("an action event remains the authorization gesture when the global panel is already open", async () => {
  const harness = createHarness({ panelOpen: true, rejectOpen: true });
  harness.clickAction(7);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.shared.calls.filter((call) => call[0] === "sidePanel.open").length, 1);
  assert.equal(harness.shared.calls.some((call) => call[0] === "setPanelBehavior"), false);
  assert.equal((await harness.message({ type: "ENABLE_TAB", tabId: 7 })).ok, true);
});

test("action authorization and session storage survive service-worker replacement", async () => {
  const first = createHarness();
  first.clickAction(7);
  assert.equal(first.shared.calls.some((call) => call[0] === "executeScript"), false);

  const second = createHarness(first.shared);
  const enabled = await second.message({ type: "ENABLE_TAB", tabId: 7 });
  assert.equal(enabled.ok, true);
  assert.equal(enabled.state.enabled["7"].documentId, "document-A");
  assert.deepEqual(Array.from(first.shared.calls.find((call) => call[0] === "executeScript")[1].files), [
    "lib/constants.js", "lib/selectors.js", "content-script.js"
  ]);

  const third = createHarness(first.shared);
  const recovered = await third.message({ type: "GET_STATE" });
  assert.equal(recovered.state.enabled["7"].pageId, "page-0001");
  assert.equal(recovered.state.annotationCount, 0);
  assert.equal(recovered.state.bridge.status, "disconnected");
});

test("capture is outlined, added only after PNG persistence, editable, and deletable", async () => {
  const harness = createHarness();
  harness.clickAction(7);
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
  harness.clickAction(7);
  await harness.message({ type: "ENABLE_TAB", tabId: 7 });
  await harness.message({
    type: "TARGET_SELECTED",
    selectionId: "12345678-1234-4123-8123-123456789abc",
    target: structuredClone(valid.pages[0].annotations[0].target)
  }, { tab: harness.tab, documentId: "document-A" });
  await harness.message({ type: "ACCEPT_COMMENT", pageId: "page-0001", comment: "Persist after navigation" });
  harness.navigate(7, "https://example.com/next");
  let current = await harness.message({ type: "GET_STATE" });
  assert.equal(current.state.annotationCount, 1);
  assert.equal(Object.keys(current.state.enabled).length, 0);
  assert.equal((await harness.message({ type: "ENABLE_TAB", tabId: 7 })).ok, true, "same-origin grant remains usable");

  harness.navigate(7, "https://different.example/page", { revokeAccess: true });
  assert.equal((await harness.message({ type: "ENABLE_TAB", tabId: 7 })).ok, false, "access-revoking navigation needs a fresh action");
  harness.clickAction(7);
  assert.equal((await harness.message({ type: "ENABLE_TAB", tabId: 7 })).ok, true);
  current = await harness.message({ type: "GET_STATE" });
  assert.equal(current.state.annotationCount, 1);
});

test("each new tab requires its own toolbar authorization and explicit enable", async () => {
  const harness = createHarness();
  harness.clickAction(7);
  assert.equal((await harness.message({ type: "ENABLE_TAB", tabId: 7 })).ok, true);

  const beforeAction = await harness.message({ type: "ENABLE_TAB", tabId: 8 });
  assert.equal(beforeAction.ok, false);
  assert.match(beforeAction.error, /toolbar action/);

  harness.clickAction(8);
  assert.equal((await harness.message({ type: "ENABLE_TAB", tabId: 8 })).ok, true);
  const current = await harness.message({ type: "GET_STATE" });
  assert.deepEqual(Object.keys(current.state.enabled).sort(), ["7", "8"]);
});

test("restricted pages fail clearly without deleting pending annotations", async () => {
  const harness = createHarness();
  harness.clickAction(7);
  await harness.message({ type: "ENABLE_TAB", tabId: 7 });
  await harness.message({
    type: "TARGET_SELECTED",
    selectionId: "12345678-1234-4123-8123-123456789abc",
    target: structuredClone(valid.pages[0].annotations[0].target)
  }, { tab: harness.tab, documentId: "document-A" });
  await harness.message({ type: "ACCEPT_COMMENT", pageId: "page-0001", comment: "Retain me" });

  harness.shared.tabs[8].url = "chrome://extensions";
  harness.clickAction(8);
  const restricted = await harness.message({ type: "ENABLE_TAB", tabId: 8 });
  assert.equal(restricted.ok, false);
  assert.match(restricted.error, /Only HTTP and HTTPS/);
  assert.equal((await harness.message({ type: "GET_STATE" })).state.annotationCount, 1);
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

test("connected bridge finish transfers a validated bundle and clears only after save success", async () => {
  const requests = [];
  const token = "a".repeat(43);
  const shared = {
    fetch: async (url, options) => {
      requests.push([url, options]);
      if (url.endsWith("/handshake")) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/json; charset=utf-8" },
          async json() { return { protocol_version: 1, status: "ready", token }; }
        };
      }
      const transfer = JSON.parse(options.body);
      assert.equal(options.headers["x-pi-annotator-token"], token);
      assert.equal(transfer.protocol_version, 1);
      assert.equal(transfer.manifest.schema_version, 1);
      assert.equal(Object.keys(transfer.images).length, 1);
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        async json() {
          return { status: "saved", relative_path: `.pi-annotations/${transfer.manifest.capture.id}/annotations.json`, warning: null };
        }
      };
    }
  };
  const harness = createHarness(shared);
  harness.clickAction(7);
  await harness.message({ type: "ENABLE_TAB", tabId: 7 });
  await harness.message({
    type: "TARGET_SELECTED",
    selectionId: "12345678-1234-4123-8123-123456789abc",
    target: structuredClone(valid.pages[0].annotations[0].target)
  }, { tab: harness.tab, documentId: "document-A" });
  await harness.message({ type: "ACCEPT_COMMENT", pageId: "page-0001", comment: "Bridge save" });

  const connected = await harness.message({ type: "CHECK_BRIDGE" });
  assert.equal(connected.bridge.status, "connected");
  const saved = await harness.message({ type: "FINISH_BRIDGE" });
  assert.equal(saved.ok, true);
  assert.equal(saved.result.status, "saved");
  assert.equal(requests.length, 2);
  assert.equal((await harness.message({ type: "GET_STATE" })).state.annotationCount, 0);
});

test("bridge loss preserves pending browser state and reports capability-neutral recovery", async () => {
  const token = "b".repeat(43);
  let calls = 0;
  const harness = createHarness({
    fetch: async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          async json() { return { protocol_version: 1, status: "ready", token }; }
        };
      }
      throw new Error("bridge disappeared");
    }
  });
  harness.clickAction(7);
  await harness.message({ type: "ENABLE_TAB", tabId: 7 });
  await harness.message({
    type: "TARGET_SELECTED",
    selectionId: "12345678-1234-4123-8123-123456789abc",
    target: structuredClone(valid.pages[0].annotations[0].target)
  }, { tab: harness.tab, documentId: "document-A" });
  await harness.message({ type: "ACCEPT_COMMENT", pageId: "page-0001", comment: "Keep after loss" });
  assert.equal((await harness.message({ type: "CHECK_BRIDGE" })).bridge.status, "connected");
  const failed = await harness.message({ type: "FINISH_BRIDGE" });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /run \/annotate to reconnect or use standalone save when available/);
  const current = await harness.message({ type: "GET_STATE" });
  assert.equal(current.state.annotationCount, 1);
  assert.equal(current.state.bridge.status, "disconnected");
});

test("completion refuses to clear state changed after the saved snapshot", async () => {
  const harness = createHarness();
  harness.clickAction(7);
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
