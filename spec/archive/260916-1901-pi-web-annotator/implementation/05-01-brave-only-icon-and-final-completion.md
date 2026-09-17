# Slice 05.01: Brave-only icon and final completion

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T05 - Finalize Brave-only support, generated icon, and integrated completion`
Assurance: medium - this slice reconciles public browser support, adds generated packaged assets, and completes authenticated local IPC and filesystem verification, while failures remain local and recoverable.
Review required now: focused final-segment review plus final whole-contract review

## Outcome

The package honestly guarantees Brave on macOS, preserves the authenticated bridge and optional capability-detected standalone code, ships a recognizable generated cursor-plus-comment-bubble icon suite, and passes complete automated, package, Brave, review, verification, and completion gates.

## Why this slice exists now

R003 removed the unsupported dual-browser acceptance gate and added the missing companion icon. Completed packet `01.01` and frozen packets `02.01`, `03.01`, and `04.01` contain reusable source and evidence but cannot be rewritten or executed. One final fresh session can reconcile documentation and tests, generate and wire the icon, rerun final proof, and complete lifecycle gates without another dependency boundary.

## Relevant context

- Requirements 1-3 and 10 plus Decisions D12 and D13 govern support reconciliation, icon generation, and the live-legibility correction.
- Requirements 4-10 govern final acceptance of retained T01/T02/T03/T04 source.
- [R003](../refinements/R003.md) is applied reasoning; `plan.md` is authoritative.
- Packets `02.01`, `03.01`, and `04.01` are frozen evidence. Preserve their valid source work but do not edit those packets.
- Reusable evidence includes the 62-test result, syntax/package/Pi/loopback checks, focused T04 review, Brave Browser 153.1.95.102 on macOS 26.4 live matrix, and validated `.pi-annotations/` bundles.
- Parent-plan sections to load on conflict or uncertainty: Requirements, Design, Decision Log, Work breakdown, Acceptance criteria, Testing decisions and seams, Verification plan, Risks and blockers.

## Constraints and non-goals

- Guarantee only Brave 1.95.101+ on macOS. Do not claim or require Google Chrome or Chromium-proper acceptance.
- Retain capability-detected standalone saving as unguaranteed best-effort behavior. Do not remove it or elevate it into guaranteed scope.
- Keep one final 1024 by 1024 source PNG with a flat cursor-plus-comment-bubble motif on a solid cobalt-blue background. Use a very large high-contrast cursor and white comment bubble filling about 80% of the square with minimal safe padding, no text, and no fine detail.
- Correct the existing generated source through exactly one provider edit; do not regenerate, substitute, add an alternate source, or broaden the concept.
- After the edited source exists and validates, derive 16, 32, 48, and 128 pixel PNGs with platform tooling and add no dependency.
- Preserve the deterministic manifest key, extension ID, exact permissions, action authorization, explicit Enable, stable drafts, bridge trust, schema-v1 output, retry state, and optional standalone behavior.
- Add no broad branding, alternate artwork set, animation, store asset, downloads, ZIP, native host, daemon, cloud service, broad permission, required Brave flag, or changed bundle format.
- Do not rewrite completed or frozen packets or discard retained source work.

## Expected source and test areas

- `browser-extension/icons/`
- `browser-extension/manifest.json`
- `tests/browser/manifest.test.js`
- focused icon metadata tests where adjacent
- `README.md`
- retained browser, bridge, bundle, extension, and fixture areas for final checks
- final `verification.md`, `outcome.md`, and completion lifecycle artifacts after all gates pass

These paths are navigation hints. Inspect other source or tests only when Current or a credible regression path requires it.

## Acceptance and checks

- Acceptance: README and package metadata guarantee Brave only, describe bridge saving as the guaranteed path, and label standalone capability as unguaranteed best-effort behavior without removing it.
- Acceptance: image generation produces one project-owned 1024 pixel source PNG and derived 16, 32, 48, and 128 pixel square PNGs with the confirmed motif and no text.
- Acceptance: manifest `icons` and action `default_icon` resolve to the derived assets while the public key, extension ID, minimum API version, permissions, and host permission remain unchanged.
- Acceptance: PNG signatures and dimensions validate, `npm pack --dry-run --json` includes source and derived icons, and excludes spec, wiki, tests, and `.pi-annotations/`.
- Acceptance: reloading the unpacked companion in Brave preserves extension ID `kemcbalaoccidjnoggajcgjhjlpibbkg` and shows a recognizable icon in `brave://extensions` and the toolbar at normal display scale.
- Acceptance: retained action, Enable, draft, capture, capability guidance, bridge authentication, atomic save, bundle validation, recovery, and later intake continue to satisfy the revised plan.
- Check: `node --test`
- Check: `find browser-extension extensions -name '*.js' -print0 | xargs -0 -n1 node --check`
- Check: focused Node PNG signature/dimension and manifest-path validation.
- Check: actual Pi package discovery/load and non-TUI `/annotate` refusal smoke checks.
- Check: `npm pack --dry-run --json`
- Check: temporary-repository and loopback scenarios for authentication, schema/size/path rejection, no-overwrite, atomic save, `.gitignore`, timeout, cancel, shutdown, bridge loss, reconnection, and retry.
- Check: validate the recorded `.pi-annotations/` bundles and latest-valid selection.
- Check: `uv run spec/scripts/manage-spec-item.py --root . validate --item 260916-1901-pi-web-annotator`
- Check: changed Markdown links and fences plus `git diff --check`.

