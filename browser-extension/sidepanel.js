(() => {
  "use strict";

  const filesystem = PiAnnotatorFilesystem;
  const elements = {
    pageDetail: document.querySelector("#page-detail"),
    enable: document.querySelector("#enable-button"),
    drafts: document.querySelector("#drafts"),
    annotations: document.querySelector("#annotations"),
    count: document.querySelector("#annotation-count"),
    cancel: document.querySelector("#cancel-button"),
    finish: document.querySelector("#finish-button"),
    notice: document.querySelector("#notice"),
    error: document.querySelector("#error")
  };
  let state = null;
  let activeTab = null;
  let busy = false;

  function setError(message) {
    elements.error.textContent = message || "";
    elements.error.hidden = !message;
  }

  function setNotice(message) {
    elements.notice.textContent = message || "";
    elements.notice.hidden = !message;
  }

  function setBusy(value) {
    busy = value;
    elements.enable.disabled = value;
    elements.cancel.disabled = value;
    elements.finish.disabled = value || !state || state.annotationCount === 0;
  }

  async function send(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response || !response.ok) throw new Error(response && response.error ? response.error : "The extension did not respond.");
    return response;
  }

  function button(label, action, className) {
    const control = document.createElement("button");
    control.type = "button";
    control.textContent = label;
    if (className) control.className = className;
    control.addEventListener("click", action);
    return control;
  }

  function pageFor(pageId) {
    return state.pages.find((page) => page.id === pageId);
  }

  function renderDrafts() {
    elements.drafts.replaceChildren();
    const drafts = Object.values(state.drafts);
    if (drafts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Select an element on an enabled page.";
      elements.drafts.append(empty);
      return;
    }
    for (const draft of drafts) {
      const page = pageFor(draft.pageId);
      if (!page) continue;
      const card = document.createElement("form");
      card.className = "card";
      const context = document.createElement("p");
      context.className = "meta";
      context.textContent = `${page.title || page.url} · <${draft.target.tag_name}>`;
      const textarea = document.createElement("textarea");
      textarea.required = true;
      textarea.maxLength = PiAnnotatorConstants.LIMITS.commentCharacters;
      textarea.placeholder = "Describe the requested change or observation…";
      const submit = button("Accept comment and capture", () => {}, "");
      submit.type = "submit";
      card.addEventListener("submit", async (event) => {
        event.preventDefault();
        await runAction({ type: "ACCEPT_COMMENT", pageId: draft.pageId, comment: textarea.value });
      });
      card.append(context, textarea, submit);
      elements.drafts.append(card);
    }
  }

  function renderAnnotations() {
    elements.annotations.replaceChildren();
    elements.count.textContent = String(state.annotationCount);
    if (state.annotationCount === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No annotations yet.";
      elements.annotations.append(empty);
      return;
    }
    for (const page of state.pages) {
      for (const annotation of page.annotations) {
        const card = document.createElement("article");
        card.className = "card";
        const meta = document.createElement("p");
        meta.className = "meta";
        meta.textContent = `${page.title || page.url} · ${annotation.target.tag_name} · ${annotation.id}`;
        const comment = document.createElement("p");
        comment.textContent = annotation.comment;
        const actions = document.createElement("div");
        actions.className = "actions";
        actions.append(
          button("Edit", () => showEditor(card, annotation)),
          button("Delete", () => runAction({ type: "DELETE_ANNOTATION", annotationId: annotation.id }), "danger")
        );
        card.append(meta, comment, actions);
        elements.annotations.append(card);
      }
    }
  }

  function showEditor(card, annotation) {
    const textarea = document.createElement("textarea");
    textarea.maxLength = PiAnnotatorConstants.LIMITS.commentCharacters;
    textarea.value = annotation.comment;
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(
      button("Save edit", () => runAction({ type: "EDIT_COMMENT", annotationId: annotation.id, comment: textarea.value })),
      button("Keep original", render, "secondary")
    );
    card.replaceChildren(textarea, actions);
    textarea.focus();
  }

  function render() {
    if (!state) return;
    const enabled = activeTab && state.enabled[String(activeTab.id)];
    elements.pageDetail.textContent = activeTab
      ? `${activeTab.title || activeTab.url || "Active tab"}${enabled ? " — annotation enabled for this document" : " — not enabled"}`
      : "No active browser tab is available.";
    elements.enable.textContent = enabled ? "Annotation enabled for this document" : "Enable annotation on this page";
    elements.enable.disabled = busy || !activeTab || Boolean(enabled);
    elements.cancel.disabled = busy || (state.annotationCount === 0 && Object.keys(state.drafts).length === 0);
    elements.finish.disabled = busy || state.annotationCount === 0;
    renderDrafts();
    renderAnnotations();
  }

  async function refresh() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      activeTab = tabs[0] || null;
      state = (await send({ type: "GET_STATE" })).state;
      render();
    } catch (error) {
      setError(error.message);
    }
  }

  async function runAction(message) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await send(message);
      await refresh();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
      render();
    }
  }

  elements.enable.addEventListener("click", () => {
    if (activeTab) runAction({ type: "ENABLE_TAB", tabId: activeTab.id });
  });

  elements.cancel.addEventListener("click", () => {
    if (window.confirm("Discard all pending annotations and screenshots?")) runAction({ type: "CANCEL_SESSION" });
  });

  elements.finish.addEventListener("click", async () => {
    setError("");
    setNotice("");
    if (typeof window.showDirectoryPicker !== "function") {
      setError("This Chrome context does not provide the File System Access directory picker.");
      return;
    }

    let pickerPromise;
    try {
      pickerPromise = window.showDirectoryPicker({ mode: "readwrite" });
    } catch (error) {
      setError(`Directory picker failed: ${error.message}`);
      return;
    }

    setBusy(true);
    try {
      const rootDirectory = await pickerPromise;
      const finishData = (await send({ type: "GET_FINISH_DATA" })).data;
      const saved = await filesystem.saveStandalone(rootDirectory, finishData, {
        confirmGitignore: (question) => window.confirm(question)
      });
      try {
        await send({ type: "COMPLETE_SESSION", revision: finishData.revision });
        state = (await send({ type: "GET_STATE" })).state;
      } catch (clearError) {
        setError(clearError.message);
      }
      const warning = saved.warning ? ` Warning: ${saved.warning}` : "";
      setNotice(`Saved ${saved.relativePath}.${warning}`);
      await refresh();
    } catch (error) {
      if (error && error.name === "AbortError") setError("Save cancelled. Pending annotations were retained.");
      else setError(`Save failed: ${error.message}. Pending annotations were retained for retry.`);
    } finally {
      setBusy(false);
      render();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "STATE_CHANGED" && !busy) refresh();
  });
  chrome.tabs.onActivated.addListener(() => refresh());
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.status === "complete") refresh();
  });

  refresh();
})();
