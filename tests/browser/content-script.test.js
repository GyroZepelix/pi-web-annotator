"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

class ChromeEvent {
  constructor() { this.listeners = []; }
  addListener(listener) { this.listeners.push(listener); }
}

class FakeStyle {
  constructor() { this.values = new Map(); }
  getPropertyValue(name) { return this.values.get(name)?.value || ""; }
  getPropertyPriority(name) { return this.values.get(name)?.priority || ""; }
  setProperty(name, value, priority = "") { this.values.set(name, { value, priority }); }
  removeProperty(name) { this.values.delete(name); }
}

class FakeElement {
  constructor(name) {
    this.name = name;
    this.style = new FakeStyle();
    this.children = [];
    this.parentElement = null;
    this.isConnected = true;
    this.scrollCalls = [];
    this.attributes = new Map();
    this.rect = { left: 10, top: 20, right: 110, bottom: 70, width: 100, height: 50 };
    this.overflowX = "visible";
    this.overflowY = "visible";
  }
  append(child) { child.parentElement = this; this.children.push(child); }
  contains(candidate) { return this === candidate || this.children.some((child) => child.contains(candidate)); }
  getBoundingClientRect() { return this.rect; }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
    this.isConnected = false;
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  scrollIntoView(options) { this.scrollCalls.push(options); }
}