## Review gate

Run one focused review over the R003 Brave-only and icon correction integrated with retained T01 and frozen T02/T03/T04 work. Then run one final contract-quality review over the complete revised implementation, all requirements and exclusions, Brave evidence, icon and package evidence, documentation, lifecycle evidence, and residual uncertainty. Reviewers apply the credible-harm blocker standard and do not expand the plan. Implement may rerun an affected gate at most twice after targeted corrections.

## Attempt log

### Attempt 1 - 2026-09-16T22:06:14Z
Starting HEAD: `787bb2d4265347b3253f41c3c3b031d5b953a508`
Changes: no source changes; recorded this interruption only.
Checks: protocol `2.2.0` is compatible; helper `resolve` and `validate` capabilities are present; the planned item resolves; protected-path SHA-256 values match the supplied boundary.
Failures: this Twin exposes only `read`, `write`, `edit`, `bash`, `grep`, `find`, and `ls` as built-in subagent tools, and the required `codex_generate_image` capability is not available. No image-generation call was made.
Blockers: Current requires exactly one configured Codex Images generation for `browser-extension/icons/icon-source.png`; the packet forbids substituting shell-drawn, downloaded, or unrelated artwork.
Exact next action: make `codex_generate_image` available to this Twin or generate the approved source once in the parent session at the required path, then resume Current 05.01.

### Attempt 2 - 2026-09-16T22:08:05Z
Starting HEAD: `787bb2d4265347b3253f41c3c3b031d5b953a508`
Changes: parent generated `browser-extension/icons/icon-source.png` exactly once; no source or derived-asset changes made in this attempt.
Checks: `file` and `sips -g format -g pixelWidth -g pixelHeight` confirm a valid RGBA PNG, but both report `1254x1254`; SHA-256 is `a8ab8032cf749857557e5642af22a16b36396be1a28fb812ca3394f9fe42cfa4`.
Failures: generated dimensions do not match the required `1024x1024` source metadata despite the provider request and parent handoff describing a 1024-pixel result.
Blockers: the contract requires a checked-in 1024x1024 source, while the resume instruction permits deriving only the planned 16/32/48/128 assets and forbids regeneration or substitution.
Exact next action: obtain explicit parent approval to resize the generated source once to 1024x1024 with `sips`, or another contract-conforming resolution, before deriving assets.

### Attempt 3 - 2026-09-16T22:16:54Z
Starting HEAD: `787bb2d4265347b3253f41c3c3b031d5b953a508`
Changes: normalized the provider's unexpected 1254x1254 output in place to 1024x1024, derived and wired the provisional 16/32/48/128 PNGs, added manifest/package/image tests, and reconciled `README.md` plus package metadata to Brave-only support. After live rejection, updated canonical Requirement 3, Risk, and Decision D13 plus this packet before any provider edit; frozen packets and refinements remain unchanged.
Checks: provisional source and derived PNG signature/IHDR checks passed; focused manifest tests passed 8/8; full `node --test` passed 64/64; JavaScript syntax, 22-file package dry run and inclusion/exclusion assertions, Pi package discovery and non-TUI `/annotate` refusal, two recorded bundle validations and latest-valid selection, spec validation, Markdown links/fences, `git diff --check`, and protected hashes passed.
Failures: live Brave icon inspection rejected the charcoal-background, generously padded rendering as insufficiently recognizable and requested a solid cobalt-blue background plus a very large motif filling about 80% of the square with minimal safe padding. The provisional derived sizes and their passing metadata are stale visual evidence.
Blockers: exactly one provider edit of the existing source is required before final derivation, rerun checks, and repeated live inspection. Icon acceptance, reviews, progress, verification consolidation, and archive gates remain pending.
Exact next action: the parent must invoke exactly one provider edit of `browser-extension/icons/icon-source.png` using the corrected D13 styling, preserving the motif and all non-visual constraints, then resume Current 05.01.

