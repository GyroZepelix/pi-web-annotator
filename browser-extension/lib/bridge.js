(function (root, factory) {
  const constants = root.PiAnnotatorConstants || (typeof require === "function" ? require("./constants.js") : null);
  const bundle = root.PiAnnotatorBundle || (typeof require === "function" ? require("./bundle.js") : null);
  const api = factory(constants, bundle);
  root.PiAnnotatorBridge = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants, bundle) {
  "use strict";

  if (!constants || !bundle) throw new Error("Annotator constants and bundle helpers are required");
  const TOKEN = /^[A-Za-z0-9_-]{43}$/;
  const RELATIVE_MANIFEST = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?:[^/]+\/)*annotations\.json$/;

  function ownKeys(value, expected, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
    const actual = Object.keys(value).sort();
    const wanted = [...expected].sort();
    if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
      throw new Error(`${label} has unsupported or missing fields`);
    }
  }

  async function readJson(response, label) {
    const contentType = response.headers && response.headers.get ? response.headers.get("content-type") : null;
    if (!contentType || contentType.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      throw new Error(`${label} returned an unsupported media type`);
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`${label} returned malformed JSON`);
    }
  }

  async function handshake(fetchImpl) {
    const request = typeof fetchImpl === "function" ? fetchImpl : fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    let response;
    try {
      response = await request(`${constants.BRIDGE_URL}handshake`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ protocol_version: constants.BRIDGE_PROTOCOL_VERSION }),
        cache: "no-store",
        signal: controller.signal
      });
    } catch (error) {
      throw new Error(`Pi bridge is unavailable: ${error.message}`);
    } finally {
      clearTimeout(timeout);
    }
    const body = await readJson(response, "Pi bridge handshake");
    ownKeys(body, ["protocol_version", "status", "token"], "Pi bridge handshake");
    if (!response.ok || body.protocol_version !== constants.BRIDGE_PROTOCOL_VERSION || body.status !== "ready" || !TOKEN.test(body.token)) {
      throw new Error("Pi bridge handshake was rejected");
    }
    return { token: body.token };
  }

  function requestBody(manifest, images) {
    bundle.validateBundle(manifest, images);
    const body = JSON.stringify({
      protocol_version: constants.BRIDGE_PROTOCOL_VERSION,
      manifest,
      images
    });
    const bytes = new TextEncoder().encode(body).length;
    if (bytes > constants.LIMITS.bridgePayloadBytes) throw new Error("Bridge payload exceeds its transfer limit");
    return body;
  }

  function validateResult(response, body) {
    if (body.status === "saved") {
      ownKeys(body, ["relative_path", "status", "warning"], "Pi bridge result");
      if (!response.ok || typeof body.relative_path !== "string" || !RELATIVE_MANIFEST.test(body.relative_path)) {
        throw new Error("Pi bridge returned an unsafe saved path");
      }
      if (body.warning !== null && typeof body.warning !== "string") throw new Error("Pi bridge warning is malformed");
      return body;
    }
    ownKeys(body, ["message", "status"], "Pi bridge result");
    if (!["cancelled", "retryable_error", "terminal_error"].includes(body.status) || typeof body.message !== "string" || !body.message) {
      throw new Error("Pi bridge returned an unsupported result");
    }
    return body;
  }

  async function complete(fetchImpl, token, manifest, images) {
    if (!TOKEN.test(token)) throw new Error("Pi bridge token is unavailable");
    const request = typeof fetchImpl === "function" ? fetchImpl : fetch;
    const body = requestBody(manifest, images);
    let response;
    try {
      response = await request(`${constants.BRIDGE_URL}complete`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-pi-annotator-token": token
        },
        body,
        cache: "no-store"
      });
    } catch (error) {
      throw new Error(`Pi bridge transfer failed: ${error.message}`);
    }
    return validateResult(response, await readJson(response, "Pi bridge completion"));
  }

  return Object.freeze({ complete, handshake, requestBody, validateResult });
});
