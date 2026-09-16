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
