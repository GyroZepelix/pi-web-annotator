"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Filesystem = require("../../browser-extension/lib/filesystem.js");

const valid = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "valid-manifest.json"), "utf8"));
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function notFound() {
  const error = new Error("Not found");
  error.name = "NotFoundError";
  return error;
}

class MemoryFile {
  constructor(name, parent, log, failures) {
    this.kind = "file";
    this.name = name;
    this.parent = parent;
    this.log = log;
    this.failures = failures;
    this.bytes = new Uint8Array();
  }
  get fullPath() { return `${this.parent.fullPath}/${this.name}`.replace(/^\//, ""); }
  async getFile() {
    const bytes = this.bytes;
    return { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  }
  async createWritable() {
    const file = this;
    let pending = null;
    return {
      async write(value) {
        file.log.push(`write:${file.fullPath}`);
        if (file.failures.has(file.fullPath)) throw new Error("mock write failure");
        pending = value instanceof Uint8Array ? value.slice() : new Uint8Array(value);
      },
      async close() {
        file.log.push(`close:${file.fullPath}`);
        file.bytes = pending || new Uint8Array();
      },
      async abort() { file.log.push(`abort:${file.fullPath}`); }
    };
  }
}

class MemoryDirectory {
  constructor(name = "", parent = null, shared = null) {
    this.kind = "directory";
    this.name = name;
    this.parent = parent;
    this.directories = new Map();
    this.files = new Map();
    this.shared = shared || { log: [], failures: new Set() };
  }
  get fullPath() { return this.parent ? `${this.parent.fullPath}/${this.name}`.replace(/^\//, "") : ""; }
  async getDirectoryHandle(name, options = {}) {
    if (this.directories.has(name)) return this.directories.get(name);
    if (!options.create) throw notFound();
    const directory = new MemoryDirectory(name, this, this.shared);
    this.directories.set(name, directory);
    return directory;
  }
  async getFileHandle(name, options = {}) {
    if (this.files.has(name)) return this.files.get(name);
    if (!options.create) throw notFound();
    const file = new MemoryFile(name, this, this.shared.log, this.shared.failures);
    this.files.set(name, file);
    return file;
  }
}

function finishData() {
  return {
    session: { createdAt: valid.capture.created_at, pages: structuredClone(valid.pages) },
    images: {
      "screenshots/annotation-0001.png": png,
      "screenshots/annotation-0002.png": png
    },
    revision: 1
  };
}

async function seedFile(directory, name, bytes) {
  const handle = await directory.getFileHandle(name, { create: true });
  handle.bytes = bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(bytes);
  return handle;
}

test("gitignore merge preserves every existing byte and appends newline-safely", () => {
  const original = new TextEncoder().encode("node_modules/\r\n.env");
  const result = Filesystem.mergeGitignoreBytes(original);
  assert.equal(new TextDecoder().decode(result.bytes), "node_modules/\r\n.env\r\n.pi-annotations/\r\n");
  assert.deepEqual(result.bytes.slice(0, original.length), original);
  assert.equal(Filesystem.mergeGitignoreBytes(result.bytes).changed, false);
});

test("standalone save asks for gitignore, avoids collisions, writes PNGs before manifest", async () => {
  const root = new MemoryDirectory();
  await seedFile(root, ".gitignore", "dist/\n");
  const captures = await root.getDirectoryHandle(".pi-annotations", { create: true });
  await captures.getDirectoryHandle("20260916-175000Z", { create: true });
  const confirmations = [];
  const result = await Filesystem.saveStandalone(root, finishData(), {
    now: new Date("2026-09-16T17:50:00.000Z"),
    confirmGitignore(question) { confirmations.push(question); return true; }
  });
  assert.equal(result.captureId, "20260916-175000Z-01");
  assert.equal(confirmations.length, 1);
  assert.equal(new TextDecoder().decode(root.files.get(".gitignore").bytes), "dist/\n.pi-annotations/\n");
  const writes = root.shared.log.filter((entry) => entry.startsWith("write:.pi-annotations/20260916-175000Z-01"));
  assert.deepEqual(writes.map((entry) => entry.split("/").at(-1)), ["annotation-0001.png", "annotation-0002.png", "annotations.json"]);
  const capture = captures.directories.get(result.captureId);
  assert.ok(capture.files.has("annotations.json"));
  assert.equal(JSON.parse(new TextDecoder().decode(capture.files.get("annotations.json").bytes)).capture.id, result.captureId);
});

test("declining gitignore does not cancel bundle save", async () => {
  const root = new MemoryDirectory();
  const result = await Filesystem.saveStandalone(root, finishData(), {
    now: new Date("2026-09-16T17:50:00.000Z"),
    confirmGitignore() { return false; }
  });
  assert.match(result.warning, /not changed/);
  assert.equal(root.files.has(".gitignore"), false);
  const captures = root.directories.get(".pi-annotations");
  assert.ok(captures.directories.get(result.captureId).files.has("annotations.json"));
});

test("failed PNG write leaves no manifest and permits a suffixed retry", async () => {
  const root = new MemoryDirectory();
  root.shared.failures.add(".pi-annotations/20260916-175000Z/screenshots/annotation-0001.png");
  await assert.rejects(() => Filesystem.saveStandalone(root, finishData(), {
    now: new Date("2026-09-16T17:50:00.000Z"),
    confirmGitignore() { return false; }
  }), /mock write failure/);
  const captures = root.directories.get(".pi-annotations");
  assert.equal(captures.directories.get("20260916-175000Z").files.has("annotations.json"), false);
  root.shared.failures.clear();
  const retried = await Filesystem.saveStandalone(root, finishData(), {
    now: new Date("2026-09-16T17:50:00.000Z"),
    confirmGitignore() { return false; }
  });
  assert.equal(retried.captureId, "20260916-175000Z-01");
});
