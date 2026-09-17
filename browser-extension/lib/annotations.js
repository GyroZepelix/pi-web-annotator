(function (root, factory) {
  const constants = root.PiAnnotatorConstants || (typeof require === "function" ? require("./constants.js") : null);
  const api = factory(constants);
  root.PiAnnotatorState = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants) {
  "use strict";

  if (!constants) throw new Error("PiAnnotatorConstants is required");
  const { LIMITS, STATE_VERSION } = constants;

  function createSession(now) {
    const createdAt = (now || new Date()).toISOString();
    return {
      version: STATE_VERSION,
      createdAt,
      revision: 0,
      nextPage: 1,
      nextAnnotation: 1,
      pages: [],
      enabled: {},
      drafts: {},
      screenshots: {}
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeComment(value) {
    if (typeof value !== "string") throw new Error("Comment must be text.");
    const comment = value.trim();
    if (!comment) throw new Error("Comment must not be empty.");
    if ([...comment].length > LIMITS.commentCharacters) throw new Error(`Comment exceeds ${LIMITS.commentCharacters} characters.`);
    return comment;
  }

  function nextId(state, kind) {
    const counter = kind === "page" ? "nextPage" : "nextAnnotation";
    if (!Number.isInteger(state[counter]) || state[counter] < 1) throw new Error("Session counter is invalid.");
    const prefix = kind === "page" ? "page" : "annotation";
    const id = `${prefix}-${String(state[counter]).padStart(4, "0")}`;
    state[counter] += 1;
    return id;
  }

  function annotationCount(state) {
    return state.pages.reduce((total, page) => total + page.annotations.length, 0);
  }

  function totalImageBytes(state) {
    return state.pages.reduce((total, page) => total + page.annotations.reduce((pageTotal, annotation) => pageTotal + annotation.screenshot.bytes, 0), 0);
  }

  function publicState(state, bridge) {
    return {
      createdAt: state.createdAt,
      revision: state.revision,
      pages: clone(state.pages),
      enabled: clone(state.enabled),
      drafts: clone(state.drafts),
      annotationCount: annotationCount(state),
      limits: LIMITS,
      bridge: bridge || { status: "disconnected", detail: "Standalone save is available." }
    };
  }

  function assertBasicSession(state) {
    if (!state || state.version !== STATE_VERSION || !Number.isInteger(state.revision) || state.revision < 0 || !Array.isArray(state.pages) || !state.enabled || !state.drafts || !state.screenshots) {
      throw new Error("Stored annotation session is invalid.");
    }
    return state;
  }

  return Object.freeze({ assertBasicSession, annotationCount, clone, createSession, nextId, normalizeComment, publicState, totalImageBytes });
});
