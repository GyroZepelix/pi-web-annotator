"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const Bundle = require("../../../browser-extension/lib/bundle.js");
const Constants = require("../../../browser-extension/lib/constants.js");

const HOST = "127.0.0.1";
const PORT = 43127;
const ORIGIN = Constants.EXTENSION_ORIGIN;
const PROTOCOL_VERSION = Constants.BRIDGE_PROTOCOL_VERSION;
const MAX_PAYLOAD_BYTES = Constants.LIMITS.bridgePayloadBytes;
const JSON_TYPE = "application/json";

function ownKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has unsupported or missing fields`);
  }
}

function isJsonMediaType(value) {
  if (typeof value !== "string") return false;
  const parts = value.toLowerCase().split(";").map((part) => part.trim());
  if (parts[0] !== JSON_TYPE) return false;
  return parts.slice(1).every((parameter) => parameter === "charset=utf-8");
}

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-pi-annotator-token",
    "access-control-max-age": "60",
    "cache-control": "no-store",
    vary: "Origin"
  };
}

function respondJson(response, statusCode, body, origin) {
  const bytes = Buffer.from(JSON.stringify(body), "utf8");
  response.writeHead(statusCode, {
    ...(origin === ORIGIN ? corsHeaders(origin) : { "cache-control": "no-store", vary: "Origin" }),
    "content-type": "application/json; charset=utf-8",
    "content-length": bytes.length,
    "x-content-type-options": "nosniff"
  });
  response.end(bytes);
}

function rejectRequest(request, response, statusCode, message, origin) {
  request.resume();
  respondJson(response, statusCode, { status: "terminal_error", message }, origin);
}

async function readBody(request, maximum) {
  const declared = request.headers["content-length"];
  if (declared !== undefined) {
    if (!/^\d+$/.test(declared)) throw new Error("Content-Length is malformed");
    if (Number(declared) > maximum) throw new Error("Request body exceeds its size limit");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximum) throw new Error("Request body exceeds its size limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

async function parseJsonBody(request, maximum) {
  const bytes = await readBody(request, maximum);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Request body is malformed JSON");
  }
}

function validateHandshake(value) {
  ownKeys(value, ["protocol_version"], "handshake");
  if (value.protocol_version !== PROTOCOL_VERSION) throw new Error("Bridge protocol version is unsupported");
}

function validateCompletion(value) {
  ownKeys(value, ["images", "manifest", "protocol_version"], "completion");
  if (value.protocol_version !== PROTOCOL_VERSION) throw new Error("Bridge protocol version is unsupported");
  Bundle.validateBundle(value.manifest, value.images);
  return { manifest: value.manifest, images: value.images };
}

function validatePreflight(request) {
  const method = request.headers["access-control-request-method"];
  if (method !== "POST") throw new Error("Preflight method is unsupported");
  const rawHeaders = request.headers["access-control-request-headers"] || "";
  const headers = rawHeaders.split(",").map((header) => header.trim().toLowerCase()).filter(Boolean);
  if (headers.some((header) => !["content-type", "x-pi-annotator-token"].includes(header))) {
    throw new Error("Preflight headers are unsupported");
  }
}

function normalizeResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Bridge completion handler returned no result");
  if (result.status === "saved") {
    ownKeys(result, ["relative_path", "status", "warning"], "saved result");
    if (typeof result.relative_path !== "string" || !result.relative_path || pathIsUnsafe(result.relative_path)) throw new Error("Saved path is unsafe");
    if (result.warning !== null && typeof result.warning !== "string") throw new Error("Saved warning is malformed");
    return { statusCode: 200, body: result };
  }
  ownKeys(result, ["message", "status"], "completion result");
  if (!["cancelled", "retryable_error", "terminal_error"].includes(result.status) || typeof result.message !== "string" || !result.message) {
    throw new Error("Bridge completion handler returned an unsupported result");
  }
  const statusCode = result.status === "cancelled" ? 409 : result.status === "retryable_error" ? 503 : 400;
  return { statusCode, body: result };
}

function pathIsUnsafe(value) {
  return value.startsWith("/") || value.includes("\\") || value.split("/").includes("..");
}

async function startBridge(options = {}) {
  const onBundle = options.onBundle;
  if (typeof onBundle !== "function") throw new Error("A bridge completion handler is required");
  const inactivityMs = Number.isInteger(options.inactivityMs) && options.inactivityMs > 0 ? options.inactivityMs : 5 * 60 * 1000;
  let token = null;
  let completionStarted = false;
  let stopped = false;
  let inactivityTimer = null;
  let resolveClosed;
  const closed = new Promise((resolve) => { resolveClosed = resolve; });

  const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin !== ORIGIN) {
      rejectRequest(request, response, 403, "Request origin is not allowed", origin);
      return;
    }
    if (request.url !== "/handshake" && request.url !== "/complete") {
      rejectRequest(request, response, 404, "Bridge endpoint was not found", origin);
      return;
    }
    if (request.method === "OPTIONS") {
      try {
        validatePreflight(request);
        request.resume();
        response.writeHead(204, corsHeaders(origin));
        response.end();
      } catch (error) {
        rejectRequest(request, response, 400, error.message, origin);
      }
      return;
    }
    if (request.method !== "POST") {
      rejectRequest(request, response, 405, "Request method is unsupported", origin);
      return;
    }
    if (!isJsonMediaType(request.headers["content-type"])) {
      rejectRequest(request, response, 415, "Content-Type must be application/json", origin);
      return;
    }

    if (request.url === "/handshake") {
      try {
        validateHandshake(await parseJsonBody(request, 1024));
        if (!token) {
          token = crypto.randomBytes(32).toString("base64url");
          resetInactivity();
        }
        respondJson(response, 200, { protocol_version: PROTOCOL_VERSION, status: "ready", token }, origin);
      } catch (error) {
        respondJson(response, 400, { status: "terminal_error", message: error.message }, origin);
      }
      return;
    }

    if (!token || request.headers["x-pi-annotator-token"] !== token) {
      rejectRequest(request, response, 401, "Bridge token is invalid", origin);
      return;
    }
    if (completionStarted) {
      rejectRequest(request, response, 409, "Completion has already started", origin);
      return;
    }
    completionStarted = true;
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = null;
    try {
      const bundle = validateCompletion(await parseJsonBody(request, MAX_PAYLOAD_BYTES));
      const normalized = normalizeResult(await onBundle(bundle));
      respondJson(response, normalized.statusCode, normalized.body, origin);
    } catch (error) {
      respondJson(response, 400, { status: "terminal_error", message: error.message || String(error) }, origin);
    } finally {
      response.once("finish", () => stop("completion", false));
      response.once("close", () => stop("completion", true));
      if (response.writableFinished || response.destroyed) stop("completion", response.destroyed);
    }
  });

  function resetInactivity() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => stop("timeout", true), inactivityMs);
    if (typeof inactivityTimer.unref === "function") inactivityTimer.unref();
  }

  function stop(reason = "cancelled", force = true) {
    if (stopped) return;
    stopped = true;
    if (inactivityTimer) clearTimeout(inactivityTimer);
    server.close(() => resolveClosed(reason));
    if (force && typeof server.closeAllConnections === "function") server.closeAllConnections();
    if (typeof options.onStop === "function") options.onStop(reason);
  }

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(PORT, HOST);
  }).catch((error) => {
    if (error && error.code === "EADDRINUSE") throw new Error(`Pi annotation bridge could not start because ${HOST}:${PORT} is already in use`);
    throw error;
  });
  resetInactivity();

  return Object.freeze({
    address: `${HOST}:${PORT}`,
    closed,
    stop,
    get tokenIssued() { return token !== null; }
  });
}

module.exports = {
  HOST,
  MAX_PAYLOAD_BYTES,
  ORIGIN,
  PORT,
  PROTOCOL_VERSION,
  isJsonMediaType,
  startBridge,
  validateCompletion,
  validateHandshake
};
