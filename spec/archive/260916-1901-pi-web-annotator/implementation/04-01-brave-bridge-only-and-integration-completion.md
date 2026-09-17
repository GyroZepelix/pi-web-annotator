# Slice 04.01: Brave bridge-only save and integration completion

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T04 - Reconcile capability-gated saving and complete the integrated package`
Assurance: medium - this slice corrects supported-browser save and recovery behavior while completing authenticated local IPC and filesystem integration; failures remain local and retryable.
Review required now: focused final-segment review plus final whole-contract review

## Outcome

Chrome/Chromium proper supports standalone and authenticated bridge saving, while default Brave retains pending annotations and requires the bridge. The side panel communicates capability state before Finish, recovers automatically after reconnection, preserves active comment drafts, and the complete package passes automated, capability-scoped browser, review, verification, and completion gates.

## Why this slice exists now

R002 proved that default Brave disables File System Access, invalidating T03's universal standalone assumption. Completed packet `01.01` and frozen packets `02.01` and `03.01` contain reusable source and evidence but cannot be rewritten or executed. One fresh session can add the localized capability state, reconcile documentation and tests, rerun retained evidence, and finish the item without another dependency boundary.

## Relevant context

- Requirements 2, 3, 6, 7, and 10 plus Decision D11 govern the capability correction and recovery UX.
- Requirements 1 and 4-10 govern final acceptance of the retained T01/T02/T03 source.
- [R002](../refinements/R002.md) is applied reasoning; `plan.md` is authoritative.
- Packets `02.01` and `03.01` are frozen evidence. Preserve their source work where it satisfies the current plan, but do not edit either packet.
- Parent-plan sections to load on conflict or uncertainty: Requirements, Design, Decision Log, Work breakdown, Acceptance criteria, Testing decisions and seams, Verification plan, Risks and blockers.

## Constraints and non-goals

- Use capability detection, not user-agent or browser-name sniffing.
- With a disconnected bridge and callable `showDirectoryPicker`, retain the direct user-gesture standalone path.
- With no picker and no bridge, disable Finish, show persistent instructions to run `/annotate`, and retain every draft, annotation, and screenshot.
- Bridge loss recomputes capability state; authenticated reconnection restores Finish without recapture.
- Preserve the R001 action correction and selected-target draft controls already present in retained T03 source.
- Preserve exactly `activeTab`, `scripting`, `sidePanel`, and `storage`, plus only `http://127.0.0.1:43127/*`.
- Add no dependency, downloads or broad host permission, ZIP or changed bundle format, native host, daemon, cloud service, required Brave flag, import command, automatic LLM ingestion, source mapping, or browser-restart recovery.
- Do not rewrite completed or frozen packets or discard retained T02/T03 source.

## Expected source and test areas

- `browser-extension/sidepanel.js`
- `tests/browser/sidepanel.test.js`
- Other browser tests only when capability-state coverage requires them
- `README.md`
- Retained T02/T03 areas under `browser-extension/`, `extensions/pi-web-annotator/`, `tests/bridge/`, `tests/bundle/`, and `tests/fixtures/`
- Final `verification.md`, `outcome.md`, and completion lifecycle artifacts after all gates pass

These paths are navigation hints. Inspect other source or tests only when Current or a credible regression path requires it.

## Acceptance and checks

- Acceptance: missing picker plus disconnected bridge disables Finish and shows persistent `/annotate` guidance without clearing or mutating pending state.
- Acceptance: picker availability enables the standalone path; authenticated bridge connection enables project-aware Finish; bridge loss and reconnection retain state and recompute the control automatically.
- Acceptance: selected-target text, focus, and caret survive bridge polling and unrelated state refreshes, while accepted, cancelled, removed, or replaced targets clear the correct draft.
- Acceptance: retained action authorization, explicit Enable, screenshot, schema-v1, standalone, bridge authentication, bounds, destination, `.gitignore`, atomic save, fallback, retry, and later-intake behavior satisfies the revised plan.
- Acceptance: the documented macOS matrix passes in current Chrome/Chromium proper for standalone plus bridge workflows and in default Brave 1.95.101+ for action, draft, bridge-only save, loss guidance, reconnection, and intake. Record exact browser and macOS versions plus residual uncertainty.
- Check: `node --test`
- Check: `find browser-extension extensions -name '*.js' -print0 | xargs -0 -n1 node --check`
- Check: actual Pi package discovery/load and non-TUI `/annotate` refusal smoke checks.
- Check: `npm pack --dry-run --json`
- Check: temporary-repository and loopback scenarios for authentication, schema/size/path rejection, no-overwrite, atomic save, `.gitignore`, timeout, cancel, shutdown, bridge loss, reconnection, and retry.
- Check: `uv run spec/scripts/manage-spec-item.py --root . validate --item 260916-1901-pi-web-annotator`
- Check: changed Markdown links and fences plus `git diff --check`.

