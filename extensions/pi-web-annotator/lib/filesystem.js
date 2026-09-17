"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const Bundle = require("../../../browser-extension/lib/bundle.js");

const IGNORE_ENTRY = ".pi-annotations/";
const CAPTURE_DIRECTORY = /^\d{8}-\d{6}Z(?:-\d{2,})?$/;

function hasIgnoreEntry(bytes) {
  return Buffer.from(bytes).toString("utf8").split(/\r?\n/).some((line) => line.trim() === IGNORE_ENTRY);
}

function mergeGitignoreBytes(existing) {
  const bytes = Buffer.from(existing || []);
  if (hasIgnoreEntry(bytes)) return { bytes, changed: false };
  const text = bytes.toString("utf8");
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const endsWithNewline = bytes.length > 0 && (bytes.at(-1) === 10 || bytes.at(-1) === 13);
  const addition = `${bytes.length === 0 || endsWithNewline ? "" : newline}${IGNORE_ENTRY}${newline}`;
  return { bytes: Buffer.concat([bytes, Buffer.from(addition, "utf8")]), changed: true };
}

async function exists(target) {
  try {
    await fs.lstat(target);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function nearestExisting(target) {
  let candidate = target;
  while (!(await exists(candidate))) {
    const parent = path.dirname(candidate);
    if (parent === candidate) throw new Error("Destination has no existing ancestor");
    candidate = parent;
  }
  return candidate;
}

async function resolveProjectDestination(projectRoot, input) {
  if (typeof input !== "string" || !input.trim() || input.includes("\0")) throw new Error("Destination is required");
  const suppliedRoot = path.resolve(projectRoot);
  const root = await fs.realpath(suppliedRoot);
  const suppliedDestination = path.resolve(suppliedRoot, input.trim());
  if (!isWithin(suppliedRoot, suppliedDestination)) throw new Error("Destination must remain inside the current project");
  const destination = path.resolve(root, path.relative(suppliedRoot, suppliedDestination));
  const existingAncestor = await nearestExisting(path.dirname(destination));
  const realAncestor = await fs.realpath(existingAncestor);
  if (realAncestor !== root && !isWithin(root, realAncestor)) throw new Error("Destination escapes the project through a symbolic link");
  if (await exists(destination)) throw new Error("Destination already exists; choose a new directory");
  return { projectRoot: root, destination };
}

async function readGitignore(projectRoot) {
  const ignorePath = path.join(projectRoot, ".gitignore");
  try {
    const stats = await fs.lstat(ignorePath);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("Project .gitignore must be a regular non-symlink file");
    return { exists: true, bytes: await fs.readFile(ignorePath) };
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
    return { exists: false, bytes: Buffer.alloc(0) };
  }
}

async function inspectGitignore(projectRoot) {
  const current = await readGitignore(projectRoot);
  return { exists: current.exists, hasEntry: hasIgnoreEntry(current.bytes) };
}

async function prepareGitignore(projectRoot, accepted) {
  const ignorePath = path.join(projectRoot, ".gitignore");
  const current = await readGitignore(projectRoot);
  const merged = mergeGitignoreBytes(current.bytes);
  if (!merged.changed) return { changed: false, warning: null };
  if (!accepted) {
    return { changed: false, warning: ".gitignore was not changed; the bundle may appear as untracked files." };
  }
  await fs.writeFile(ignorePath, merged.bytes, { flag: current.exists ? "w" : "wx", mode: 0o644 });
  return { changed: true, warning: null };
}

function destinationUsesProjectCaptureRoot(projectRoot, destination) {
  const captures = path.join(projectRoot, ".pi-annotations");
  return path.dirname(destination) === captures;
}

async function writeExclusive(file, bytes) {
  const handle = await fs.open(file, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
}

function validateBundle(manifest, images) {
  return Bundle.validateBundle(manifest, images);
}

async function saveAtomic(projectRoot, destinationInput, manifest, images, options = {}) {
  validateBundle(manifest, images);
  const resolved = await resolveProjectDestination(projectRoot, destinationInput);
  const destination = resolved.destination;
  const parent = path.dirname(destination);
  await fs.mkdir(parent, { recursive: true });
  if (await exists(destination)) throw new Error("Destination already exists; refusing to overwrite it");

  const temporary = await fs.mkdtemp(path.join(parent, `.${path.basename(destination)}.tmp-`));
  let renamed = false;
  try {
    const screenshots = path.join(temporary, "screenshots");
    await fs.mkdir(screenshots, { mode: 0o700 });
    for (const page of manifest.pages) {
      for (const annotation of page.annotations) {
        const bytes = Bundle.bytesFromImage(images[annotation.screenshot.path], annotation.screenshot.path);
        await writeExclusive(path.join(screenshots, `${annotation.id}.png`), bytes);
      }
    }
    if (typeof options.beforeManifest === "function") await options.beforeManifest(temporary);
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await writeExclusive(path.join(temporary, "annotations.json"), manifestBytes);
    if (await exists(destination)) throw new Error("Destination appeared during save; refusing to overwrite it");
    await fs.rename(temporary, destination);
    renamed = true;
  } finally {
    if (!renamed) await fs.rm(temporary, { recursive: true, force: true }).catch(() => {});
  }

  const relative = path.relative(resolved.projectRoot, path.join(destination, "annotations.json")).split(path.sep).join("/");
  return { destination, relativePath: relative };
}

async function chooseProjectCapture(projectRoot, manifest) {
  Bundle.validateManifest(manifest);
  const match = /^(\d{8}-\d{6}Z)(?:-\d{2,})?$/.exec(manifest.capture.id);
  if (!match) throw new Error("Capture ID is malformed");
  for (let collision = 0; collision < 10000; collision += 1) {
    const captureId = Bundle.captureIdCandidate(match[1], collision);
    const destination = path.join(projectRoot, ".pi-annotations", captureId);
    if (!(await exists(destination))) {
      const adjustedManifest = JSON.parse(JSON.stringify(manifest));
      adjustedManifest.capture.id = captureId;
      Bundle.validateManifest(adjustedManifest);
      return { captureId, destination, manifest: adjustedManifest };
    }
  }
  throw new Error("No unused capture directory name is available");
}

async function readBundle(directory) {
  const manifest = JSON.parse(await fs.readFile(path.join(directory, "annotations.json"), "utf8"));
  Bundle.validateManifest(manifest);
  const images = {};
  for (const page of manifest.pages || []) {
    for (const annotation of page.annotations || []) {
      images[annotation.screenshot.path] = await fs.readFile(path.join(directory, ...annotation.screenshot.path.split("/")));
    }
  }
  Bundle.validateBundle(manifest, images);
  return manifest;
}

async function findLatestValidBundle(projectRoot) {
  const captures = path.join(projectRoot, ".pi-annotations");
  let entries;
  try {
    entries = await fs.readdir(captures, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
  const names = entries
    .filter((entry) => entry.isDirectory() && CAPTURE_DIRECTORY.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const name of names) {
    const directory = path.join(captures, name);
    try {
      const manifest = await readBundle(directory);
      if (manifest.capture.id !== name) continue;
      return path.join(directory, "annotations.json");
    } catch {
      // Incomplete or invalid captures are intentionally ignored.
    }
  }
  return null;
}

module.exports = {
  IGNORE_ENTRY,
  chooseProjectCapture,
  destinationUsesProjectCaptureRoot,
  findLatestValidBundle,
  hasIgnoreEntry,
  inspectGitignore,
  mergeGitignoreBytes,
  prepareGitignore,
  readBundle,
  resolveProjectDestination,
  saveAtomic,
  validateBundle
};
