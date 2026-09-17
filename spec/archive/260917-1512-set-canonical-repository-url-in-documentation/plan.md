# Plan: Set canonical repository URL in documentation

Work item: `260917-1512-set-canonical-repository-url-in-documentation`
Status: Planned
Created: 2026-09-17
Updated: 2026-09-17

Assurance: low - the change is localized, reversible documentation work with no runtime impact.

## Goal

Make `https://github.com/GyroZepelix/pi-web-annotator` the explicit canonical repository URL in current project documentation and remove the discovered installation placeholder.

## Requirements

- Link the README to the canonical repository URL.
- Use `GyroZepelix/pi-web-annotator` in the documented pinned Git installation command.
- Preserve unrelated external URLs, historical records, and runtime behavior.

## Out of scope

- Changing external Brave, Chrome, Playwright, or template-source links.
- Rewriting archived historical documentation that contains no project repository placeholder.
- Changing dependencies, runtime code, or Git remotes.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Documentation scope | Update `README.md`; retain unrelated URLs unchanged. | The tracked-document inventory found the only project repository placeholder at `README.md:33`; `origin` already points to the supplied URL. | User-confirmed all tracked documentation scope; `git grep`; `git remote -v`. | Another old or placeholder project repository URL is discovered. |

## Work breakdown

- [x] T01: Publish the canonical repository URL in current documentation.
  - Depends on: none
  - Scope: Add an explicit README repository link and replace the Git install owner placeholder.
  - Expected areas: `README.md`
  - Acceptance: The README links to the supplied repository and contains no `OWNER/pi-web-annotator` placeholder.
  - Verification: targeted URL and placeholder searches, Markdown link/path checks, spec validation, and `git diff --check`.

## Acceptance criteria

- `README.md` presents `https://github.com/GyroZepelix/pi-web-annotator` as the repository.
- The pinned Git install example uses `git:github.com/GyroZepelix/pi-web-annotator@COMMIT_OR_TAG`.
- No tracked documentation retains an old or placeholder project repository URL.
- Unrelated URLs and application behavior remain unchanged.

## Verification plan

- `git grep -nF 'OWNER/pi-web-annotator' -- '*.md' '*.mdx' '*.rst' '*.txt' '*.adoc'`
- `git grep -nF 'https://github.com/GyroZepelix/pi-web-annotator' -- '*.md' '*.mdx' '*.rst' '*.txt' '*.adoc'`
- Check changed Markdown links, paths, and fenced-code balance.
- `uv run spec/scripts/manage-spec-item.py --root . validate --item 260917-1512-set-canonical-repository-url-in-documentation`
- `git diff --check`

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete.
- [x] Verification passed.

## Execution handoff

Read this plan and `item.yaml` completely. Preserve its requirements and exclusions, implement the smallest coherent documentation change, run the specified checks, and record only verified evidence. Stop before dependencies, destructive operations, external writes, commits, pushes, or scope expansion.
