(() => {
  "use strict";

  if (globalThis.__piWebAnnotatorContentScript) {
    globalThis.__piWebAnnotatorContentScript.resume();
    return;
  }

  const selectors = globalThis.PiAnnotatorSelectors;
  const HOVER_SETTLE_MS = 750;
  const HIGHLIGHT_MS = 2000;
  const MESSAGE_FIELDS = Object.freeze({
    ARM_CAPTURE: ["armId", "selectionId"],
    CANCEL_ARMED_CAPTURE: ["armId", "selectionId"],
    CLEAR_CAPTURE: [],
    COMPLETE_CAPTURE: ["annotationId", "selectionId"],
    HIGHLIGHT_TARGET: ["annotationId"],
    UNBIND_ANNOTATION: ["annotationId"],
    PAUSE_ANNOTATION: [],
    RESUME_ANNOTATION: [],
    DISABLE_ANNOTATION: []
  });
  const OUTLINES = Object.freeze({
    candidate: { rank: 1, color: "#2f6fed", width: 2 },
    highlight: { rank: 2, color: "#ff2d55", width: 5 },
    capture: { rank: 3, color: "#e5484d", width: 4 }
  });

  let mode = "active";
  let listening = false;
  let hovered = null;
  let selected = null;
  let selectionId = null;
  let armed = null;
  const annotationTargets = new Map();
  const decorationState = new WeakMap();
  const decoratedElements = new Set();
  const captureOverlays = new Map();
  const highlightTimers = new Map();

  function originalStyle(element) {
    let state = decorationState.get(element);
    if (!state) {
      state = {
        outline: element.style.getPropertyValue("outline"),
        outlinePriority: element.style.getPropertyPriority("outline"),
        offset: element.style.getPropertyValue("outline-offset"),
        offsetPriority: element.style.getPropertyPriority("outline-offset"),
        owners: new Set()
      };
      decorationState.set(element, state);
      decoratedElements.add(element);
    }
    return state;
  }

  function applyOriginalStyle(element, state) {
    if (state.outline) element.style.setProperty("outline", state.outline, state.outlinePriority);
    else element.style.removeProperty("outline");
    if (state.offset) element.style.setProperty("outline-offset", state.offset, state.offsetPriority);
    else element.style.removeProperty("outline-offset");
  }

  function clippedViewportRect(element) {
    if (!element || typeof element.getBoundingClientRect !== "function" || !Number.isFinite(window.innerWidth) || !Number.isFinite(window.innerHeight)) return null;
    const source = element.getBoundingClientRect();
    let left = Math.max(0, source.left);
    let top = Math.max(0, source.top);
    let right = Math.min(window.innerWidth, source.right);
    let bottom = Math.min(window.innerHeight, source.bottom);
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = window.getComputedStyle(ancestor);
      const rect = ancestor.getBoundingClientRect();
      if (style.overflowX !== "visible") {
        left = Math.max(left, rect.left);
        right = Math.min(right, rect.right);
      }
      if (style.overflowY !== "visible") {
        top = Math.max(top, rect.top);
        bottom = Math.min(bottom, rect.bottom);
      }
    }
    if (right <= left || bottom <= top) return null;
    return { left, top, width: right - left, height: bottom - top };
  }

  function addCaptureOverlay(element) {
    const rect = clippedViewportRect(element);
    if (!rect || !document.documentElement || typeof document.createElement !== "function") return false;
    removeCaptureOverlay(element);
    const overlay = document.createElement("div");
    overlay.setAttribute("data-pi-web-annotator-control", "capture-outline");
    overlay.style.setProperty("position", "fixed", "important");
    overlay.style.setProperty("pointer-events", "none", "important");
    overlay.style.setProperty("box-sizing", "border-box", "important");
    overlay.style.setProperty("left", `${rect.left}px`, "important");
    overlay.style.setProperty("top", `${rect.top}px`, "important");
    overlay.style.setProperty("width", `${rect.width}px`, "important");
    overlay.style.setProperty("height", `${rect.height}px`, "important");
    overlay.style.setProperty("border", `${OUTLINES.capture.width}px solid ${OUTLINES.capture.color}`, "important");
    overlay.style.setProperty("z-index", "2147483647", "important");
    document.documentElement.append(overlay);
    captureOverlays.set(element, overlay);
    return true;
  }

  function removeCaptureOverlay(element) {
    const overlay = element && captureOverlays.get(element);
    if (!overlay) return;
    overlay.remove();
    captureOverlays.delete(element);
  }

  function renderDecoration(element) {
    const state = decorationState.get(element);
    if (!state) return;
    const owner = [...state.owners].sort((left, right) => OUTLINES[right].rank - OUTLINES[left].rank)[0];
    if (owner) {
      if (owner === "capture" && captureOverlays.has(element)) {
        applyOriginalStyle(element, state);
        return;
      }
      const outline = OUTLINES[owner];
      element.style.setProperty("outline", `${outline.width}px solid ${outline.color}`, "important");
      element.style.setProperty("outline-offset", "2px", "important");
      return;
    }
    applyOriginalStyle(element, state);
    decorationState.delete(element);
    decoratedElements.delete(element);
  }

  function addDecoration(element, owner) {
    if (!element) return;
    originalStyle(element).owners.add(owner);
    if (owner === "capture") addCaptureOverlay(element);
    renderDecoration(element);
  }

  function removeDecoration(element, owner) {
    const state = element && decorationState.get(element);
    if (!state) return;
    if (owner === "capture") removeCaptureOverlay(element);
    state.owners.delete(owner);
    renderDecoration(element);
  }

  function removeAllDecorations() {
    for (const element of [...captureOverlays.keys()]) removeCaptureOverlay(element);
    for (const element of [...decoratedElements]) {
      const state = decorationState.get(element);
      if (state) state.owners.clear();
      renderDecoration(element);
    }
  }

  function containsSelected(candidate) {
    return Boolean(selected && candidate && (candidate === selected || selected.contains(candidate)));
  }

  function onMove(event) {
    if (mode !== "active" || armed) return;
    const candidate = event.target;
    if (candidate === hovered || !selectors.isSelectable(candidate)) return;
    removeDecoration(hovered, "candidate");
    hovered = candidate;
    addDecoration(hovered, "candidate");
  }

  function onLeave() {
    removeDecoration(hovered, "candidate");
    hovered = null;
  }

  function onClick(event) {
    if (mode !== "active" || armed || !selectors.isSelectable(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selected = event.target;
    selectionId = crypto.randomUUID();
    removeDecoration(hovered, "candidate");
    hovered = null;
    let target;
    try {
      target = selectors.captureTarget(selected, window);
    } catch (error) {
      chrome.runtime.sendMessage({ type: "TARGET_SELECTION_FAILED", error: error.message }).catch(() => {});
      return;
    }
    chrome.runtime.sendMessage({ type: "TARGET_SELECTED", selectionId, target }).catch(() => {});
  }

  function addSelectionListeners() {
    if (listening) return;
    listening = true;
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseleave", onLeave, true);
    document.addEventListener("click", onClick, true);
  }

  function removeSelectionListeners() {
    if (!listening) return;
    listening = false;
    removeDecoration(hovered, "candidate");
    hovered = null;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("mouseleave", onLeave, true);
    document.removeEventListener("click", onClick, true);
  }

  function clearArmTimer() {
    if (armed && armed.timer !== null) clearTimeout(armed.timer);
    if (armed) armed.timer = null;
  }

  function removeArmListeners() {
    document.removeEventListener("mouseover", onArmedOver, true);
    document.removeEventListener("mouseout", onArmedOut, true);
  }

  function clearArmed({ clearCapture = true } = {}) {
    clearArmTimer();
    removeArmListeners();
    if (armed && armed.observer) armed.observer.disconnect();
    if (clearCapture) removeDecoration(selected, "capture");
    armed = null;
    if (mode === "active") addSelectionListeners();
  }

  function reportCaptureFailure(error) {
    if (!armed || armed.fired) return;
    armed.fired = true;
    const message = {
      type: "CAPTURE_FAILED",
      armId: armed.armId,
      selectionId: armed.selectionId,
      error
    };
    clearArmed();
    chrome.runtime.sendMessage(message).catch(() => {});
  }

  function captureReady() {
    if (!armed || armed.fired || !armed.inside) return;
    if (!selected || !selected.isConnected) {
      reportCaptureFailure("The selected element is no longer available. Select it again.");
      return;
    }
    armed.fired = true;
    clearArmTimer();
    removeArmListeners();
    addDecoration(selected, "capture");
    const identity = { armId: armed.armId, selectionId: armed.selectionId };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      chrome.runtime.sendMessage({ type: "CAPTURE_READY", ...identity })
        .then((response) => {
          if (!response || !response.ok) clearArmed();
        })
        .catch(() => clearArmed());
    }));
  }

  function onArmedOver(event) {
    if (!armed || armed.fired || armed.inside || !containsSelected(event.target)) return;
    armed.inside = true;
    clearArmTimer();
    armed.timer = setTimeout(captureReady, HOVER_SETTLE_MS);
  }

  function onArmedOut(event) {
    if (!armed || armed.fired || !containsSelected(event.target)) return;
    if (containsSelected(event.relatedTarget)) return;
    armed.inside = false;
    clearArmTimer();
  }

  function validIdentity(value, pattern) {
    return typeof value === "string" && pattern.test(value);
  }

  function validMessageShape(message) {
    const fields = MESSAGE_FIELDS[message.type];
    if (!fields) return true;
    const actual = Object.keys(message).sort();
    const expected = ["type", ...fields].sort();
    return actual.length === expected.length && actual.every((field, index) => field === expected[index]);
  }

  function armCapture(message) {
    if (!validIdentity(message.armId, /^[0-9a-f-]{20,}$/i) || !validIdentity(message.selectionId, /^[0-9a-f-]{20,}$/i)) {
      return { ok: false, error: "The armed capture identity is invalid." };
    }
    if (mode !== "active") return { ok: false, error: "Resume annotation before arming capture." };
    if (!selected || !selected.isConnected || message.selectionId !== selectionId) {
      return { ok: false, error: "The selected element is no longer available. Select it again." };
    }
    clearArmed();
    removeSelectionListeners();
    armed = { armId: message.armId, selectionId, inside: false, fired: false, timer: null, observer: null };
    armed.observer = new MutationObserver(() => {
      if (armed && selected && !selected.isConnected) {
        reportCaptureFailure("The selected element is no longer available. Select it again.");
      }
    });
    armed.observer.observe(document, { childList: true, subtree: true });
    document.addEventListener("mouseover", onArmedOver, true);
    document.addEventListener("mouseout", onArmedOut, true);
    return { ok: true };
  }

  function pause() {
    mode = "paused";
    clearArmed();
    removeSelectionListeners();
    return { ok: true };
  }

  function resume() {
    mode = "active";
    if (!armed) addSelectionListeners();
    return { ok: true };
  }

  function disable() {
    mode = "disabled";
    clearArmed();
    removeSelectionListeners();
    for (const timer of highlightTimers.values()) clearTimeout(timer);
    highlightTimers.clear();
    removeAllDecorations();
    hovered = null;
    selected = null;
    selectionId = null;
    annotationTargets.clear();
  }

  function bindAnnotation(message) {
    if (!validIdentity(message.annotationId, /^annotation-[0-9]{4,}$/) || !validIdentity(message.selectionId, /^[0-9a-f-]{20,}$/i)) {
      return { ok: false, error: "The annotation identity is invalid." };
    }
    if (!selected || !selected.isConnected || message.selectionId !== selectionId) {
      return { ok: false, error: "The exact live target is no longer available for Highlight." };
    }
    annotationTargets.set(message.annotationId, selected);
    clearArmed();
    return { ok: true };
  }

  function highlightAnnotation(annotationId) {
    if (!validIdentity(annotationId, /^annotation-[0-9]{4,}$/)) return { ok: false, error: "The annotation identity is invalid." };
    const target = annotationTargets.get(annotationId);
    if (!target || !target.isConnected) {
      annotationTargets.delete(annotationId);
      return { ok: false, error: "Highlight is unavailable because the exact live target is gone." };
    }
    const existing = highlightTimers.get(annotationId);
    if (existing) clearTimeout(existing);
    target.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });
    addDecoration(target, "highlight");
    highlightTimers.set(annotationId, setTimeout(() => {
      removeDecoration(target, "highlight");
      highlightTimers.delete(annotationId);
    }, HIGHLIGHT_MS));
    return { ok: true };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return false;
    if (!validMessageShape(message)) {
      sendResponse({ ok: false, error: "Message has unsupported or missing fields." });
      return false;
    }
    if (message.type === "ARM_CAPTURE") {
      sendResponse(armCapture(message));
      return false;
    }
    if (message.type === "CANCEL_ARMED_CAPTURE") {
      if (armed && (message.armId !== armed.armId || message.selectionId !== armed.selectionId)) {
        sendResponse({ ok: false, error: "The armed capture identity is stale." });
      } else {
        clearArmed();
        sendResponse({ ok: true });
      }
      return false;
    }
    if (message.type === "CLEAR_CAPTURE") {
      clearArmed();
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === "COMPLETE_CAPTURE") {
      sendResponse(bindAnnotation(message));
      return false;
    }
    if (message.type === "HIGHLIGHT_TARGET") {
      sendResponse(highlightAnnotation(message.annotationId));
      return false;
    }
    if (message.type === "UNBIND_ANNOTATION") {
      const target = annotationTargets.get(message.annotationId);
      const timer = highlightTimers.get(message.annotationId);
      if (timer) clearTimeout(timer);
      highlightTimers.delete(message.annotationId);
      removeDecoration(target, "highlight");
      annotationTargets.delete(message.annotationId);
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === "PAUSE_ANNOTATION") {
      sendResponse(pause());
      return false;
    }
    if (message.type === "RESUME_ANNOTATION") {
      sendResponse(resume());
      return false;
    }
    if (message.type === "DISABLE_ANNOTATION") {
      disable();
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });

  globalThis.__piWebAnnotatorContentScript = { disable, pause, resume };
  resume();
})();