**Provider edit resumption - 2026-09-16T22:19:07Z:** The parent invoked exactly one provider edit using `icon-source.png` as the sole reference. Collision-safe output naming produced `browser-extension/icons/icon-source-2.png` at 1254x1254 (SHA-256 `b8672dbcc7fa91968c658255f4bdb407e2aba2d36aca08e33b78c36a8c7d9909`). Current promoted that result over `icon-source.png`, removed the alternate filename, normalized the one final source to 1024x1024 with `sips`, and re-derived only 16/32/48/128 PNGs. No further generation/edit call occurred and no alternate source artwork remains.

**Source-art approval:** The user explicitly approved the revised visual direction as “this one is much better.”

**Final live Brave icon evidence:** After reloading the corrected derived icons, the displayed extension ID was exactly `kemcbalaoccidjnoggajcgjhjlpibbkg`; icon recognizability passed in `brave://extensions`; and icon recognizability passed in the pinned toolbar at normal display scale.

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

### Completed - 2026-09-17T10:20:52Z

- **Changed paths:** reconciled Brave-only public support in `README.md` and `package.json`; added the one final generated source plus 16/32/48/128 icons under `browser-extension/icons/`; wired exact manifest and action icon maps; added deterministic key, PNG metadata, manifest map, and package boundary tests; applied canonical Decision D13 and recorded this Current's evidence. Retained T02/T03/T04 source and the approved `.gitignore` baseline were preserved.
- **Generation and normalization:** the parent performed exactly one initial generation and exactly one approved edit after the first live-legibility rejection. Both provider outputs unexpectedly used 1254x1254 metadata and were normalized deterministically to 1024x1024 with `sips`. Collision-safe edit output `icon-source-2.png` was promoted over the source and removed; only one source remains. The user approved the corrected source artwork.
- **Acceptance:** the package guarantees Brave 1.95.101+ on macOS and authenticated `/annotate` saving; Chrome 116 remains only the API floor; capability-detected standalone saving remains explicitly unguaranteed. Exact key, ID, permissions, action authorization, explicit Enable, stable drafts, evidence privacy, bridge trust, atomic saves, schema-v1 bundles, retry state, and later intake remain accepted.
- **Checks:** `node --test` passed 64/64; complete JavaScript syntax passed; focused PNG signature/IHDR/dimension/one-source/manifest-map validation passed; `npm pack --dry-run --json` passed with 22 runtime files and required exclusions; actual Pi package discovery and non-TUI refusal passed; temporary-repository and loopback coverage passed within the full suite; both recorded bundles and latest-valid discovery passed; spec validation, Markdown links/fences, protected hashes, and `git diff --check` passed.
- **Live evidence:** reused Brave Browser 153.1.95.102 on macOS 26.4 workflow and bundle evidence. Final reload preserved ID `kemcbalaoccidjnoggajcgjhjlpibbkg`; icon recognizability passed in `brave://extensions` and the pinned normal-scale toolbar.
- **Reviews:** focused final-segment review PASS and final whole-contract review PASS, both initial runs with no blockers and zero retries. The contract-quality reviewer noted only non-blocking wording/provenance/capability observations.
- **Residual uncertainty:** future Brave API behavior is external; optional standalone remains outside guaranteed acceptance; the accepted medium-assurance boundary spans retained uncommitted slices from starting HEAD `787bb2d4265347b3253f41c3c3b031d5b953a508` without an intermediate committed checkpoint.
- **Lifecycle:** `05.01` and T05 are complete and verification is consolidated. Non-mutating archive preflight and explicit terminal archive approval remain pending; no archive, Dream, stage, commit, push, or deploy has occurred.
