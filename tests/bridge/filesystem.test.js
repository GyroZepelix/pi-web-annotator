"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const Filesystem = require("../../extensions/pi-web-annotator/lib/filesystem.js");

const fixturePath = path.join(__dirname, "..", "fixtures", "valid-manifest.json");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const images = {
  "screenshots/annotation-0001.png": png,
  "screenshots/annotation-0002.png": png
};

async function repository(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-web-annotator-test-"));
  try {
    return await run(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function manifest() {
  return JSON.parse(await fs.readFile(fixturePath, "utf8"));
}

test("project destinations reject traversal, existing paths, and symlink escapes before writes", async () => {
  await repository(async (root) => {
    await assert.rejects(() => Filesystem.resolveProjectDestination(root, "../escape"), /inside the current project/);
    const existing = path.join(root, "existing");
    await fs.mkdir(existing);
    await assert.rejects(() => Filesystem.resolveProjectDestination(root, existing), /already exists/);

    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "pi-web-annotator-outside-"));
    try {
      await fs.symlink(outside, path.join(root, "linked"));
      await assert.rejects(() => Filesystem.resolveProjectDestination(root, "linked/capture"), /symbolic link/);
      const outsideIgnore = path.join(outside, ".gitignore");
      await fs.writeFile(outsideIgnore, "outside\n");
      await fs.symlink(outsideIgnore, path.join(root, ".gitignore"));
      await assert.rejects(() => Filesystem.prepareGitignore(root, true), /non-symlink/);
      assert.equal(await fs.readFile(outsideIgnore, "utf8"), "outside\n");
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});

test("capture collisions receive deterministic suffixes and are never overwritten", async () => {
  await repository(async (root) => {
    const original = await manifest();
    await fs.mkdir(path.join(root, ".pi-annotations", original.capture.id), { recursive: true });
    const chosen = await Filesystem.chooseProjectCapture(root, original);
    assert.equal(chosen.captureId, "20260916-175000Z-01");
    assert.equal(chosen.manifest.capture.id, chosen.captureId);
    assert.equal(original.capture.id, "20260916-175000Z");

    await fs.mkdir(chosen.destination, { recursive: true });
    await assert.rejects(
      () => Filesystem.saveAtomic(root, chosen.destination, chosen.manifest, images),
      /already exists/
    );
  });
});

test("gitignore decline warns without writing; acceptance preserves original bytes", async () => {
  await repository(async (root) => {
    const original = Buffer.from("dist/\r\n.env", "utf8");
    await fs.writeFile(path.join(root, ".gitignore"), original);
    const declined = await Filesystem.prepareGitignore(root, false);
    assert.match(declined.warning, /not changed/);
    assert.deepEqual(await fs.readFile(path.join(root, ".gitignore")), original);

    const accepted = await Filesystem.prepareGitignore(root, true);
    assert.equal(accepted.changed, true);
    const updated = await fs.readFile(path.join(root, ".gitignore"));
    assert.deepEqual(updated.subarray(0, original.length), original);
    assert.equal(updated.toString("utf8"), "dist/\r\n.env\r\n.pi-annotations/\r\n");
  });
});

test("atomic save writes images and manifest in a unique sibling before final rename", async () => {
  await repository(async (root) => {
    const value = await manifest();
    const destination = path.join(root, ".pi-annotations", value.capture.id);
    let temporary;
    const saved = await Filesystem.saveAtomic(root, destination, value, images, {
      async beforeManifest(directory) {
        temporary = directory;
        await assert.rejects(() => fs.access(path.join(directory, "annotations.json")));
        await fs.access(path.join(directory, "screenshots", "annotation-0001.png"));
      }
    });
    assert.equal(saved.relativePath, `.pi-annotations/${value.capture.id}/annotations.json`);
    await fs.access(path.join(destination, "annotations.json"));
    await assert.rejects(() => fs.access(temporary));
    assert.deepEqual((await fs.readdir(path.dirname(destination))).sort(), [value.capture.id]);
    assert.equal((await Filesystem.readBundle(destination)).capture.id, value.capture.id);
  });
});

test("failed save removes its temporary sibling and exposes no valid destination", async () => {
  await repository(async (root) => {
    const value = await manifest();
    const destination = path.join(root, ".pi-annotations", value.capture.id);
    await assert.rejects(
      () => Filesystem.saveAtomic(root, destination, value, images, {
        async beforeManifest() { throw new Error("forced write failure"); }
      }),
      /forced write failure/
    );
    await assert.rejects(() => fs.access(destination));
    assert.deepEqual(await fs.readdir(path.dirname(destination)), []);
  });
});

test("latest valid bundle discovery ignores newer incomplete or invalid directories", async () => {
  await repository(async (root) => {
    const value = await manifest();
    const validDestination = path.join(root, ".pi-annotations", value.capture.id);
    await Filesystem.saveAtomic(root, validDestination, value, images);
    await fs.mkdir(path.join(root, ".pi-annotations", "20260916-180000Z"));
    const mismatched = path.join(root, ".pi-annotations", "20260916-185000Z");
    await fs.cp(validDestination, mismatched, { recursive: true });
    const invalid = path.join(root, ".pi-annotations", "20260916-190000Z");
    await fs.mkdir(invalid);
    await fs.writeFile(path.join(invalid, "annotations.json"), "{}\n");
    assert.equal(
      await Filesystem.findLatestValidBundle(root),
      path.join(validDestination, "annotations.json")
    );
  });
});
