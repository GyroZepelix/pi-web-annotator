importScripts("lib/constants.js", "lib/annotations.js", "lib/bundle.js", "lib/bridge.js");

"use strict";

const { STATE_KEY, LIMITS } = PiAnnotatorConstants;
const State = PiAnnotatorState;
const Bundle = PiAnnotatorBundle;
const Bridge = PiAnnotatorBridge;
let operationQueue = Promise.resolve();
let bridgeProbe = null;
let bridgeState = { status: "disconnected", detail: "No Pi bridge is connected.", token: null };

function enqueue(operation) {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.catch(() => {});
  return result;
}

async function loadSession() {
  const stored = await chrome.storage.session.get(STATE_KEY);
  if (!stored[STATE_KEY]) return State.createSession();
  return State.assertBasicSession(stored[STATE_KEY]);
}

async function saveSession(next) {
  State.assertBasicSession(next);
  next.revision += 1;
  const serializedBytes = new TextEncoder().encode(JSON.stringify(next)).length;
  if (serializedBytes > LIMITS.sessionStorageBudgetBytes) {
    throw new Error(`Pending session exceeds the ${LIMITS.sessionStorageBudgetBytes}-byte storage budget.`);
  }
  await chrome.storage.session.set({ [STATE_KEY]: next });
  notifyStateChanged();
  return next;
}

function notifyStateChanged() {
  chrome.runtime.sendMessage({ type: "STATE_CHANGED" }).catch(() => {});
}

function publicBridgeState() {
  return { status: bridgeState.status, detail: bridgeState.detail };
}

function setBridgeState(status, detail, token) {
  bridgeState = { status, detail, token: token || null };
  notifyStateChanged();
  return publicBridgeState();
}

async function checkBridge() {
  if (bridgeProbe) return bridgeProbe;
  bridgeProbe = (async () => {
    try {
      const connected = await Bridge.handshake();
      return setBridgeState("connected", "Pi is waiting for this project-aware save.", connected.token);
    } catch {
      return setBridgeState("disconnected", "No Pi bridge is connected.", null);
    } finally {
      bridgeProbe = null;
    }
  })();
  return bridgeProbe;
}

async function finishWithBridge() {
  if (bridgeState.status !== "connected" || !bridgeState.token) await checkBridge();
  if (bridgeState.status !== "connected" || !bridgeState.token) {
    throw new Error("Pi bridge is unavailable. Pending annotations were retained; run /annotate to reconnect or use standalone save when available.");
  }
  const finish = await finishData();
  const completedAt = new Date();
  const manifest = Bundle.createManifest(finish.session, Bundle.baseCaptureId(completedAt), completedAt.toISOString());
  let result;
  try {
    result = await Bridge.complete(undefined, bridgeState.token, manifest, finish.images);
  } catch (error) {
    setBridgeState("disconnected", "Pi bridge was lost. Pending annotations were retained.", null);
    throw new Error(`${error.message}. Pending annotations were retained; run /annotate to reconnect or use standalone save when available.`);
  }
  setBridgeState("disconnected", "The Pi bridge session finished.", null);
  if (result.status !== "saved") throw new Error(`${result.message} Pending annotations were retained.`);
  await clearSession(finish.revision);
  return result;
}

function supportedPage(tab) {
  if (!tab || !Number.isInteger(tab.id)) throw new Error("No active page is available.");
  if (typeof tab.url !== "string") throw new Error("Click the Pi Web Annotator toolbar action on this tab before enabling annotation.");
  let url;
  try { url = new URL(tab.url); } catch { throw new Error("This page URL is not supported."); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Only HTTP and HTTPS pages can be annotated.");
  return url.href;
}

async function enableTab(tabId) {
  if (!Number.isInteger(tabId)) throw new Error("An active tab is required.");
  const tab = await chrome.tabs.get(tabId);
  const url = supportedPage(tab);
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ["lib/constants.js", "lib/selectors.js", "content-script.js"]
    });
  } catch (error) {
    throw new Error(`Chrome did not allow annotation on this page: ${error.message}`);
  }
  const topFrame = results.find((result) => result.frameId === 0) || results[0];
  if (!topFrame || typeof topFrame.documentId !== "string") throw new Error("Chrome did not return a document identity; reload and retry.");

  const current = await loadSession();
  const next = State.clone(current);
  const key = String(tabId);
  const existing = next.enabled[key];
  if (existing && existing.documentId === topFrame.documentId) return State.publicState(next, publicBridgeState());
  if (existing) delete next.drafts[existing.pageId];
  const pageId = State.nextId(next, "page");
  next.pages.push({ id: pageId, url, title: String(tab.title || "").slice(0, 2000), annotations: [] });
  next.enabled[key] = { tabId, documentId: topFrame.documentId, pageId, url, mode: "active" };
  await saveSession(next);
  return State.publicState(next, publicBridgeState());
}

