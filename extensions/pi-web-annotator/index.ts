import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { BorderedLoader } from "@earendil-works/pi-coding-agent";
import { startBridge } from "./lib/bridge.js";
import {
  chooseProjectCapture,
  destinationUsesProjectCaptureRoot,
  inspectGitignore,
  prepareGitignore,
  resolveProjectDestination,
  saveAtomic,
  validateBundle,
} from "./lib/filesystem.js";

type BundlePayload = { manifest: Record<string, any>; images: Record<string, string> };
type BridgeResult =
  | { status: "saved"; relative_path: string; warning: string | null }
  | { status: "cancelled" | "retryable_error" | "terminal_error"; message: string };
type WaitingResult = { kind: "bundle" } | { kind: "cancel" } | { kind: "timeout" } | { kind: "shutdown" };

async function saveBundle(ctx: any, projectRoot: string, payload: BundlePayload): Promise<BridgeResult> {
  try {
    const chosen = await chooseProjectCapture(projectRoot, payload.manifest);
    validateBundle(chosen.manifest, payload.images);
    const proposed = path.relative(projectRoot, chosen.destination).split(path.sep).join("/");
    const accepted = await ctx.ui.confirm(
      "Save web annotations?",
      `Save the validated bundle to ${proposed}/?`,
    );

    let destinationInput = chosen.destination;
    if (!accepted) {
      const replacement = await ctx.ui.input(
        "Replacement destination",
        `Path within this project ending in ${chosen.captureId}`,
      );
      if (replacement === undefined || replacement.trim() === "") {
        return { status: "cancelled", message: "Save cancelled in Pi; browser annotations were retained." };
      }
      destinationInput = replacement.trim();
    }

    const resolved = await resolveProjectDestination(projectRoot, destinationInput);
    if (path.basename(resolved.destination) !== chosen.captureId) {
      throw new Error(`Destination must end in the capture ID ${chosen.captureId}`);
    }

    let warning: string | null = null;
    if (destinationUsesProjectCaptureRoot(resolved.projectRoot, resolved.destination)) {
      const ignore = await inspectGitignore(resolved.projectRoot);
      let update = false;
      if (!ignore.hasEntry) {
        update = await ctx.ui.confirm(
          ignore.exists ? "Update project .gitignore?" : "Create project .gitignore?",
          ignore.exists
            ? "Append .pi-annotations/ without changing existing bytes?"
            : "Create .gitignore containing .pi-annotations/?",
        );
      }
      const ignoreResult = await prepareGitignore(resolved.projectRoot, update);
      warning = ignoreResult.warning;
    }

    const saved = await saveAtomic(
      resolved.projectRoot,
      resolved.destination,
      chosen.manifest,
      payload.images,
    );
    return { status: "saved", relative_path: saved.relativePath, warning };
  } catch (error: any) {
    ctx.ui.notify(`Pi annotation save failed: ${error?.message || String(error)}`, "error");
    return {
      status: "retryable_error",
      message: "Pi could not save the confirmed destination. Browser annotations were retained for retry.",
    };
  }
}

export default function (pi: ExtensionAPI) {
  let activeBridge: any = null;

  pi.on("session_shutdown", () => {
    activeBridge?.stop("shutdown", true);
    activeBridge = null;
  });

  pi.registerCommand("annotate", {
    description: "Wait for the authenticated Chromium annotator and save one project bundle",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui" || !ctx.hasUI) {
        ctx.ui.notify("/annotate is available only in interactive TUI mode.", "error");
        return;
      }
      if (activeBridge) {
        ctx.ui.notify("An annotation bridge is already active in this session.", "warning");
        return;
      }

      let finishWaiting: ((result: WaitingResult) => void) | null = null;
      let pending: { payload: BundlePayload; resolve: (result: BridgeResult) => void } | null = null;
      let stoppedReason: string | null = null;

      try {
        activeBridge = await startBridge({
          inactivityMs: 5 * 60 * 1000,
          onBundle(payload: BundlePayload) {
            return new Promise<BridgeResult>((resolve) => {
              pending = { payload, resolve };
              finishWaiting?.({ kind: "bundle" });
            });
          },
          onStop(reason: string) {
            stoppedReason = reason;
            if (reason === "timeout") finishWaiting?.({ kind: "timeout" });
            if (reason === "shutdown") finishWaiting?.({ kind: "shutdown" });
          },
        });
      } catch (error: any) {
        ctx.ui.notify(error?.message || String(error), "error");
        activeBridge = null;
        return;
      }

      const bridge = activeBridge;
      ctx.ui.setStatus("pi-web-annotator", `annotation bridge ${bridge.address}`);
      try {
        const waiting = await ctx.ui.custom<WaitingResult>((tui, theme, _keybindings, done) => {
          finishWaiting = done;
          const loader = new BorderedLoader(
            tui,
            theme,
            "Waiting for Pi Web Annotator on 127.0.0.1:43127 (Esc to cancel)...",
          );
          loader.onAbort = () => done({ kind: "cancel" });
          if (pending) queueMicrotask(() => done({ kind: "bundle" }));
          if (stoppedReason === "timeout") queueMicrotask(() => done({ kind: "timeout" }));
          return loader;
        });
        finishWaiting = null;

        if (waiting.kind !== "bundle" || !pending) {
          bridge.stop(waiting.kind === "timeout" ? "timeout" : waiting.kind, true);
          if (waiting.kind === "timeout") ctx.ui.notify("Annotation bridge timed out and stopped.", "warning");
          else if (waiting.kind === "cancel") ctx.ui.notify("Annotation bridge cancelled.", "info");
          return;
        }

        const outcome = await saveBundle(ctx, ctx.cwd, pending.payload);
        pending.resolve(outcome);
        await bridge.closed;
        if (outcome.status === "saved") {
          const warning = outcome.warning ? ` Warning: ${outcome.warning}` : "";
          ctx.ui.notify(`Saved ${outcome.relative_path}.${warning}`, outcome.warning ? "warning" : "info");
        } else {
          ctx.ui.notify(outcome.message, outcome.status === "cancelled" ? "info" : "error");
        }
      } finally {
        finishWaiting = null;
        if (activeBridge === bridge) activeBridge = null;
        ctx.ui.setStatus("pi-web-annotator", undefined);
        bridge.stop("command-finished", true);
      }
    },
  });
}
