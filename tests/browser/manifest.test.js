"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "browser-extension", "manifest.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const { LIMITS } = require("../../browser-extension/lib/constants.js");

function extensionId(key) {
  return [...crypto.createHash("sha256").update(Buffer.from(key, "base64")).digest().subarray(0, 16)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .replace(/[0-9a-f]/g, (digit) => "abcdefghijklmnop"[Number.parseInt(digit, 16)]);
}

test("manifest has only the approved least-privilege permissions", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, "114");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "sidePanel", "storage"]);
  assert.deepEqual(manifest.host_permissions, ["http://127.0.0.1:43127/*"]);
  assert.equal(manifest.content_scripts, undefined);
});

test("checked-in public key provides a deterministic extension ID", () => {
  assert.equal(extensionId(manifest.key), "kemcbalaoccidjnoggajcgjhjlpibbkg");
});

test("package and JSON fixtures parse without runtime or test dependencies", () => {
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);
  assert.equal(packageJson.peerDependencies, undefined);
  for (const name of ["valid-manifest.json", "rejected-cases.json"]) {
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", name), "utf8")));
  }
});

test("bundle limits leave measured headroom under Chrome 114 session-storage quota", () => {
  const worstCaseBase64Expansion = Math.ceil(LIMITS.totalImageBytes / 3);
  assert.ok(LIMITS.bundleBytes + worstCaseBase64Expansion < LIMITS.sessionStorageBudgetBytes);
  assert.ok(LIMITS.sessionStorageBudgetBytes < 10 * 1024 * 1024);
});

test("side-panel Finish invokes the picker before its first await", () => {
  const source = fs.readFileSync(path.join(root, "browser-extension", "sidepanel.js"), "utf8");
  const handler = source.slice(source.indexOf('elements.finish.addEventListener'), source.indexOf('chrome.runtime.onMessage.addListener'));
  const picker = handler.indexOf('window.showDirectoryPicker({ mode: "readwrite" })');
  const firstAwait = handler.indexOf("await ");
  assert.ok(picker > 0, "picker call must exist in Finish handler");
  assert.ok(firstAwait > picker, "picker must be called synchronously before awaiting");
});
