"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  MAX_PAYLOAD_BYTES,
  ORIGIN,
  PORT,
  PROTOCOL_VERSION,
  startBridge
} = require("../../extensions/pi-web-annotator/lib/bridge.js");

const valid = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "valid-manifest.json"), "utf8"));
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const images = {
  "screenshots/annotation-0001.png": png,
  "screenshots/annotation-0002.png": png
};
const base = `http://127.0.0.1:${PORT}`;

async function request(endpoint, options = {}) {
  const method = options.method || "POST";
  const response = await fetch(`${base}${endpoint}`, {
    method,
    headers: {
      origin: options.origin === undefined ? ORIGIN : options.origin,
      "content-type": options.contentType || "application/json",
      ...(options.token ? { "x-pi-annotator-token": options.token } : {}),
      ...(options.headers || {})
    },
    body: method === "GET" || method === "HEAD"
      ? undefined
      : options.body === undefined ? JSON.stringify({ protocol_version: PROTOCOL_VERSION }) : options.body
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

async function handshake() {
  const result = await request("/handshake");
  assert.equal(result.response.status, 200);
  assert.deepEqual(Object.keys(result.body).sort(), ["protocol_version", "status", "token"]);
  assert.match(result.body.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(JSON.stringify(result.body).includes("pi-web-annotator"), false);
  return result.body.token;
}

function completionBody(manifest = valid, imageSet = images) {
  return JSON.stringify({ protocol_version: PROTOCOL_VERSION, manifest, images: imageSet });
}

test("bridge enforces origin, method, media type, token, and CORS before accepting one bundle", async () => {
  let accepted = 0;
  const bridge = await startBridge({
    inactivityMs: 10_000,
    async onBundle() {
      accepted += 1;
      return { status: "saved", relative_path: ".pi-annotations/20260916-175000Z/annotations.json", warning: null };
    }
  });
  try {
    assert.equal((await request("/handshake", { origin: "https://evil.example" })).response.status, 403);
    assert.equal((await request("/handshake", { method: "GET", body: undefined })).response.status, 405);
    assert.equal((await request("/handshake", { contentType: "text/plain" })).response.status, 415);

    const preflight = await fetch(`${base}/complete`, {
      method: "OPTIONS",
      headers: {
        origin: ORIGIN,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type, x-pi-annotator-token"
      }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), ORIGIN);

    const token = await handshake();
    assert.equal((await request("/complete", { token: "wrong", body: completionBody() })).response.status, 401);
    const saved = await request("/complete", { token, body: completionBody() });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.body.status, "saved");
    assert.equal(accepted, 1);
    assert.equal(await bridge.closed, "completion");
  } finally {
    bridge.stop("test", true);
  }
});

test("authenticated malformed schema and escaping screenshot paths are terminal before save callback", async () => {
  for (const mutate of [
    (manifest) => { manifest.schema_version = 99; },
    (manifest) => { manifest.pages[0].annotations[0].screenshot.path = "../escape.png"; }
  ]) {
    let accepted = 0;
    const bridge = await startBridge({
      inactivityMs: 10_000,
      async onBundle() { accepted += 1; throw new Error("must not run"); }
    });
    const token = await handshake();
    const manifest = structuredClone(valid);
    mutate(manifest);
    const rejected = await request("/complete", { token, body: completionBody(manifest) });
    assert.equal(rejected.response.status, 400);
    assert.equal(rejected.body.status, "terminal_error");
    assert.equal(accepted, 0);
    await bridge.closed;
  }
});

test("oversized authenticated payload is rejected before save callback", async () => {
  let accepted = 0;
  const bridge = await startBridge({
    inactivityMs: 10_000,
    async onBundle() { accepted += 1; throw new Error("must not run"); }
  });
  const token = await handshake();
  const oversized = `{"padding":"${"x".repeat(MAX_PAYLOAD_BYTES)}"}`;
  const rejected = await request("/complete", { token, body: oversized });
  assert.equal(rejected.response.status, 400);
  assert.match(rejected.body.message, /size limit/);
  assert.equal(accepted, 0);
  await bridge.closed;
});

test("duplicate completion is rejected while the first completion owns the session", async () => {
  let release;
  let entered;
  const enteredPromise = new Promise((resolve) => { entered = resolve; });
  const bridge = await startBridge({
    inactivityMs: 10_000,
    onBundle() {
      entered();
      return new Promise((resolve) => { release = resolve; });
    }
  });
  const token = await handshake();
  const first = request("/complete", { token, body: completionBody() });
  await enteredPromise;
  const duplicate = await request("/complete", { token, body: completionBody() });
  assert.equal(duplicate.response.status, 409);
  release({ status: "saved", relative_path: ".pi-annotations/20260916-175000Z/annotations.json", warning: null });
  assert.equal((await first).response.status, 200);
  await bridge.closed;
});

test("cancelled and retryable save outcomes close the bridge without reporting success", async () => {
  for (const outcome of [
    { status: "cancelled", message: "Save cancelled in Pi" },
    { status: "retryable_error", message: "Save failed without clearing browser state" }
  ]) {
    const bridge = await startBridge({ inactivityMs: 10_000, onBundle: async () => outcome });
    const token = await handshake();
    const result = await request("/complete", { token, body: completionBody() });
    assert.equal(result.response.status, outcome.status === "cancelled" ? 409 : 503);
    assert.deepEqual(result.body, outcome);
    assert.equal(await bridge.closed, "completion");
  }
});

test("bridge timeout and explicit stop release the fixed endpoint", async () => {
  let timeoutReason;
  const timed = await startBridge({
    inactivityMs: 100,
    onBundle: async () => ({ status: "cancelled", message: "cancelled" }),
    onStop(reason) { timeoutReason = reason; }
  });
  await handshake();
  await new Promise((resolve) => setTimeout(resolve, 70));
  await handshake();
  const reason = await Promise.race([
    timed.closed,
    new Promise((_, reject) => setTimeout(() => reject(new Error("repeated status handshake postponed bridge timeout")), 60))
  ]);
  assert.equal(reason, "timeout");
  assert.equal(timeoutReason, "timeout");

  const replacement = await startBridge({ inactivityMs: 10_000, onBundle: async () => ({ status: "cancelled", message: "cancelled" }) });
  replacement.stop("shutdown", true);
  assert.equal(await replacement.closed, "shutdown");
});

test("a second bridge fails clearly when the fixed endpoint is occupied", async () => {
  const bridge = await startBridge({ inactivityMs: 10_000, onBundle: async () => ({ status: "cancelled", message: "cancelled" }) });
  try {
    await assert.rejects(
      () => startBridge({ inactivityMs: 10_000, onBundle: async () => ({ status: "cancelled", message: "cancelled" }) }),
      /already in use/
    );
  } finally {
    bridge.stop("test", true);
    await bridge.closed;
  }
});
