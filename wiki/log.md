# Wiki Log

Curated append-only timeline of durable wiki maintenance events. This is not a codebase changelog, commit log, or session transcript.

Use this shape for new entries:

- Heading: `## [YYYY-MM-DD] <kind> | <short title>`.
- Trigger: why the wiki was updated.
- Inputs: source paths, commit ranges, specs, verification, outcomes, URLs, or raw files used as evidence.
- Wiki pages changed: wiki files changed.
- Verification: checks or source verification.
- Notes: gaps, conflicts, stale areas, or exceptions.

## [2026-09-16] install | repo wiki template

- Trigger: user requested installation from `https://git.dgjalic.com/dgjalic/repo-wiki-template`.
- Inputs: protocol version 2.0.0/schema-2 payload from `https://git.dgjalic.com/dgjalic/repo-wiki-template/install/template/`.
- Wiki pages changed: `wiki/AGENTS.md`, `wiki/index.md`, `wiki/log.md`, `wiki/state.md`, `wiki/raw/README.md`.
- Verification: required files and managed regions exist; existing files were preserved or merged; protocol validation result was recorded.
- Notes: installed payload may also create or merge root and spec files; initial codebase ingest is still needed.

## [2026-09-16] dream | standalone browser checkpoint

- Trigger: Dream run after the reconciled T01 implementation checkpoint.
- Inputs: `browser-extension/`, `tests/browser/`, `tests/bundle/`, `tests/fixtures/`, `README.md`, `package.json`, and `spec/active/260916-1901-pi-web-annotator/` planning and completion evidence.
- Wiki pages changed: `wiki/browser-annotator.md`, `wiki/dreams/MEMORY.md`, `wiki/dreams/2026-09-16-2023-gamemaster-checkpoint-260916-1901-pi-web-annotator-01-01.md`, `wiki/dreams/by-spec/260916-1901-pi-web-annotator.md`, `wiki/index.md`, and `wiki/log.md`.
- Verification: re-read changed pages, checked relative links and exact checkpoint uniqueness, ran memory safety and pointer-budget scans, and ran `git diff --check`.
- Notes: the stable browser contract was promoted to topic-specific guidance; live Google Chrome/Chromium verification remains pending for Current 02.01.

## [2026-09-17] ingest | verified Brave annotator and Pi bridge

- Trigger: Current 05.01 completed implementation, automated checks, live Brave acceptance, and medium-assurance focused plus whole-contract reviews.
- Inputs: `browser-extension/`, `extensions/pi-web-annotator/`, `tests/`, `README.md`, `package.json`, work item `260916-1901-pi-web-annotator`, and its consolidated verification evidence.
- Wiki pages changed: `wiki/browser-annotator.md`, `wiki/index.md`, `wiki/log.md`, and `wiki/state.md`.
- Verification: source and canonical plan were reconciled; `node --test` passed 64/64; package, Pi load, icon metadata, saved-bundle, spec, link/fence, protected-hash, and diff checks passed; focused and contract-quality reviews passed; live Brave workflow and final icon evidence passed.
- Notes: durable guidance now reflects Brave-only guaranteed support, authenticated bridge saving, optional capability-gated standalone behavior, stable drafts, generated icon assets, and schema-v1 intake. Terminal archive remains pending explicit approval.

## [2026-09-17] dream | web annotator lifecycle retrospective

- Trigger: `/dream` run after successful Gamemaster completion and archival of `260916-1901-pi-web-annotator`.
- Inputs: archived plan, refinements R001-R003, implementation packets, verification, outcome, per-spec ledger, and checkpoint commits `787bb2d4265347b3253f41c3c3b031d5b953a508` and `2e59e420421b6a919d856b6c7c53724c3d92280c`.
- Wiki pages changed: `wiki/dreams/retrospectives/260916-1901-pi-web-annotator.md`, `wiki/observations.md`, and `wiki/log.md`.
- Verification: retrospective helper created the lifecycle phase; memory safety, target links, phase uniqueness, scope boundaries, and `git diff --check` passed.
- Notes: retained one tentative browser-extension planning observation; ordinary episodes, catalog, checkpoint ledger, dynamic guidance, pointers, index, and state remain unchanged.

## [2026-09-22] ingest | improved annotation interaction workflow

- Trigger: direct T01 implementation and verification established the current Pause/Resume, armed re-hover capture, stable accepted editing, and exact-live Highlight behavior.
- Inputs: `browser-extension/`, `tests/browser/`, `README.md`, and work item `260922-1604-improve-annotation-workflow` with automated and live Brave acceptance evidence.
- Wiki pages changed: `wiki/browser-annotator.md`, `wiki/log.md`, and `wiki/state.md`.
- Verification: source and canonical plan were reconciled; `node --test` passed 75/75; focused browser tests passed 25/25; JavaScript syntax, package dry-run, Markdown, spec, and diff checks passed; live Brave 153.1.95.102 on macOS 26.4 exercised the complete interaction workflow.
- Notes: exact live-target identity remains document-runtime-only; Highlight deliberately does not reattach from selectors after navigation or DOM detachment.