function createHarness() {
  const runtimeMessage = new ChromeEvent();
  const sent = [];
  const documentListeners = new Map();
  const timers = new Map();
  const observers = [];
  let nextTimer = 1;
  let now = 0;
  const documentElement = new FakeElement("html");
  const document = {
    documentElement,
    createElement(name) { return new FakeElement(name); },
    addEventListener(type, listener) {
      const listeners = documentListeners.get(type) || [];
      listeners.push(listener);
      documentListeners.set(type, listeners);
    },
    removeEventListener(type, listener) {
      documentListeners.set(type, (documentListeners.get(type) || []).filter((candidate) => candidate !== listener));
    }
  };
  const chrome = {
    runtime: {
      onMessage: runtimeMessage,
      async sendMessage(message) { sent.push(message); return { ok: true }; }
    }
  };
  function setTimeoutFake(callback, delay) {
    const id = nextTimer++;
    timers.set(id, { at: now + delay, callback });
    return id;
  }
  function clearTimeoutFake(id) { timers.delete(id); }
  function advance(milliseconds) {
    const end = now + milliseconds;
    while (true) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].callback();
    }
    now = end;
  }
  function emit(type, target, relatedTarget = null) {
    const event = {
      target,
      relatedTarget,
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.propagationStopped = true; }
    };
    for (const listener of [...(documentListeners.get(type) || [])]) listener(event);
    return event;
  }
  async function message(payload) {
    const listener = runtimeMessage.listeners[0];
    return new Promise((resolve) => {
      const async = listener(payload, {}, resolve);
      if (!async && payload.type === "UNKNOWN") resolve(undefined);
    });
  }
  const selectors = {
    isSelectable(element) { return element instanceof FakeElement; },
    captureTarget(element) { return { tag_name: element.name, css_selector: { value: element.name, truncated: false } }; }
  };
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; this.active = false; observers.push(this); }
    observe() { this.active = true; }
    disconnect() { this.active = false; }
  }
  function mutate() {
    for (const observer of observers) if (observer.active) observer.callback([]);
  }
  const context = vm.createContext({
    chrome,
    console,
    crypto: webcrypto,
    document,
    window: {
      innerWidth: 800,
      innerHeight: 600,
      getComputedStyle(element) { return { overflowX: element.overflowX, overflowY: element.overflowY }; }
    },
    PiAnnotatorSelectors: selectors,
    MutationObserver: FakeMutationObserver,
    requestAnimationFrame(callback) { callback(); },
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimeoutFake
  });
  const source = fs.readFileSync(path.join(__dirname, "..", "..", "browser-extension", "content-script.js"), "utf8");
  vm.runInContext(source, context, { filename: "content-script.js" });
  return { advance, documentElement, emit, message, mutate, sent };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("pause and resume retain the exact selection while suspending candidate clicks", async () => {
  const harness = createHarness();
  const target = new FakeElement("button");
  target.style.setProperty("outline", "1px dotted green", "");
  target.style.setProperty("outline-offset", "7px", "");
  harness.emit("mousemove", target);
  assert.equal(target.style.getPropertyValue("outline"), "2px solid #2f6fed");
  const selected = harness.emit("click", target);
  assert.equal(selected.defaultPrevented, true);
  const selection = harness.sent.find((message) => message.type === "TARGET_SELECTED");
  assert.ok(selection.selectionId);

  assert.equal((await harness.message({ type: "PAUSE_ANNOTATION" })).ok, true);
  assert.equal(target.style.getPropertyValue("outline"), "1px dotted green");
  const ignored = harness.emit("click", target);
  assert.equal(ignored.defaultPrevented, false);

  assert.equal((await harness.message({ type: "RESUME_ANNOTATION" })).ok, true);
  const armed = await harness.message({ type: "ARM_CAPTURE", armId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", selectionId: selection.selectionId });
  assert.equal(armed.ok, true, armed.error);
});

test("armed hover is continuous, one-shot, identity-bound, and restores exact styles", async () => {
  const harness = createHarness();
  const clipper = new FakeElement("div");
  clipper.rect = { left: 0, top: 0, right: 90, bottom: 60, width: 90, height: 60 };
  clipper.overflowX = "auto";
  clipper.overflowY = "hidden";
  const target = new FakeElement("article");
  const child = new FakeElement("span");
  clipper.append(target);
  target.append(child);
  target.style.setProperty("outline", "3px dashed orange", "important");
  target.style.setProperty("outline-offset", "9px", "");
  harness.emit("click", target);
  const selection = harness.sent.find((message) => message.type === "TARGET_SELECTED");
  assert.equal((await harness.message({ type: "ARM_CAPTURE", armId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", selectionId: selection.selectionId })).ok, true);

  harness.emit("mouseover", child);
  harness.advance(500);
  harness.emit("mouseout", child, null);
  harness.advance(500);
  assert.equal(harness.sent.filter((message) => message.type === "CAPTURE_READY").length, 0);

  harness.emit("mouseover", child);
  harness.advance(400);
  harness.emit("mouseout", child, target);
  harness.emit("mouseover", target);
  harness.advance(349);
  assert.equal(harness.sent.filter((message) => message.type === "CAPTURE_READY").length, 0);
  harness.advance(1);
  await flush();
  assert.deepEqual(
    harness.sent.filter((message) => message.type === "CAPTURE_READY").map(({ type, armId, selectionId }) => ({ type, armId, selectionId })),
    [{ type: "CAPTURE_READY", armId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", selectionId: selection.selectionId }]
  );
  assert.equal(target.style.getPropertyValue("outline"), "3px dashed orange", "the page element keeps its original inline style");
  assert.equal(harness.documentElement.children.length, 1);
  const captureOverlay = harness.documentElement.children[0];
  assert.equal(captureOverlay.attributes.get("data-pi-web-annotator-control"), "capture-outline");
  assert.equal(captureOverlay.style.getPropertyValue("border"), "4px solid #e5484d");
  assert.equal(captureOverlay.style.getPropertyValue("left"), "10px");
  assert.equal(captureOverlay.style.getPropertyValue("top"), "20px");
  assert.equal(captureOverlay.style.getPropertyValue("width"), "80px", "overlay is clipped to the visible overflow region");
  assert.equal(captureOverlay.style.getPropertyValue("height"), "40px");
  assert.equal(captureOverlay.style.getPropertyValue("z-index"), "2147483647");

  harness.emit("mouseover", target);
  harness.advance(1000);
  assert.equal(harness.sent.filter((message) => message.type === "CAPTURE_READY").length, 1);
  assert.equal((await harness.message({ type: "COMPLETE_CAPTURE", selectionId: selection.selectionId, annotationId: "annotation-0001" })).ok, true);
  assert.equal(harness.documentElement.children.length, 0, "capture overlay is removed after completion");
  assert.equal(target.style.getPropertyValue("outline"), "3px dashed orange");
  assert.equal(target.style.getPropertyPriority("outline"), "important");
  assert.equal(target.style.getPropertyValue("outline-offset"), "9px");
});

test("target detachment cancels an armed capture once and resumes selection listeners", async () => {
  const harness = createHarness();
  const target = new FakeElement("button");
  harness.emit("click", target);
  const selection = harness.sent.find((message) => message.type === "TARGET_SELECTED");
  assert.equal((await harness.message({
    type: "ARM_CAPTURE",
    armId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    selectionId: selection.selectionId
  })).ok, true);
  target.isConnected = false;
  harness.mutate();
  await flush();
  assert.deepEqual(
    harness.sent.filter((message) => message.type === "CAPTURE_FAILED").map(({ type, armId, selectionId, error }) => ({ type, armId, selectionId, error })),
    [{
      type: "CAPTURE_FAILED",
      armId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      selectionId: selection.selectionId,
      error: "The selected element is no longer available. Select it again."
    }]
  );
  harness.mutate();
  assert.equal(harness.sent.filter((message) => message.type === "CAPTURE_FAILED").length, 1);
});

test("multiple accepted targets stay independently mapped and capture outline takes precedence", async () => {
  const harness = createHarness();
  const first = new FakeElement("button");
  const second = new FakeElement("aside");
  second.style.setProperty("outline", "2px dotted teal", "");

  harness.emit("click", first);
  const firstSelection = harness.sent.filter((message) => message.type === "TARGET_SELECTED")[0];
  assert.equal((await harness.message({ type: "COMPLETE_CAPTURE", selectionId: firstSelection.selectionId, annotationId: "annotation-0001" })).ok, true);
  harness.emit("click", second);
  const secondSelection = harness.sent.filter((message) => message.type === "TARGET_SELECTED")[1];
  assert.equal((await harness.message({ type: "COMPLETE_CAPTURE", selectionId: secondSelection.selectionId, annotationId: "annotation-0002" })).ok, true);

  assert.equal((await harness.message({ type: "HIGHLIGHT_TARGET", annotationId: "annotation-0001" })).ok, true);
  assert.equal((await harness.message({ type: "HIGHLIGHT_TARGET", annotationId: "annotation-0002" })).ok, true);
  assert.equal(first.scrollCalls.length, 1);
  assert.equal(second.scrollCalls.length, 1);
  assert.equal(second.style.getPropertyValue("outline"), "5px solid #ff2d55");

  assert.equal((await harness.message({
    type: "ARM_CAPTURE",
    armId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    selectionId: secondSelection.selectionId
  })).ok, true);
  harness.emit("mouseover", second);
  harness.advance(750);
  await flush();
  assert.equal(second.style.getPropertyValue("outline"), "2px dotted teal", "capture temporarily suppresses the inline Highlight style");
  assert.equal(harness.documentElement.children[0].style.getPropertyValue("border"), "4px solid #e5484d", "top-level capture overlay owns the visible outline");
  assert.equal((await harness.message({ type: "CLEAR_CAPTURE" })).ok, true);
  assert.equal(harness.documentElement.children.length, 0);
  assert.equal(second.style.getPropertyValue("outline"), "5px solid #ff2d55", "Highlight resumes until its own timeout");
  harness.advance(1250);
  assert.equal(second.style.getPropertyValue("outline"), "2px dotted teal");
});

test("exact-target Highlight works while paused, centers once, and restores after two seconds", async () => {
  const harness = createHarness();
  const target = new FakeElement("section");
  target.style.setProperty("outline", "1px solid purple", "");
  harness.emit("click", target);
  const selection = harness.sent.find((message) => message.type === "TARGET_SELECTED");
  assert.equal((await harness.message({ type: "COMPLETE_CAPTURE", selectionId: selection.selectionId, annotationId: "annotation-0001" })).ok, true);
  assert.equal((await harness.message({ type: "PAUSE_ANNOTATION" })).ok, true);

  const highlighted = await harness.message({ type: "HIGHLIGHT_TARGET", annotationId: "annotation-0001" });
  assert.equal(highlighted.ok, true);
  assert.equal(target.scrollCalls.length, 1);
  assert.deepEqual({ ...target.scrollCalls[0] }, { behavior: "auto", block: "center", inline: "center" });
  assert.equal(target.style.getPropertyValue("outline"), "5px solid #ff2d55");
  harness.advance(1999);
  assert.equal(target.style.getPropertyValue("outline"), "5px solid #ff2d55");
  harness.advance(1);
  assert.equal(target.style.getPropertyValue("outline"), "1px solid purple");

  target.isConnected = false;
  const detached = await harness.message({ type: "HIGHLIGHT_TARGET", annotationId: "annotation-0001" });
  assert.equal(detached.ok, false);
  assert.match(detached.error, /exact live target is gone/);
});
