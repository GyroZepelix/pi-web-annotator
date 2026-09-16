"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Bundle = require("../../browser-extension/lib/bundle.js");

const fixtureDirectory = path.join(__dirname, "..", "fixtures");
const valid = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, "valid-manifest.json"), "utf8"));
const rejectedCases = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, "rejected-cases.json"), "utf8"));
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function images() {
  return {
    "screenshots/annotation-0001.png": png,
    "screenshots/annotation-0002.png": png
  };
}

function setAtPath(object, parts, value) {
  let target = object;
  for (const part of parts.slice(0, -1)) target = target[part];
  target[parts.at(-1)] = value;
}

test("valid multi-page schema-v1 fixture and its complete PNG set pass", () => {
  assert.equal(Bundle.validateManifest(valid), true);
  assert.equal(Bundle.validateBundle(valid, images()), true);
});

for (const fixture of rejectedCases) {
  test(`rejected fixture: ${fixture.name}`, () => {
    const manifest = structuredClone(valid);
    const imageSet = images();
    if (fixture.operation === "set" || fixture.operation === "add") setAtPath(manifest, fixture.path, fixture.value);
    if (fixture.operation === "remove_image") delete imageSet[fixture.path];
    if (fixture.operation === "add_image") imageSet[fixture.path] = png;
    assert.throws(() => Bundle.validateBundle(manifest, imageSet));
  });
}

test("capture IDs are sortable UTC names with deterministic collision suffixes", () => {
  const base = Bundle.baseCaptureId(new Date("2026-09-16T17:50:00.123Z"));
  assert.equal(base, "20260916-175000Z");
  assert.deepEqual([0, 1, 12].map((collision) => Bundle.captureIdCandidate(base, collision)), [
    "20260916-175000Z", "20260916-175000Z-01", "20260916-175000Z-12"
  ]);
});

test("manifest construction filters empty pages and preserves page and annotation order", () => {
  const session = {
    createdAt: valid.capture.created_at,
    pages: [
      { id: "page-0099", url: "https://empty.example/", title: "Empty", annotations: [] },
      ...structuredClone(valid.pages)
    ]
  };
  const manifest = Bundle.createManifest(session, valid.capture.id, valid.capture.completed_at);
  assert.deepEqual(manifest.pages.map((page) => page.id), ["page-0001", "page-0002"]);
  assert.deepEqual(manifest.pages.flatMap((page) => page.annotations.map((annotation) => annotation.id)), ["annotation-0001", "annotation-0002"]);
});

test("annotation, total-image, and total-bundle limits are enforced", () => {
  const tooMany = structuredClone(valid);
  tooMany.pages = [{ ...tooMany.pages[0], annotations: [] }];
  for (let index = 1; index <= 101; index += 1) {
    const annotation = structuredClone(valid.pages[0].annotations[0]);
    annotation.id = `annotation-${String(index).padStart(4, "0")}`;
    annotation.screenshot.path = `screenshots/${annotation.id}.png`;
    tooMany.pages[0].annotations.push(annotation);
  }
  assert.throws(() => Bundle.validateManifest(tooMany), /annotation count/);

  const tooManyImageBytes = structuredClone(valid);
  tooManyImageBytes.pages = [{ ...tooManyImageBytes.pages[0], annotations: [] }];
  const largeImages = {};
  for (let index = 1; index <= 3; index += 1) {
    const annotation = structuredClone(valid.pages[0].annotations[0]);
    annotation.id = `annotation-${String(index).padStart(4, "0")}`;
    annotation.screenshot.path = `screenshots/${annotation.id}.png`;
    annotation.screenshot.bytes = 2_000_000;
    tooManyImageBytes.pages[0].annotations.push(annotation);
    const image = new Uint8Array(2_000_000);
    image.set([137, 80, 78, 71, 13, 10, 26, 10]);
    largeImages[annotation.screenshot.path] = image;
  }
  assert.throws(() => Bundle.validateBundle(tooManyImageBytes, largeImages), /total image bytes/);

  const tooLargeBundle = structuredClone(valid);
  tooLargeBundle.pages = [{ ...tooLargeBundle.pages[0], annotations: [] }];
  const boundedImages = {};
  for (let index = 1; index <= 100; index += 1) {
    const annotation = structuredClone(valid.pages[0].annotations[0]);
    annotation.id = `annotation-${String(index).padStart(4, "0")}`;
    annotation.comment = "c".repeat(4000);
    annotation.target.css = { value: "a".repeat(2000), truncated: true };
    annotation.target.xpath = { value: "x".repeat(2000), truncated: true };
    annotation.target.visible_text = { value: "v".repeat(2000), truncated: true };
    annotation.target.outer_html = { value: `<div>${"o".repeat(15989)}</div>`, truncated: true };
    annotation.target.attributes = { items: {}, truncated: true };
    for (let attribute = 0; attribute < 32; attribute += 1) {
      annotation.target.attributes.items[`aria-label${attribute}`] = { value: "a".repeat(500), truncated: true };
    }
    annotation.screenshot.path = `screenshots/${annotation.id}.png`;
    annotation.screenshot.bytes = 30_000;
    tooLargeBundle.pages[0].annotations.push(annotation);
    const image = new Uint8Array(30_000);
    image.set([137, 80, 78, 71, 13, 10, 26, 10]);
    boundedImages[annotation.screenshot.path] = image;
  }
  assert.throws(() => Bundle.validateBundle(tooLargeBundle, boundedImages), /bundle exceeds/);
});

test("PNG data URLs are decoded and non-PNG data is rejected", () => {
  assert.equal(Bundle.bytesFromImage(png, "image").length, 68);
  assert.throws(() => Bundle.bytesFromImage("data:text/plain;base64,SGk=", "image"));
  const badImages = images();
  badImages["screenshots/annotation-0001.png"] = `data:image/png;base64,${Buffer.alloc(68).toString("base64")}`;
  assert.throws(() => Bundle.validateBundle(valid, badImages), /not PNG/);
});