function enabledDocument(state, tabId, documentId) {
  const enabled = state.enabled[String(tabId)];
  if (!enabled || enabled.documentId !== documentId) throw new Error("Annotation is not enabled for this document. Enable it again after navigation.");
  return enabled;
}

function assertId(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`${label} is invalid.`);
}

function assertPageId(value) {
  assertId(value, /^page-[0-9]{4,}$/, "Page identity");
}

function assertSelectionId(value) {
  assertId(value, /^[0-9a-f-]{20,}$/i, "Selection identity");
}

function assertArmId(value) {
  assertId(value, /^[0-9a-f-]{20,}$/i, "Armed capture identity");
}

function assertAnnotationId(value) {
  assertId(value, /^annotation-[0-9]{4,}$/, "Annotation identity");
}

function documentMode(enabled) {
  return enabled.mode === "paused" ? "paused" : "active";
}

function requireActiveDocument(state, tabId, documentId) {
  const enabled = enabledDocument(state, tabId, documentId);
  if (documentMode(enabled) !== "active") throw new Error("Resume annotation before selecting or capturing a target.");
  return enabled;
}

async function setDocumentMode(tabId, nextMode) {
  if (!Number.isInteger(tabId)) throw new Error("An active tab is required.");
  const current = await loadSession();
  const enabled = current.enabled[String(tabId)];
  if (!enabled) throw new Error("Annotation is not enabled for this document. Enable it again after navigation.");
  const currentMode = documentMode(enabled);
  if (currentMode === nextMode) return State.publicState(current, publicBridgeState());
  const messageType = nextMode === "paused" ? "PAUSE_ANNOTATION" : "RESUME_ANNOTATION";
  const rollbackType = nextMode === "paused" ? "RESUME_ANNOTATION" : "PAUSE_ANNOTATION";
  let response;
  try {
    response = await chrome.tabs.sendMessage(enabled.tabId, { type: messageType }, { documentId: enabled.documentId });
  } catch (error) {
    throw new Error(`The page runtime could not ${nextMode === "paused" ? "pause" : "resume"}: ${error.message}`);
  }
  if (!response || !response.ok) throw new Error(response && response.error ? response.error : `The page runtime could not ${nextMode === "paused" ? "pause" : "resume"}.`);

  const next = State.clone(current);
  next.enabled[String(tabId)].mode = nextMode;
  const draft = next.drafts[enabled.pageId];
  const priorArmed = draft && draft.armed ? State.clone(draft.armed) : null;
  if (draft && nextMode === "paused") delete draft.armed;
  try {
    await saveSession(next);
  } catch (error) {
    await chrome.tabs.sendMessage(enabled.tabId, { type: rollbackType }, { documentId: enabled.documentId }).catch(() => {});
    if (nextMode === "paused" && draft && priorArmed) {
      await chrome.tabs.sendMessage(
        enabled.tabId,
        { type: "ARM_CAPTURE", armId: priorArmed.armId, selectionId: draft.selectionId },
        { documentId: enabled.documentId }
      ).catch(() => {});
    }
    throw error;
  }
  return State.publicState(next, publicBridgeState());
}

async function storeSelection(message, sender) {
  if (!sender.tab || !Number.isInteger(sender.tab.id) || typeof sender.documentId !== "string") throw new Error("Selection sender is invalid.");
  assertSelectionId(message.selectionId);
  Bundle.validateTarget(message.target, "target");
  const current = await loadSession();
  const enabled = requireActiveDocument(current, sender.tab.id, sender.documentId);
  const next = State.clone(current);
  next.drafts[enabled.pageId] = {
    pageId: enabled.pageId,
    tabId: sender.tab.id,
    documentId: sender.documentId,
    selectionId: message.selectionId,
    selectedAt: new Date().toISOString(),
    target: message.target
  };
  await saveSession(next);
  return { ok: true };
}

async function recordDraftFailure(pageId, selectionId, error, invalid = false) {
  try {
    const current = await loadSession();
    const draft = current.drafts[pageId];
    if (!draft || draft.selectionId !== selectionId) return;
    const next = State.clone(current);
    delete next.drafts[pageId].armed;
    next.drafts[pageId].captureError = String(error);
    if (invalid) next.drafts[pageId].targetInvalid = true;
    await saveSession(next);
  } catch {
    // Preserve the original failure when even the recovery-state write is unavailable.
  }
}

