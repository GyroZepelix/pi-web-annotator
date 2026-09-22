"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class ChromeEvent {
  constructor() { this.listeners = []; }
  addListener(listener) { this.listeners.push(listener); }
  emit(...arguments_) { return this.listeners.map((listener) => listener(...arguments_)); }
}

class FakeElement {
  constructor(tagName, document) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = document;
    this.parentNode = null;
    this.children = [];
    this.listeners = new Map();
    this.textContent = "";
    this.className = "";
    this.type = "";
    this.value = "";
    this.placeholder = "";
    this.hidden = false;
    this.disabled = false;
    this.required = false;
    this.maxLength = -1;
    this.readOnly = false;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.replaceCount = 0;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  append(...nodes) {
    for (const node of nodes) {
      if (node.parentNode) node.parentNode.children = node.parentNode.children.filter((child) => child !== node);
      node.parentNode = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes) {
    this.replaceCount += 1;
    if (this.ownerDocument.activeElement && this.contains(this.ownerDocument.activeElement) && !nodes.some((node) => node.contains(this.ownerDocument.activeElement))) {
      this.ownerDocument.activeElement = null;
    }
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...nodes);
  }

  contains(candidate) {
    return this === candidate || this.children.some((child) => child.contains(candidate));
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  async dispatch(type) {
    const event = { preventDefault() {}, target: this };
    for (const listener of this.listeners.get(type) || []) await listener(event);
  }
}

function createDocument() {
  const document = {
    activeElement: null,
    elements: new Map(),
    createElement(tagName) { return new FakeElement(tagName, document); },
    querySelector(selector) { return document.elements.get(selector) || null; }
  };
  for (const id of [
    "#bridge-status", "#page-detail", "#enable-button", "#drafts", "#annotations",
    "#annotation-count", "#cancel-button", "#finish-button", "#notice", "#error"
  ]) document.elements.set(id, document.createElement("div"));
  document.elements.get("#notice").hidden = true;
  document.elements.get("#error").hidden = true;
  return document;
}

function session(selectionId = "selection-A") {
  return {
    createdAt: "2026-09-16T20:00:00.000Z",
    revision: 1,
    pages: [{ id: "page-0001", url: "https://example.com/", title: "Example", annotations: [] }],
    enabled: { 7: { tabId: 7, documentId: "document-A", pageId: "page-0001", url: "https://example.com/" } },
    drafts: {
      "page-0001": {
        pageId: "page-0001",
        tabId: 7,
        documentId: "document-A",
        selectionId,
        target: { tag_name: "a" }
      }
    },
    annotationCount: 0,
    bridge: { status: "disconnected", detail: "Standalone save is available." }
  };
}

function pendingSession() {
  const state = session();
  state.pages[0].annotations.push({
    id: "annotation-0001",
    comment: "Retain this annotation",
    target: { tag_name: "button" }
  });
  state.annotationCount = 1;
  return state;
}

function createHarness(options = {}) {
  const document = createDocument();
  const runtimeMessage = new ChromeEvent();
  const tabsActivated = new ChromeEvent();
  const tabsUpdated = new ChromeEvent();
  const intervals = [];
  const sent = [];
  let currentState = options.state || session();
  let currentBridge = options.bridge || { status: "disconnected", detail: "No Pi bridge is connected." };
  const chrome = {
    runtime: {
      onMessage: runtimeMessage,
      async sendMessage(message) {
        sent.push(structuredClone(message));
        if (message.type === "GET_STATE") {
          const publicState = structuredClone(currentState);
          publicState.bridge = structuredClone(currentBridge);
          return { ok: true, state: publicState };
        }
        if (message.type === "CHECK_BRIDGE") {
          return { ok: true, bridge: structuredClone(currentBridge) };
        }
        if (message.type === "PAUSE_DOCUMENT") {
          currentState.enabled[message.tabId].mode = "paused";
          const draft = currentState.drafts[currentState.enabled[message.tabId].pageId];
          if (draft) delete draft.armed;
          return { ok: true };
        }
        if (message.type === "RESUME_DOCUMENT") {
          currentState.enabled[message.tabId].mode = "active";
          return { ok: true };
        }
        if (message.type === "ARM_CAPTURE") {
          const draft = currentState.drafts[message.pageId];
          draft.comment = message.comment.trim();
          draft.armed = { armId: "arm-A", selectionId: draft.selectionId };
          return { ok: true };
        }
        if (message.type === "CANCEL_ARMED_CAPTURE") {
          delete currentState.drafts[message.pageId].armed;
          return { ok: true };
        }
        if (message.type === "EDIT_COMMENT") {
          for (const page of currentState.pages) {
            const annotation = page.annotations.find((candidate) => candidate.id === message.annotationId);
            if (annotation) annotation.comment = message.comment.trim();
          }
          return { ok: true };
        }
        if (message.type === "HIGHLIGHT_ANNOTATION") return { ok: true };
        throw new Error(`Unexpected message: ${message.type}`);
      }
    },
    tabs: {
      onActivated: tabsActivated,
      onUpdated: tabsUpdated,
      async query() { return [{ id: 7, windowId: 2, active: true, url: "https://example.com/", title: "Example" }]; }
    }
  };
  const window = {
    confirm: () => true,
    setInterval(callback) { intervals.push(callback); return intervals.length; }
  };
  if (options.pickerAvailable) {
    window.showDirectoryPicker = options.showDirectoryPicker || (() => Promise.reject(new Error("picker not exercised")));
  }
  const context = vm.createContext({
    chrome,
    console,
    document,
    window,
    PiAnnotatorConstants: { LIMITS: { commentCharacters: 4000 } },
    PiAnnotatorFilesystem: {}
  });
  const source = fs.readFileSync(path.join(__dirname, "..", "..", "browser-extension", "sidepanel.js"), "utf8");
  vm.runInContext(source, context, { filename: "sidepanel.js" });

  return {
    document,
    intervals,
    runtimeMessage,
    sent,
    getState() { return structuredClone(currentState); },
    setBridge(next) { currentBridge = next; },
    setState(next) { currentState = next; }
  };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

test("author styles preserve the hidden attribute for inactive editor controls", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "browser-extension", "sidepanel.css"), "utf8");
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test("comment typing survives bridge polling and unrelated state refreshes but resets for a replaced target", async () => {
  const harness = createHarness();
  await flush();

  const drafts = harness.document.querySelector("#drafts");
  const firstCard = drafts.children[0];
  const firstTextarea = firstCard.children[1];
  firstTextarea.value = "Keep this in-progress comment";
  firstTextarea.focus();
  const replacementsBeforePolling = drafts.replaceCount;

  await harness.intervals[0]();
  await harness.intervals[0]();
  assert.equal(drafts.children[0].children[1], firstTextarea);
  assert.equal(firstTextarea.value, "Keep this in-progress comment");
  assert.equal(harness.document.activeElement, firstTextarea);
  assert.equal(drafts.replaceCount, replacementsBeforePolling, "bridge status polling must not rebuild unchanged draft controls");

  harness.setState(session("selection-A"));
  harness.runtimeMessage.emit({ type: "STATE_CHANGED" });
  await flush();
  assert.equal(drafts.children[0].children[1], firstTextarea);
  assert.equal(firstTextarea.value, "Keep this in-progress comment");
  assert.equal(harness.document.activeElement, firstTextarea);

  harness.setState(session("selection-B"));
  harness.runtimeMessage.emit({ type: "STATE_CHANGED" });
  await flush();
  const replacementTextarea = drafts.children[0].children[1];
  assert.notEqual(replacementTextarea, firstTextarea);
  assert.equal(replacementTextarea.value, "", "a genuinely replaced target starts with an empty comment");

  const withoutDraft = session("selection-B");
  withoutDraft.drafts = {};
  harness.setState(withoutDraft);
  harness.runtimeMessage.emit({ type: "STATE_CHANGED" });
  await flush();
  assert.equal(drafts.children.length, 1);
  assert.equal(drafts.children[0].textContent, "Select an element on an enabled page.");
});

test("disconnected capability state enables standalone Finish only when the directory picker is callable", async () => {
  const unavailable = createHarness({ state: pendingSession() });
  await flush();
  assert.equal(unavailable.document.querySelector("#finish-button").disabled, true);
  assert.match(unavailable.document.querySelector("#bridge-status").textContent, /run \/annotate/);
  assert.match(unavailable.document.querySelector("#bridge-status").textContent, /Pending work is retained/);
  assert.equal(unavailable.document.querySelector("#error").hidden, true, "missing capability is guidance, not a failed save");

  const standalone = createHarness({ state: pendingSession(), pickerAvailable: true });
  await flush();
  assert.equal(standalone.document.querySelector("#finish-button").disabled, false);
  assert.match(standalone.document.querySelector("#bridge-status").textContent, /standalone save available/);
});

test("bridge loss and authenticated reconnection recompute Finish without mutating annotations or active drafts", async () => {
  const initial = pendingSession();
  const harness = createHarness({
    state: initial,
    bridge: { status: "connected", detail: "Pi is waiting." }
  });
  await flush();

  const finish = harness.document.querySelector("#finish-button");
  const status = harness.document.querySelector("#bridge-status");
  const textarea = harness.document.querySelector("#drafts").children[0].children[1];
  textarea.value = "Draft survives capability changes";
  textarea.focus();
  assert.equal(finish.disabled, false);
  assert.match(status.textContent, /connected/);

  harness.setBridge({ status: "disconnected", detail: "Bridge lost." });
  await harness.intervals[0]();
  assert.equal(finish.disabled, true);
  assert.match(status.textContent, /run \/annotate/);
  assert.equal(harness.document.querySelector("#drafts").children[0].children[1], textarea);
  assert.equal(textarea.value, "Draft survives capability changes");
  assert.equal(harness.document.activeElement, textarea);
  assert.deepEqual(harness.getState(), initial);

  harness.setBridge({ status: "connected", detail: "Authenticated again." });
  await harness.intervals[0]();
  assert.equal(finish.disabled, false);
  assert.match(status.textContent, /project-aware save/);
  assert.equal(harness.document.querySelector("#drafts").children[0].children[1], textarea);
  assert.equal(textarea.value, "Draft survives capability changes");
  assert.equal(harness.document.activeElement, textarea);
  assert.deepEqual(harness.getState(), initial);
});

test("Pause and Resume preserve the same draft control and armed capture can be cancelled", async () => {
  const harness = createHarness();
  await flush();
  const control = harness.document.querySelector("#enable-button");
  const drafts = harness.document.querySelector("#drafts");
  const card = drafts.children[0];
  const textarea = card.children[1];
  textarea.value = "Unsaved local wording";
  textarea.focus();

  assert.equal(control.textContent, "Pause annotation");
  await control.dispatch("click");
  await flush();
  assert.equal(harness.getState().enabled[7].mode, "paused");
  assert.equal(control.textContent, "Resume annotation");
  assert.equal(drafts.children[0].children[1], textarea);
  assert.equal(textarea.value, "Unsaved local wording");
  assert.equal(harness.document.activeElement, textarea);

  await control.dispatch("click");
  await flush();
  assert.equal(harness.getState().enabled[7].mode, "active");
  assert.equal(control.textContent, "Pause annotation");
  await card.dispatch("submit");
  await flush();
  assert.equal(harness.getState().drafts["page-0001"].comment, "Unsaved local wording");
  assert.ok(harness.getState().drafts["page-0001"].armed);
  assert.equal(textarea.readOnly, true);
  assert.match(card.children[3].children[0].textContent, /Armed/);

  await card.children[3].children[1].dispatch("click");
  await flush();
  assert.equal(harness.getState().drafts["page-0001"].armed, undefined);
  assert.equal(textarea.value, "Unsaved local wording");
  assert.equal(textarea.readOnly, false);
});

test("accepted editor identity, text, focus, and caret survive polls and unrelated refreshes", async () => {
  const harness = createHarness({ state: pendingSession() });
  await flush();
  const annotations = harness.document.querySelector("#annotations");
  const card = annotations.children[0];
  const displayActions = card.children[2];
  const editor = card.children[3];

  await displayActions.children[1].dispatch("click");
  editor.value = "Unsaved accepted-comment edit";
  editor.selectionStart = 7;
  editor.selectionEnd = 19;
  editor.focus();
  const replacementsBefore = annotations.replaceCount;

  await harness.intervals[0]();
  await harness.intervals[0]();
  harness.runtimeMessage.emit({ type: "STATE_CHANGED" });
  await flush();
  assert.equal(annotations.children[0], card);
  assert.equal(card.children[3], editor);
  assert.equal(editor.value, "Unsaved accepted-comment edit");
  assert.equal(editor.selectionStart, 7);
  assert.equal(editor.selectionEnd, 19);
  assert.equal(harness.document.activeElement, editor);
  assert.equal(annotations.replaceCount, replacementsBefore);

  await card.children[4].children[1].dispatch("click");
  assert.equal(editor.value, "Retain this annotation");
  assert.equal(editor.hidden, true);

  await displayActions.children[1].dispatch("click");
  editor.value = "Saved accepted-comment edit";
  await card.children[4].children[0].dispatch("click");
  await flush();
  assert.equal(harness.getState().pages[0].annotations[0].comment, "Saved accepted-comment edit");
  assert.equal(editor.hidden, true);
  assert.equal(card.children[1].textContent, "Saved accepted-comment edit");
  assert.equal(harness.sent.filter((message) => message.type === "EDIT_COMMENT").length, 1);

  await displayActions.children[0].dispatch("click");
  await flush();
  assert.equal(harness.sent.filter((message) => message.type === "HIGHLIGHT_ANNOTATION").length, 1);
});
