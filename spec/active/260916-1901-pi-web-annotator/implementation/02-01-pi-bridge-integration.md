# Slice 02.01: Pi bridge and complete integration

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T02 - Deliver the Pi bridge and complete integrated workflow`
Assurance: medium - authenticated loopback IPC and project filesystem writes add meaningful cross-component regression risk, while failures remain local and retryable.
Review required now: focused final-segment review plus final whole-contract review

## Outcome

The Pi package exposes `/annotate`, securely coordinates one optional project-aware browser session, validates and atomically saves the final bundle with destination and `.gitignore` confirmation, preserves standalone fallback, and passes complete automated, packaging, documentation, and real Chromium acceptance.

## Why this slice exists now

It consumes the verified T01 browser state, manifest, screenshot, and Finish contracts. Starting it earlier would couple browser capture defects with bridge authentication and Pi filesystem defects, obscuring root cause and threatening completion of both runtime surfaces in one session.

## Relevant context

- Requirements 1, 5, and 7-10 govern this slice; T01's passing bundle and browser contracts are prerequisites.
- Decisions D03-D08 govern artifact, bridge, save, intake, trust, and sliced execution.
- The bridge must reveal no project path and expose no generic filesystem operation.
- Parent-plan sections to load on conflict or uncertainty: Requirements, Design, Decision Log, Acceptance criteria, Testing decisions and seams, Risks and blockers.

## Constraints and non-goals

- Bind exactly to `127.0.0.1:43127`, allow only the deterministic companion origin, and require a random token after handshake.
- Reject wrong origin, token, method, media type, schema, size, duplicate completion, and escaping path before any destination write.
- Use a temporary sibling and final rename, never overwrite, and retain browser state until Pi reports success.
- Ask before appending `.pi-annotations/` to the project-root `.gitignore`; declining still allows save with a warning.
- Stop the bridge on every terminal lifecycle path and preserve standalone behavior when no bridge exists or it disappears.
- Add no native host, permanent daemon, remote bind, cloud service, custom import command, automatic LLM turn, or unapproved dependency.

## Expected source and test areas

- `extensions/pi-web-annotator/index.ts`
- `extensions/pi-web-annotator/lib/`
- `browser-extension/service-worker.js`
- `browser-extension/sidepanel.js`
- bridge-related browser helpers and fixtures
- `tests/bridge/`
- `tests/bundle/`
- `tests/fixtures/`
- `README.md`
- `package.json`

## Acceptance and checks

- Acceptance: `/annotate` is available in interactive Pi, starts one cancellable fixed-port session, fails clearly on collision, and releases the endpoint on success, cancel, timeout, session replacement/shutdown, and unrecoverable failure.
- Acceptance: the companion detects connected versus standalone mode without receiving `ctx.cwd`; accepted requests require the allowlisted origin and per-session token.
- Acceptance: Finish retains browser state until Pi validates all metadata and images, confirms destination, applies any approved ignore edit, atomically exposes one complete non-overwriting bundle, and returns success.
- Acceptance: invalid callers or payloads and every tested prompt, transfer, validation, and filesystem failure produce no valid destination and leave browser state retryable.
- Acceptance: documentation covers install, unpacked loading, both workflows, artifact schema, latest-bundle intake, privacy, limits, unsupported environments, and troubleshooting.
- Check: `node --test`
- Check: `find browser-extension extensions -name '*.js' -print0 | xargs -0 -n1 node --check`
- Check: `npm pack --dry-run`
- Check: run documented temporary-repository bridge integration tests for authentication, bounds, validation, path safety, no-overwrite, temp rename, `.gitignore`, timeout, cancel, and shutdown.
- Check: run the complete documented macOS Chromium checklist for standalone, connected bridge, bridge loss and fallback, multi-page capture, and later path-based Pi intake.
- Check: `uv run spec/scripts/manage-spec-item.py --root . validate --item 260916-1901-pi-web-annotator`
- Check: resolve changed Markdown links, check fenced-code balance, and run `git diff --check`.

## Review gate

Run one focused review over T02 and its integration with the accepted T01 contract. Then run one final contract-quality review over the complete implementation and all plan requirements, exclusions, acceptance criteria, tests, documentation, and residual uncertainty. Reviewers apply the credible-harm blocker standard and do not expand the plan. Implement may rerun an affected gate at most twice after targeted corrections.

## Attempt log

No attempts recorded.

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

On success, record changed paths, complete acceptance, check results, both review verdicts, and residual uncertainty. Check 02.01 in `implementation/index.md`, check T02 in `plan.md`, and set Current to `complete` only after whole-plan evidence passes. Consolidate `verification.md`, then follow the implementation workflow's explicit completion-archive approval gate. Request a user-controlled Git checkpoint and suggest Dream without invoking either.
