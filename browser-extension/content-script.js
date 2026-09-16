(() => {
  "use strict";

  if (globalThis.__piWebAnnotatorContentScript) {
    globalThis.__piWebAnnotatorContentScript.enable();
    return;
  }

  const selectors = globalThis.PiAnnotatorSelectors;
  let enabled = false;
  let hovered = null;
  let selected = null;
  let selectionId = null;
  const originalStyles = new WeakMap();

  function rememberAndOutline(element, color, width) {
    if (!originalStyles.has(element)) {
      originalStyles.set(element, {
        outline: element.style.getPropertyValue("outline"),
        outlinePriority: element.style.getPropertyPriority("outline"),
        offset: element.style.getPropertyValue("outline-offset"),
        offsetPriority: element.style.getPropertyPriority("outline-offset")
      });
    }
    element.style.setProperty("outline", `${width}px solid ${color}`, "important");
    element.style.setProperty("outline-offset", "2px", "important");
  }

  function restore(element) {
    if (!element || !originalStyles.has(element)) return;
    const prior = originalStyles.get(element);
    if (prior.outline) element.style.setProperty("outline", prior.outline, prior.outlinePriority);
    else element.style.removeProperty("outline");
    if (prior.offset) element.style.setProperty("outline-offset", prior.offset, prior.offsetPriority);
    else element.style.removeProperty("outline-offset");
    originalStyles.delete(element);
  }

  function onMove(event) {
    if (!enabled) return;
    const candidate = event.target;
    if (candidate === hovered || !selectors.isSelectable(candidate)) return;
    restore(hovered);
    hovered = candidate;
    rememberAndOutline(hovered, "#2f6fed", 2);
  }

  function onLeave() {
    restore(hovered);
    hovered = null;
  }

  function onClick(event) {
    if (!enabled || !selectors.isSelectable(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selected = event.target;
    selectionId = crypto.randomUUID();
    restore(hovered);
    hovered = null;
    let target;
    try {
      target = selectors.captureTarget(selected, window);
    } catch (error) {
      chrome.runtime.sendMessage({ type: "TARGET_SELECTION_FAILED", error: error.message });
      return;
    }
    chrome.runtime.sendMessage({ type: "TARGET_SELECTED", selectionId, target }).catch(() => {});
  }

  function enable() {
    if (enabled) return;
    enabled = true;
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseleave", onLeave, true);
    document.addEventListener("click", onClick, true);
  }

  function disable() {
    enabled = false;
    restore(hovered);
    restore(selected);
    hovered = null;
    selected = null;
    selectionId = null;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("mouseleave", onLeave, true);
    document.removeEventListener("click", onClick, true);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return false;
    if (message.type === "PREPARE_CAPTURE") {
      if (!selected || !selected.isConnected || message.selectionId !== selectionId) {
        sendResponse({ ok: false, error: "The selected element is no longer available. Select it again." });
        return false;
      }
      const rect = selected.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.bottom <= 0 || rect.left >= innerWidth || rect.top >= innerHeight) {
        sendResponse({ ok: false, error: "The selected element is outside the visible viewport. Scroll it into view and retry." });
        return false;
      }
      restore(hovered);
      hovered = null;
      rememberAndOutline(selected, "#e5484d", 4);
      requestAnimationFrame(() => requestAnimationFrame(() => sendResponse({ ok: true })));
      return true;
    }
    if (message.type === "CLEAR_CAPTURE") {
      restore(selected);
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === "DISABLE_ANNOTATION") {
      disable();
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });

  globalThis.__piWebAnnotatorContentScript = { enable, disable };
  enable();
})();
