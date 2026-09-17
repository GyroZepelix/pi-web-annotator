# Wiki State

Last full ingest commit: none
Last incremental ingest commit: none
Last lint date: none

## Processed inputs

| Input | Type | Source | Processed date | Output pages | Notes |
| --- | --- | --- | --- | --- | --- |
| `https://git.dgjalic.com/dgjalic/repo-wiki-template` | Protocol 2.0.0/schema-2 template installer | Forgejo repository | 2026-09-16 | `AGENTS.md`, `spec/`, `wiki/` | Installed lean repo wiki template. |
| `260916-1901-pi-web-annotator` | Verified implementation and completion evidence | Source tree, archived plan, Current 05.01, verification, outcome | 2026-09-17 | `wiki/browser-annotator.md`, `wiki/index.md`, `wiki/log.md`, `wiki/state.md` | Updated durable memory from standalone-only T01 to the verified Brave companion and authenticated bridge; item archived completed. |

## Maintenance policy

This file is compact processing state for resume, dedupe, lint, and ingest checkpoints. It is not append-only history.

Update this file when:

- Full or incremental ingest checkpoints change.
- Lint date or lint checkpoint state changes.
- Raw files, source batches, URL batches, specs, verification, outcomes, or commit ranges are processed into durable wiki knowledge and need dedupe/resume tracking.

Do not add rows for every session, chat turn, verification command, routine implementation plan, routine wiki edit, log-only event, or codebase change that does not affect durable wiki knowledge.

For wiki maintenance rows, `Output pages` should name wiki pages. Install/bootstrap rows may summarize the broader installed payload.

- Update checkpoints only after affected wiki pages are processed.
- Keep raw sources separate from trusted wiki synthesis.
- Mark uncertain or unverified pages as stale in `wiki/index.md`.
