"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..", "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "browser-extension", "manifest.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const { LIMITS } = require("../../browser-extension/lib/constants.js");

const EXPECTED_KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyIydPK7L6z8PhldiOJlThW8BBu+DO0FgxR73TGEqTiwe/2zBTeESvBjidQWGbxNdIc3McKx9ziU7qd/GTVvuTvH2ZsqByFnsgW75P21UQI1KYGszIkJw/Lb0kiL+sb0yHYkwUjo6BJ6gKx2V7XvdDJ8+5ewqby7tsWD8lbDu7Vnpx49JDVfY5w7tryRnMwNpOHkaAWIDJIPeYQqVeUNvLJtEGs6BM18WohFqRYbU3b4RoSu7vveYesrRRRz69IgAaKQUPQhFGzLfjNMs70/gcMdregkc2jGTFzbYB4Z+RztlUTFuGdHl12ysUr19K0DzKzEJ1g6PXfh7RWMRSVUfswIDAQAB";
const ICON_MAP = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png"
};

function extensionId(key) {
  return [...crypto.createHash("sha256").update(Buffer.from(key, "base64")).digest().subarray(0, 16)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .replace(/[0-9a-f]/g, (digit) => "abcdefghijklmnop"[Number.parseInt(digit, 16)]);
}

test("manifest has only the approved least-privilege permissions", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, "116");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "sidePanel", "storage"]);
  assert.deepEqual(manifest.host_permissions, ["http://127.0.0.1:43127/*"]);
  assert.equal(manifest.content_scripts, undefined);
});

test("checked-in public key provides a deterministic extension ID", () => {
  assert.equal(manifest.key, EXPECTED_KEY);
  assert.equal(extensionId(manifest.key), "kemcbalaoccidjnoggajcgjhjlpibbkg");
});

test("manifest maps every extension and action icon to checked-in PNG assets", () => {
  assert.deepEqual(manifest.icons, ICON_MAP);
  assert.deepEqual(manifest.action.default_icon, ICON_MAP);

  const expectedDimensions = new Map([
    ["icon-source.png", 1024],
    ["icon-16.png", 16],
    ["icon-32.png", 32],
    ["icon-48.png", 48],
    ["icon-128.png", 128]
  ]);
  for (const [name, size] of expectedDimensions) {
    const bytes = fs.readFileSync(path.join(root, "browser-extension", "icons", name));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${name} PNG signature`);
    assert.equal(bytes.subarray(12, 16).toString("ascii"), "IHDR", `${name} first chunk`);
    assert.equal(bytes.readUInt32BE(16), size, `${name} width`);
    assert.equal(bytes.readUInt32BE(20), size, `${name} height`);
  }
});

test("package and JSON fixtures parse without third-party runtime or test dependencies", () => {
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);
  assert.deepEqual(packageJson.peerDependencies, { "@earendil-works/pi-coding-agent": "*" });
  assert.deepEqual(packageJson.pi.extensions, ["./extensions/pi-web-annotator/index.ts"]);
  assert.ok(packageJson.keywords.includes("pi-package"));
  for (const name of ["valid-manifest.json", "rejected-cases.json"]) {
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", name), "utf8")));
  }
});

test("package dry run includes runtime and icon assets while excluding project evidence", () => {
  const packed = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(packed.status, 0, packed.stderr);
  const files = new Set(JSON.parse(packed.stdout)[0].files.map((entry) => entry.path));
  for (const required of [
    "README.md",
    "package.json",
    "extensions/pi-web-annotator/index.ts",
    "browser-extension/manifest.json",
    "browser-extension/icons/icon-source.png",
    ...Object.values(ICON_MAP).map((icon) => `browser-extension/${icon}`)
  ]) {
    assert.ok(files.has(required), `package should include ${required}`);
  }
  for (const forbiddenPrefix of ["spec/", "wiki/", "tests/", ".pi-annotations/"]) {
    assert.equal([...files].some((file) => file.startsWith(forbiddenPrefix)), false, `package should exclude ${forbiddenPrefix}`);
  }
});

test("bundle limits leave measured headroom under the supported session-storage quota", () => {
  const worstCaseBase64Expansion = Math.ceil(LIMITS.totalImageBytes / 3);
  assert.ok(LIMITS.bundleBytes + worstCaseBase64Expansion < LIMITS.sessionStorageBudgetBytes);
  assert.ok(LIMITS.sessionStorageBudgetBytes < 10 * 1024 * 1024);
});

test("service worker uses the action event and not automatic panel behavior", () => {
  const source = fs.readFileSync(path.join(root, "browser-extension", "service-worker.js"), "utf8");
  assert.match(source, /chrome\.action\.onClicked\.addListener/);
  assert.match(source, /chrome\.sidePanel\.open\(\{ windowId: tab\.windowId \}\)/);
  assert.doesNotMatch(source, /openPanelOnActionClick|setPanelBehavior/);
});

test("standalone Finish invokes the picker before its first await", () => {
  const source = fs.readFileSync(path.join(root, "browser-extension", "sidepanel.js"), "utf8");
  const standalone = source.slice(source.indexOf("async function finishStandalone"), source.indexOf("async function finishBridge"));
  const picker = standalone.indexOf('window.showDirectoryPicker({ mode: "readwrite" })');
  const firstAwait = standalone.indexOf("await ");
  assert.ok(picker > 0, "picker call must exist in standalone Finish path");
  assert.ok(firstAwait > picker, "picker must be called synchronously before awaiting");
});
