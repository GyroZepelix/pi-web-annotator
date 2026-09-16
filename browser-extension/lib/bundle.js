(function (root, factory) {
  const constants = root.PiAnnotatorConstants || (typeof require === "function" ? require("./constants.js") : null);
  const api = factory(constants);
  root.PiAnnotatorBundle = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants) {
  "use strict";

  if (!constants) throw new Error("PiAnnotatorConstants is required");
  const { LIMITS, GENERATOR_NAME, GENERATOR_VERSION } = constants;
  const CAPTURE_ID = /^\d{8}-\d{6}Z(?:-\d{2,})?$/;
  const PAGE_ID = /^page-\d{4,}$/;
  const ANNOTATION_ID = /^annotation-\d{4,}$/;
  const PNG_PATH = /^screenshots\/(annotation-\d{4,})\.png$/;
  const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
  const TARGET_KEYS = ["css", "xpath", "tag_name", "visible_text", "attributes", "outer_html", "bounding_rect", "scroll", "viewport", "device_pixel_ratio"];

  function ownKeys(value, expected, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
    const actual = Object.keys(value).sort();
    const wanted = [...expected].sort();
    if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
      throw new Error(`${label} has unsupported or missing fields`);
    }
  }

  function nonEmptyString(value, label, maximum) {
    if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
    if ([...value].length > maximum) throw new Error(`${label} exceeds its limit`);
  }

  function finiteNumber(value, label, minimum) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) throw new Error(`${label} must be a finite number >= ${minimum}`);
  }

  function validTimestamp(value, label) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw new Error(`${label} must be a UTC ISO timestamp`);
    const date = new Date(value);
    if (!Number.isFinite(date.valueOf()) || date.toISOString() !== value) throw new Error(`${label} is malformed`);
  }

  function validateBoundedString(value, label, maximum) {
    ownKeys(value, ["value", "truncated"], label);
    if (typeof value.value !== "string" || typeof value.truncated !== "boolean") throw new Error(`${label} is malformed`);
    if ([...value.value].length > maximum) throw new Error(`${label}.value exceeds its limit`);
  }

  function validateTarget(target, label) {
    ownKeys(target, TARGET_KEYS, label);
    validateBoundedString(target.css, `${label}.css`, LIMITS.selectorCharacters);
    validateBoundedString(target.xpath, `${label}.xpath`, LIMITS.selectorCharacters);
    if (!/^[a-z][a-z0-9-]*$/.test(target.tag_name)) throw new Error(`${label}.tag_name is malformed`);
    validateBoundedString(target.visible_text, `${label}.visible_text`, LIMITS.visibleTextCharacters);
    validateBoundedString(target.outer_html, `${label}.outer_html`, LIMITS.outerHtmlCharacters);
    const outerTags = target.outer_html.value.match(/<[^>]*>/g) || [];
    if (outerTags.some((tag) => /^<\/?(?:script|style|noscript|template)\b/i.test(tag)
      || /\s(?:on[a-z0-9_.:-]*|value|checked|selected|style|srcdoc|nonce|href|src|action|formaction)\s*=/i.test(tag))) {
      throw new Error(`${label}.outer_html contains unsafe page data`);
    }

    ownKeys(target.attributes, ["items", "truncated"], `${label}.attributes`);
    if (typeof target.attributes.truncated !== "boolean") throw new Error(`${label}.attributes.truncated must be boolean`);
    if (!target.attributes.items || typeof target.attributes.items !== "object" || Array.isArray(target.attributes.items)) throw new Error(`${label}.attributes.items must be an object`);
    const attributes = Object.entries(target.attributes.items);
    if (attributes.length > LIMITS.attributeCount) throw new Error(`${label}.attributes exceeds its limit`);
    for (const [name, bounded] of attributes) {
      if (!/^[a-z][a-z0-9_.:-]*$/.test(name) || /^on/i.test(name) || ["value", "checked", "selected", "style", "srcdoc"].includes(name)) {
        throw new Error(`${label}.attributes contains an unsafe name`);
      }
      validateBoundedString(bounded, `${label}.attributes.${name}`, LIMITS.attributeValueCharacters);
    }

    ownKeys(target.bounding_rect, ["bottom", "height", "left", "right", "top", "width", "x", "y"], `${label}.bounding_rect`);
    for (const [name, number] of Object.entries(target.bounding_rect)) finiteNumber(number, `${label}.bounding_rect.${name}`, name === "width" || name === "height" ? 0 : -Number.MAX_VALUE);
    ownKeys(target.scroll, ["x", "y"], `${label}.scroll`);
    finiteNumber(target.scroll.x, `${label}.scroll.x`, 0);
    finiteNumber(target.scroll.y, `${label}.scroll.y`, 0);
    ownKeys(target.viewport, ["height", "width"], `${label}.viewport`);
    finiteNumber(target.viewport.width, `${label}.viewport.width`, 1);
    finiteNumber(target.viewport.height, `${label}.viewport.height`, 1);
    finiteNumber(target.device_pixel_ratio, `${label}.device_pixel_ratio`, 0.1);
  }

  function validateManifest(manifest) {
    ownKeys(manifest, ["capture", "generator", "pages", "schema_version"], "manifest");
    if (manifest.schema_version !== 1) throw new Error("schema_version must be 1");
    ownKeys(manifest.capture, ["completed_at", "created_at", "id"], "capture");
    if (!CAPTURE_ID.test(manifest.capture.id)) throw new Error("capture.id is malformed");
    validTimestamp(manifest.capture.created_at, "capture.created_at");
    validTimestamp(manifest.capture.completed_at, "capture.completed_at");
    if (manifest.capture.completed_at < manifest.capture.created_at) throw new Error("capture timestamps are out of order");
    ownKeys(manifest.generator, ["name", "version"], "generator");
    if (manifest.generator.name !== GENERATOR_NAME || manifest.generator.version !== GENERATOR_VERSION) throw new Error("generator is unsupported");
    if (!Array.isArray(manifest.pages) || manifest.pages.length === 0) throw new Error("pages must be a non-empty array");

    const pageIds = new Set();
    const annotationIds = new Set();
    let annotationCount = 0;
    for (const [pageIndex, page] of manifest.pages.entries()) {
      const label = `pages[${pageIndex}]`;
      ownKeys(page, ["annotations", "id", "title", "url"], label);
      if (!PAGE_ID.test(page.id) || pageIds.has(page.id)) throw new Error(`${label}.id is malformed or duplicate`);
      pageIds.add(page.id);
      nonEmptyString(page.url, `${label}.url`, 10000);
      let parsedUrl;
      try { parsedUrl = new URL(page.url); } catch { throw new Error(`${label}.url is malformed`); }
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error(`${label}.url has an unsupported protocol`);
      if (typeof page.title !== "string" || page.title.length > 2000) throw new Error(`${label}.title is malformed`);
      if (!Array.isArray(page.annotations) || page.annotations.length === 0) throw new Error(`${label}.annotations must be non-empty`);

      for (const [annotationIndex, annotation] of page.annotations.entries()) {
        const annotationLabel = `${label}.annotations[${annotationIndex}]`;
        ownKeys(annotation, ["comment", "created_at", "id", "screenshot", "target", "updated_at"], annotationLabel);
        if (!ANNOTATION_ID.test(annotation.id) || annotationIds.has(annotation.id)) throw new Error(`${annotationLabel}.id is malformed or duplicate`);
        annotationIds.add(annotation.id);
        annotationCount += 1;
        if (annotationCount > LIMITS.annotations) throw new Error("annotation count exceeds its limit");
        nonEmptyString(annotation.comment, `${annotationLabel}.comment`, LIMITS.commentCharacters);
        if (annotation.comment.trim().length === 0) throw new Error(`${annotationLabel}.comment must not be whitespace only`);
        validTimestamp(annotation.created_at, `${annotationLabel}.created_at`);
        validTimestamp(annotation.updated_at, `${annotationLabel}.updated_at`);
        if (annotation.updated_at < annotation.created_at) throw new Error(`${annotationLabel} timestamps are out of order`);
        validateTarget(annotation.target, `${annotationLabel}.target`);
        ownKeys(annotation.screenshot, ["bytes", "media_type", "path"], `${annotationLabel}.screenshot`);
        const match = PNG_PATH.exec(annotation.screenshot.path);
        if (!match || match[1] !== annotation.id || annotation.screenshot.path.includes("..") || annotation.screenshot.path.startsWith("/")) throw new Error(`${annotationLabel}.screenshot.path is unsafe`);
        if (annotation.screenshot.media_type !== "image/png") throw new Error(`${annotationLabel}.screenshot.media_type must be image/png`);
        if (!Number.isInteger(annotation.screenshot.bytes) || annotation.screenshot.bytes <= 0 || annotation.screenshot.bytes > LIMITS.imageBytes) throw new Error(`${annotationLabel}.screenshot.bytes is invalid`);
      }
    }
    return true;
  }

  function bytesFromImage(image, label) {
    if (image instanceof Uint8Array) return image;
    if (image instanceof ArrayBuffer) return new Uint8Array(image);
    if (typeof image === "string") {
      const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
      if (!match) throw new Error(`${label} is not a PNG data URL`);
      if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(match[1], "base64"));
      const decoded = atob(match[1]);
      return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    }
    throw new Error(`${label} is not binary image data`);
  }

  function validateBundle(manifest, images) {
    validateManifest(manifest);
    if (!images || typeof images !== "object" || Array.isArray(images)) throw new Error("images must be a path-keyed object");
    const expected = new Map();
    for (const page of manifest.pages) for (const annotation of page.annotations) expected.set(annotation.screenshot.path, annotation.screenshot.bytes);
    const actualPaths = Object.keys(images);
    if (actualPaths.length !== expected.size) throw new Error("image set does not match the manifest");
    let totalBytes = 0;
    for (const [path, declaredBytes] of expected) {
      if (!Object.prototype.hasOwnProperty.call(images, path)) throw new Error(`missing image: ${path}`);
      const bytes = bytesFromImage(images[path], path);
      if (bytes.length !== declaredBytes) throw new Error(`image byte count mismatch: ${path}`);
      if (bytes.length < PNG_SIGNATURE.length || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) throw new Error(`image is not PNG data: ${path}`);
      totalBytes += bytes.length;
    }
    if (totalBytes > LIMITS.totalImageBytes) throw new Error("total image bytes exceed the limit");
    const jsonBytes = new TextEncoder().encode(JSON.stringify(manifest)).length;
    if (jsonBytes + totalBytes > LIMITS.bundleBytes) throw new Error("bundle exceeds the total payload limit");
    return true;
  }

  function baseCaptureId(date) {
    if (!(date instanceof Date) || !Number.isFinite(date.valueOf())) throw new Error("capture date is invalid");
    return date.toISOString().replace(/[-:]/g, "").replace("T", "-").replace(/\.\d{3}Z$/, "Z");
  }

  function captureIdCandidate(base, collision) {
    if (!/^\d{8}-\d{6}Z$/.test(base) || !Number.isInteger(collision) || collision < 0) throw new Error("capture collision input is invalid");
    return collision === 0 ? base : `${base}-${String(collision).padStart(2, "0")}`;
  }

  function createManifest(session, captureId, completedAt) {
    if (!session || !Array.isArray(session.pages)) throw new Error("session is malformed");
    const pages = session.pages
      .filter((page) => Array.isArray(page.annotations) && page.annotations.length > 0)
      .map((page) => ({
        id: page.id,
        url: page.url,
        title: page.title,
        annotations: page.annotations.map((annotation) => ({
          id: annotation.id,
          comment: annotation.comment,
          created_at: annotation.created_at,
          updated_at: annotation.updated_at,
          target: annotation.target,
          screenshot: annotation.screenshot
        }))
      }));
    const manifest = {
      schema_version: 1,
      capture: { id: captureId, created_at: session.createdAt, completed_at: completedAt },
      generator: { name: GENERATOR_NAME, version: GENERATOR_VERSION },
      pages
    };
    validateManifest(manifest);
    return manifest;
  }

  return Object.freeze({
    baseCaptureId,
    bytesFromImage,
    captureIdCandidate,
    createManifest,
    validateBundle,
    validateManifest,
    validateTarget
  });
});