async function armCapture(message) {
  assertPageId(message.pageId);
  const comment = State.normalizeComment(message.comment);
  const current = await loadSession();
  const draft = current.drafts[message.pageId];
  if (!draft) throw new Error("The pending selection is no longer available.");
  if (draft.targetInvalid) throw new Error("The selected element is no longer available. Select it again.");
  if (State.annotationCount(current) >= LIMITS.annotations) throw new Error(`The session limit is ${LIMITS.annotations} annotations.`);
  requireActiveDocument(current, draft.tabId, draft.documentId);
  const tab = await chrome.tabs.get(draft.tabId);
  if (!tab.active) throw new Error("Activate the selected page before arming its screenshot.");
  supportedPage(tab);

  const armId = crypto.randomUUID();
  const next = State.clone(current);
  next.drafts[message.pageId].comment = comment;
  next.drafts[message.pageId].armed = { armId, selectionId: draft.selectionId };
  delete next.drafts[message.pageId].captureError;
  await saveSession(next);

  try {
    const response = await chrome.tabs.sendMessage(
      draft.tabId,
      { type: "ARM_CAPTURE", armId, selectionId: draft.selectionId },
      { documentId: draft.documentId }
    );
    if (!response || !response.ok) throw new Error(response && response.error ? response.error : "The target could not be armed.");
  } catch (error) {
    const invalid = /no longer available/i.test(error.message);
    await recordDraftFailure(draft.pageId, draft.selectionId, error.message, invalid);
    throw error;
  }
  return { ok: true, armId };
}

async function cancelArmedCapture(message) {
  assertPageId(message.pageId);
  assertSelectionId(message.selectionId);
  const current = await loadSession();
  const draft = current.drafts[message.pageId];
  if (!draft || draft.selectionId !== message.selectionId) throw new Error("The pending selection is no longer available.");
  const armed = draft.armed;
  if (!armed) return { ok: true };
  const next = State.clone(current);
  delete next.drafts[message.pageId].armed;
  delete next.drafts[message.pageId].captureError;
  await saveSession(next);
  await chrome.tabs.sendMessage(
    draft.tabId,
    { type: "CANCEL_ARMED_CAPTURE", armId: armed.armId, selectionId: draft.selectionId },
    { documentId: draft.documentId }
  ).catch(() => {});
  return { ok: true };
}

async function captureFailed(message, sender) {
  assertArmId(message.armId);
  assertSelectionId(message.selectionId);
  if (typeof message.error !== "string" || !message.error || message.error.length > 1000) throw new Error("Capture error is invalid.");
  if (!sender.tab || !Number.isInteger(sender.tab.id) || typeof sender.documentId !== "string") throw new Error("Capture sender is invalid.");
  const current = await loadSession();
  const enabled = enabledDocument(current, sender.tab.id, sender.documentId);
  const draft = current.drafts[enabled.pageId];
  if (!draft || !draft.armed || draft.armed.armId !== message.armId || draft.selectionId !== message.selectionId) {
    throw new Error("The armed capture identity is stale.");
  }
  await recordDraftFailure(enabled.pageId, draft.selectionId, String(message.error || "Capture failed."), true);
  return { ok: true };
}