## Review gate

Run one focused review over the R002 capability correction and its integration with retained T01 and frozen T02/T03 work. Then run one final contract-quality review over the complete revised implementation, all requirements and exclusions, capability-scoped browser evidence, tests, documentation, lifecycle evidence, and residual uncertainty. Reviewers apply the credible-harm blocker standard and do not expand the plan. Implement may rerun an affected gate at most twice after targeted corrections.

## Attempt log

### Attempt 1 - 2026-09-16T21:24:10Z

Starting HEAD: `787bb2d4265347b3253f41c3c3b031d5b953a508`

Changes: implemented capability-gated Finish and recovery in `browser-extension/sidepanel.js` and capability-neutral bridge-loss messaging in `browser-extension/service-worker.js`; added focused capability, loss/reconnection, state-preservation, and draft regression coverage; reconciled `README.md`; retained authorized T02/T03 source and the manual `.gitignore` append. Protected protocol paths and packets `01.01`, `02.01`, and `03.01` remain unchanged.

Checks: focused browser/service-worker/manifest tests passed 20/20; full `node --test` passed 62/62, including temporary-repository and real-loopback coverage; JavaScript syntax, the 17-file package dry run, isolated Pi package discovery and non-TUI `/annotate` refusal, spec validation, Markdown links/fences, `git diff --check`, and protected hashes passed. Focused final-segment review returned PASS with no blockers. Both `.pi-annotations/20260916-211757Z/annotations.json` and `.pi-annotations/20260916-211856Z/annotations.json` passed the repository reader and schema-v1 bundle validator with exact referenced PNG sets and safe relative paths; latest-valid discovery selected `.pi-annotations/20260916-211856Z/annotations.json`. Deterministic manifest identity resolves to extension ID `kemcbalaoccidjnoggajcgjhjlpibbkg` from package source `/Users/dgjalic/Documents/1-Projects/10-software-development/pi-web-annotator`.

Failures: live evidence confirms macOS 26.4 (25E246) and Brave Browser 153.1.95.102 passed the Brave-scoped action/capture, disconnected guidance and retained-state, bridge save/loss/reconnection, and later-intake matrix. The user explicitly confirmed only Brave was tested and requested that Brave count as Chromium because Brave is Chromium-based. No Google Chrome or Chromium-proper application or executable is locally discoverable, and no Chrome/Chromium-proper product/version or run was supplied. The canonical plan deliberately distinguishes Chrome/Chromium proper from default Brave and still requires Chrome/Chromium-proper standalone plus bridge acceptance, so one Brave run cannot satisfy both browser-family gates.

Blockers: the Chrome/Chromium-proper manual matrix and final whole-contract review remain unmet canonical acceptance gates. Current stays `04.01`; T04, plan progress, verification completion, outcome, archive, Dream, staging, and commit remain unchanged.

Exact next action: either run the README capability-scoped matrix in Google Chrome or Chromium proper and provide its exact `chrome://version` product/version with pass/fail notes, or formally revise the canonical browser-support acceptance before implementation completion resumes.

**Formal revision decision and lifecycle proof:** The user explicitly confirmed a formal same-item revision to a Brave-only acceptance/support contract and stated they are using the direct editing workflow. `uv run spec/scripts/manage-spec-item.py transition --help` exposed `revision_required`; `uv run spec/scripts/manage-spec-item.py --root . transition --item "260916-1901-pi-web-annotator" --to revision_required` reported `planned -> revision_required`. `item.yaml` now records `status: revision_required`; resolving with `--status revision_required` succeeds, while resolving with `--status planned` fails with exit 5. `implementation/index.md` remains at `Current: 04.01` with 04.01 unchecked; canonical T04 and final verification/progress checkboxes remain unchecked. This Attempt 1 is frozen pending same-item reconciliation. Exact route: `/skill:grill-with-docs 260916-1901-pi-web-annotator`.

For each interrupted or failed attempt, append without rewriting earlier entries:

```text
### Attempt <number> - <timestamp>
Starting HEAD: <git commit at invocation start>
Changes: <paths and behavior changed>
Checks: <commands and results>
Failures: <failures or none>
Blockers: <credible blockers or none>
Exact next action: <single resumable action>
```

## Completion and handoff

On success, record changed paths, capability-scoped browser acceptance, draft and complete integration evidence, all check results, both review verdicts, residual uncertainty, and the completion lifecycle result. Check `04.01` in `implementation/index.md`, check T04 in `plan.md`, and set Current to `complete` only after whole-plan evidence passes. Consolidate `verification.md`, then follow Implement's explicit completion-archive approval gate. Do not modify packets `01.01`, `02.01`, or `03.01`. Request a user-controlled Git checkpoint and suggest Dream without invoking either.
