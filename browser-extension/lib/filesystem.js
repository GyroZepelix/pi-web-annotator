(function (root, factory) {
  const constants = root.PiAnnotatorConstants || (typeof require === "function" ? require("./constants.js") : null);
  const bundle = root.PiAnnotatorBundle || (typeof require === "function" ? require("./bundle.js") : null);
  const api = factory(constants, bundle);
  root.PiAnnotatorFilesystem = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants, bundle) {
  "use strict";

  if (!constants || !bundle) throw new Error("Annotator constants and bundle helpers are required");
  const IGNORE_ENTRY = ".pi-annotations/";

  function hasIgnoreEntry(bytes) {
    const text = new TextDecoder().decode(bytes);
    return text.split(/\r?\n/).some((line) => line.trim() === IGNORE_ENTRY);
  }

  function mergeGitignoreBytes(existing) {
    const bytes = existing instanceof Uint8Array ? existing : new Uint8Array(existing || 0);
    if (hasIgnoreEntry(bytes)) return { bytes, changed: false };
    const text = new TextDecoder().decode(bytes);
    const newline = text.includes("\r\n") ? "\r\n" : "\n";
    const endsWithNewline = bytes.length > 0 && (bytes[bytes.length - 1] === 10 || bytes[bytes.length - 1] === 13);
    const addition = `${bytes.length === 0 || endsWithNewline ? "" : newline}${IGNORE_ENTRY}${newline}`;
    const suffix = new TextEncoder().encode(addition);
    const merged = new Uint8Array(bytes.length + suffix.length);
    merged.set(bytes, 0);
    merged.set(suffix, bytes.length);
    return { bytes: merged, changed: true };
  }

  async function readOptionalFile(directory, name) {
    try {
      const handle = await directory.getFileHandle(name, { create: false });
      const file = await handle.getFile();
      return { handle, bytes: new Uint8Array(await file.arrayBuffer()) };
    } catch (error) {
      if (error && error.name === "NotFoundError") return null;
      throw error;
    }
  }

  async function writeFile(handle, bytes) {
    const writable = await handle.createWritable();
    try {
      await writable.write(bytes);
      await writable.close();
    } catch (error) {
      if (typeof writable.abort === "function") await writable.abort().catch(() => {});
      throw error;
    }
  }

  async function prepareGitignore(rootDirectory, confirmChange) {
    const existing = await readOptionalFile(rootDirectory, ".gitignore");
    const original = existing ? existing.bytes : new Uint8Array();
    const merged = mergeGitignoreBytes(original);
    if (!merged.changed) return { changed: false, warning: null };
    const accepted = confirmChange(
      existing
        ? "Append .pi-annotations/ to this project root's .gitignore?"
        : "Create a project-root .gitignore containing .pi-annotations/?"
    );
    if (!accepted) return { changed: false, warning: ".gitignore was not changed; the bundle may appear as untracked files." };
    try {
      const handle = existing ? existing.handle : await rootDirectory.getFileHandle(".gitignore", { create: true });
      await writeFile(handle, merged.bytes);
      return { changed: true, warning: null };
    } catch (error) {
      return { changed: false, warning: `.gitignore could not be updated: ${error.message}` };
    }
  }

  async function directoryExists(parent, name) {
    try {
      await parent.getDirectoryHandle(name, { create: false });
      return true;
    } catch (error) {
      if (error && error.name === "NotFoundError") return false;
      throw error;
    }
  }

  async function chooseCaptureId(capturesDirectory, date) {
    const base = bundle.baseCaptureId(date);
    for (let collision = 0; collision < 10000; collision += 1) {
      const candidate = bundle.captureIdCandidate(base, collision);
      if (!(await directoryExists(capturesDirectory, candidate))) return candidate;
    }
    throw new Error("No unused capture directory name is available.");
  }

  async function saveStandalone(rootDirectory, finishData, options) {
    if (!rootDirectory || rootDirectory.kind !== "directory") throw new Error("A project directory is required.");
    const config = options || {};
    const confirmChange = typeof config.confirmGitignore === "function" ? config.confirmGitignore : () => false;
    const now = config.now instanceof Date ? config.now : new Date();
    const gitignore = await prepareGitignore(rootDirectory, confirmChange);
    const capturesDirectory = await rootDirectory.getDirectoryHandle(".pi-annotations", { create: true });
    const captureId = await chooseCaptureId(capturesDirectory, now);
    const manifest = bundle.createManifest(finishData.session, captureId, now.toISOString());
    bundle.validateBundle(manifest, finishData.images);
    const captureDirectory = await capturesDirectory.getDirectoryHandle(captureId, { create: true });
    const screenshotsDirectory = await captureDirectory.getDirectoryHandle("screenshots", { create: true });

    for (const page of manifest.pages) {
      for (const annotation of page.annotations) {
        const bytes = bundle.bytesFromImage(finishData.images[annotation.screenshot.path], annotation.screenshot.path);
        const imageHandle = await screenshotsDirectory.getFileHandle(`${annotation.id}.png`, { create: true });
        await writeFile(imageHandle, bytes);
      }
    }
    const manifestBytes = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
    const manifestHandle = await captureDirectory.getFileHandle("annotations.json", { create: true });
    await writeFile(manifestHandle, manifestBytes);
    return {
      captureId,
      relativePath: `.pi-annotations/${captureId}/annotations.json`,
      warning: gitignore.warning,
      manifest
    };
  }

  return Object.freeze({ IGNORE_ENTRY, chooseCaptureId, directoryExists, hasIgnoreEntry, mergeGitignoreBytes, prepareGitignore, saveStandalone, writeFile });
});