async function captureReady(message, sender) {
  assertArmId(message.armId);
  assertSelectionId(message.selectionId);
  if (!sender.tab || !Number.isInteger(sender.tab.id) || typeof sender.documentId !== "string") throw new Error("Capture sender is invalid.");
  const current = await loadSession();
  const enabled = requireActiveDocument(current, sender.tab.id, sender.documentId);
  const draft = current.drafts[enabled.pageId];
  if (!draft || !draft.armed || draft.armed.armId !== message.armId || draft.selectionId !== message.selectionId) {
    throw new Error("The armed capture identity is stale.");
  }

  const disarmed = State.clone(current);
  delete disarmed.drafts[enabled.pageId].armed;
  delete disarmed.drafts[enabled.pageId].captureError;
  await saveSession(disarmed);

  let dataUrl;
  try {
    const tab = await chrome.tabs.get(draft.tabId);
    if (!tab.active) throw new Error("Activate the selected page before capturing its screenshot.");
    supportedPage(tab);
    dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const bytes = Bundle.bytesFromImage(dataUrl, "screenshot");
    if (bytes.length > LIMITS.imageBytes) throw new Error(`Screenshot exceeds the ${LIMITS.imageBytes}-byte image limit.`);

    const latest = await loadSession();
    const latestDraft = latest.drafts[enabled.pageId];
    if (!latestDraft || latestDraft.selectionId !== draft.selectionId || latestDraft.documentId !== draft.documentId) {
      throw new Error("The selected target changed before capture completed. Select it again.");
    }
    requireActiveDocument(latest, draft.tabId, draft.documentId);
    if (State.annotationCount(latest) >= LIMITS.annotations) throw new Error(`The session limit is ${LIMITS.annotations} annotations.`);
    if (State.totalImageBytes(latest) + bytes.length > LIMITS.totalImageBytes) throw new Error("Screenshots exceed the session image limit.");

    const next = State.clone(latest);
    const page = next.pages.find((candidate) => candidate.id === draft.pageId);
    if (!page) throw new Error("The selected page record is unavailable.");
    const annotationId = State.nextId(next, "annotation");
    const timestamp = new Date().toISOString();
    const path = `screenshots/${annotationId}.png`;
    page.annotations.push({
      id: annotationId,
      comment: latestDraft.comment,
      created_at: timestamp,
      updated_at: timestamp,
      target: latestDraft.target,
      screenshot: { path, media_type: "image/png", bytes: bytes.length }
    });
    next.screenshots[path] = dataUrl;
    delete next.drafts[draft.pageId];
    await saveSession(next);
    await chrome.tabs.sendMessage(
      draft.tabId,
      { type: "COMPLETE_CAPTURE", selectionId: draft.selectionId, annotationId },
      { documentId: draft.documentId }
    ).catch(() => {});
    return { ok: true, annotationId };
  } catch (error) {
    const invalid = /changed before capture completed|no longer available/i.test(error.message);
    await recordDraftFailure(draft.pageId, draft.selectionId, `Screenshot capture failed: ${error.message}`, invalid);
    throw new Error(`Screenshot capture failed: ${error.message}`);
  } finally {
    await chrome.tabs.sendMessage(draft.tabId, { type: "CLEAR_CAPTURE" }, { documentId: draft.documentId }).catch(() => {});
  }
}

function findAnnotation(state, annotationId) {
  for (const page of state.pages) {
    const index = page.annotations.findIndex((annotation) => annotation.id === annotationId);
    if (index !== -1) return { page, index, annotation: page.annotations[index] };
  }
  throw new Error("Annotation was not found.");
}

async function editComment(message) {
  assertAnnotationId(message.annotationId);
  const comment = State.normalizeComment(message.comment);
  const next = State.clone(await loadSession());
  const { annotation } = findAnnotation(next, message.annotationId);
  annotation.comment = comment;
  annotation.updated_at = new Date().toISOString();
  await saveSession(next);
  return { ok: true };
}

async function deleteAnnotation(message) {
  assertAnnotationId(message.annotationId);
  const next = State.clone(await loadSession());
  const { page, index, annotation } = findAnnotation(next, message.annotationId);
  page.annotations.splice(index, 1);
  delete next.screenshots[annotation.screenshot.path];
  await saveSession(next);
  const enabled = Object.values(next.enabled).find((entry) => entry.pageId === page.id);
  if (enabled) {
    await chrome.tabs.sendMessage(
      enabled.tabId,
      { type: "UNBIND_ANNOTATION", annotationId: message.annotationId },
      { documentId: enabled.documentId }
    ).catch(() => {});
  }
  return { ok: true };
}

async function highlightAnnotation(message) {
  assertAnnotationId(message.annotationId);
  const state = await loadSession();
  const { page } = findAnnotation(state, message.annotationId);
  const enabled = Object.values(state.enabled).find((entry) => entry.pageId === page.id);
  if (!enabled) throw new Error("Highlight is unavailable because the source document was replaced or closed.");
  const tab = await chrome.tabs.get(enabled.tabId);
  const [currentActiveTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.active || !currentActiveTab || currentActiveTab.id !== enabled.tabId) {
    throw new Error("Switch to the annotation's source tab before using Highlight.");
  }
  supportedPage(tab);
  let response;
  try {
    response = await chrome.tabs.sendMessage(
      enabled.tabId,
      { type: "HIGHLIGHT_TARGET", annotationId: message.annotationId },
      { documentId: enabled.documentId }
    );
  } catch {
    throw new Error("Highlight is unavailable because the source page runtime is no longer available.");
  }
  if (!response || !response.ok) {
    throw new Error(response && response.error ? response.error : "Highlight is unavailable because the exact live target is gone.");
  }
  return { ok: true };
}

