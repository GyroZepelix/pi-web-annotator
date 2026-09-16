importScripts("lib/constants.js", "lib/annotations.js", "lib/bundle.js");

"use strict";

const { STATE_KEY, LIMITS } = PiAnnotatorConstants;
const State = PiAnnotatorState;
const Bundle = PiAnnotatorBundle;
let operationQueue = Promise.resolve();

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

function supportedPage(tab) {
  if (!tab || !Number.isInteger(tab.id) || typeof tab.url !== "string") throw new Error("No active page is available.");
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
  if (existing && existing.documentId === topFrame.documentId) return State.publicState(next);
  if (existing) delete next.drafts[existing.pageId];
  const pageId = State.nextId(next, "page");
  next.pages.push({ id: pageId, url, title: String(tab.title || "").slice(0, 2000), annotations: [] });
  next.enabled[key] = { tabId, documentId: topFrame.documentId, pageId, url };
  await saveSession(next);
  return State.publicState(next);
}

function enabledDocument(state, tabId, documentId) {
  const enabled = state.enabled[String(tabId)];
  if (!enabled || enabled.documentId !== documentId) throw new Error("Annotation is not enabled for this document. Enable it again after navigation.");
  return enabled;
}

async function storeSelection(message, sender) {
  if (!sender.tab || !Number.isInteger(sender.tab.id) || typeof sender.documentId !== "string") throw new Error("Selection sender is invalid.");
  if (typeof message.selectionId !== "string" || !/^[0-9a-f-]{20,}$/i.test(message.selectionId)) throw new Error("Selection identity is invalid.");
  Bundle.validateTarget(message.target, "target");
  const current = await loadSession();
  const enabled = enabledDocument(current, sender.tab.id, sender.documentId);
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

async function acceptComment(message) {
  const comment = State.normalizeComment(message.comment);
  const current = await loadSession();
  const draft = current.drafts[message.pageId];
  if (!draft) throw new Error("The pending selection is no longer available.");
  if (State.annotationCount(current) >= LIMITS.annotations) throw new Error(`The session limit is ${LIMITS.annotations} annotations.`);
  enabledDocument(current, draft.tabId, draft.documentId);
  const tab = await chrome.tabs.get(draft.tabId);
  if (!tab.active) throw new Error("Activate the selected page before capturing its screenshot.");
  supportedPage(tab);

  let prepared = false;
  let dataUrl;
  try {
    const response = await chrome.tabs.sendMessage(
      draft.tabId,
      { type: "PREPARE_CAPTURE", selectionId: draft.selectionId },
      { documentId: draft.documentId }
    );
    if (!response || !response.ok) throw new Error(response && response.error ? response.error : "The target could not be outlined.");
    prepared = true;
    dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  } catch (error) {
    throw new Error(`Screenshot capture failed: ${error.message}`);
  } finally {
    if (prepared) {
      await chrome.tabs.sendMessage(draft.tabId, { type: "CLEAR_CAPTURE" }, { documentId: draft.documentId }).catch(() => {});
    }
  }

  const bytes = Bundle.bytesFromImage(dataUrl, "screenshot");
  if (bytes.length > LIMITS.imageBytes) throw new Error(`Screenshot exceeds the ${LIMITS.imageBytes}-byte image limit.`);
  if (State.totalImageBytes(current) + bytes.length > LIMITS.totalImageBytes) throw new Error("Screenshots exceed the session image limit.");

  const next = State.clone(current);
  const page = next.pages.find((candidate) => candidate.id === draft.pageId);
  if (!page) throw new Error("The selected page record is unavailable.");
  const annotationId = State.nextId(next, "annotation");
  const timestamp = new Date().toISOString();
  const path = `screenshots/${annotationId}.png`;
  page.annotations.push({
    id: annotationId,
    comment,
    created_at: timestamp,
    updated_at: timestamp,
    target: draft.target,
    screenshot: { path, media_type: "image/png", bytes: bytes.length }
  });
  next.screenshots[path] = dataUrl;
  delete next.drafts[draft.pageId];
  await saveSession(next);
  return { ok: true, annotationId };
}

function findAnnotation(state, annotationId) {
  for (const page of state.pages) {
    const index = page.annotations.findIndex((annotation) => annotation.id === annotationId);
    if (index !== -1) return { page, index, annotation: page.annotations[index] };
  }
  throw new Error("Annotation was not found.");
}

async function editComment(message) {
  const comment = State.normalizeComment(message.comment);
  const next = State.clone(await loadSession());
  const { annotation } = findAnnotation(next, message.annotationId);
  annotation.comment = comment;
  annotation.updated_at = new Date().toISOString();
  await saveSession(next);
  return { ok: true };
}

async function deleteAnnotation(message) {
  const next = State.clone(await loadSession());
  const { page, index, annotation } = findAnnotation(next, message.annotationId);
  page.annotations.splice(index, 1);
  delete next.screenshots[annotation.screenshot.path];
  await saveSession(next);
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
      return { ok: true, state: State.publicState(await loadSession()) };
    case "ENABLE_TAB":
      assertMessageShape(message, ["tabId"]);
      return { ok: true, state: await enableTab(message.tabId) };
    case "TARGET_SELECTED":
      assertMessageShape(message, ["selectionId", "target"]);
      return storeSelection(message, sender);
    case "TARGET_SELECTION_FAILED":
      assertMessageShape(message, ["error"]);
      throw new Error(String(message.error || "Target selection failed."));
    case "ACCEPT_COMMENT":
      assertMessageShape(message, ["comment", "pageId"]);
      return acceptComment(message);
    case "EDIT_COMMENT":
      assertMessageShape(message, ["annotationId", "comment"]);
      return editComment(message);
    case "DELETE_ANNOTATION":
      assertMessageShape(message, ["annotationId"]);
      return deleteAnnotation(message);
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") enqueue(() => removeEnabledTab(tabId)).catch(() => {});
});
chrome.tabs.onRemoved.addListener((tabId) => {
  enqueue(() => removeEnabledTab(tabId)).catch(() => {});
});