async function clearSession(expectedRevision) {
  const current = await loadSession();
  if (expectedRevision !== undefined && current.revision !== expectedRevision) {
    throw new Error("The annotation session changed while saving. The saved snapshot is complete, and newer browser state was retained.");
  }
  await Promise.all(Object.values(current.enabled).map((entry) =>
    chrome.tabs.sendMessage(entry.tabId, { type: "DISABLE_ANNOTATION" }, { documentId: entry.documentId }).catch(() => {})
  ));
  await chrome.storage.session.remove(STATE_KEY);
  notifyStateChanged();
  return { ok: true };
}

async function finishData() {
  const state = await loadSession();
  if (State.annotationCount(state) === 0) throw new Error("Add at least one annotation before finishing.");
  const session = State.clone(state);
  session.screenshots = {};
  return { session, images: State.clone(state.screenshots), revision: state.revision };
}

async function removeEnabledTab(tabId) {
  const current = await loadSession();
  const enabled = current.enabled[String(tabId)];
  if (!enabled) return;
  const next = State.clone(current);
  delete next.enabled[String(tabId)];
  delete next.drafts[enabled.pageId];
  await saveSession(next);
}

function assertMessageShape(message, fields) {
  if (!message || typeof message !== "object" || Array.isArray(message) || typeof message.type !== "string") throw new Error("Message is malformed.");
  const actual = Object.keys(message).sort();
  const expected = ["type", ...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) throw new Error("Message has unsupported or missing fields.");
}

async function handleMessage(message, sender) {
  if (!message || typeof message.type !== "string") throw new Error("Message is malformed.");
  switch (message.type) {
    case "GET_STATE":
      assertMessageShape(message, []);
      return { ok: true, state: State.publicState(await loadSession(), publicBridgeState()) };
    case "CHECK_BRIDGE":
      assertMessageShape(message, []);
      return { ok: true, bridge: await checkBridge() };
    case "FINISH_BRIDGE":
      assertMessageShape(message, []);
      return { ok: true, result: await finishWithBridge() };
    case "ENABLE_TAB":
      assertMessageShape(message, ["tabId"]);
      return { ok: true, state: await enableTab(message.tabId) };
    case "PAUSE_DOCUMENT":
      assertMessageShape(message, ["tabId"]);
      return { ok: true, state: await setDocumentMode(message.tabId, "paused") };
    case "RESUME_DOCUMENT":
      assertMessageShape(message, ["tabId"]);
      return { ok: true, state: await setDocumentMode(message.tabId, "active") };
    case "TARGET_SELECTED":
      assertMessageShape(message, ["selectionId", "target"]);
      return storeSelection(message, sender);
    case "TARGET_SELECTION_FAILED":
      assertMessageShape(message, ["error"]);
      throw new Error(String(message.error || "Target selection failed."));
    case "ARM_CAPTURE":
      assertMessageShape(message, ["comment", "pageId"]);
      return armCapture(message);
    case "CANCEL_ARMED_CAPTURE":
      assertMessageShape(message, ["pageId", "selectionId"]);
      return cancelArmedCapture(message);
    case "CAPTURE_READY":
      assertMessageShape(message, ["armId", "selectionId"]);
      return captureReady(message, sender);
    case "CAPTURE_FAILED":
      assertMessageShape(message, ["armId", "error", "selectionId"]);
      return captureFailed(message, sender);
    case "EDIT_COMMENT":
      assertMessageShape(message, ["annotationId", "comment"]);
      return editComment(message);
    case "DELETE_ANNOTATION":
      assertMessageShape(message, ["annotationId"]);
      return deleteAnnotation(message);
    case "HIGHLIGHT_ANNOTATION":
      assertMessageShape(message, ["annotationId"]);
      return highlightAnnotation(message);
    case "CANCEL_SESSION":
      assertMessageShape(message, []);
      return clearSession();
    case "GET_FINISH_DATA":
      assertMessageShape(message, []);
      return { ok: true, data: await finishData() };
    case "COMPLETE_SESSION":
      assertMessageShape(message, ["revision"]);
      if (!Number.isInteger(message.revision) || message.revision < 0) throw new Error("Completion revision is invalid.");
      return clearSession(message.revision);
    default: throw new Error("Message action is unsupported.");
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "STATE_CHANGED") return false;
  enqueue(() => handleMessage(message, sender))
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab || !Number.isInteger(tab.windowId)) return;
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  notifyStateChanged();
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") enqueue(() => removeEnabledTab(tabId)).catch(() => {});
});
chrome.tabs.onRemoved.addListener((tabId) => {
  enqueue(() => removeEnabledTab(tabId)).catch(() => {});
});
