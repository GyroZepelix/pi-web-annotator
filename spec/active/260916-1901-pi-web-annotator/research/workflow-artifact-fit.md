# Workflow artifact fit

Date: 2026-09-16
Status: Current frontier evidence

## Question

How should an annotation export fit the user's existing Library of Alexandria and Repo Wiki Template planning workflow?

## Repositories inspected

- `/Users/dgjalic/Documents/1-Projects/10-software-development/library-of-alexandria`
- `/Users/dgjalic/Documents/1-Projects/10-software-development/repo-wiki-template`

A bounded read-only scout compared repository instructions, planning skills, spec templates and lifecycle behavior, representative work-item layouts, and the installed template payload. The main session verified the key findings against the named files below.

## Confirmed workflow patterns

1. `spec/active/<id>/` is the durable task container. Discovery, indexed research, plans, optional implementation packets, verification, and outcomes stay together and the helper moves the complete directory to `spec/archive/<id>/` at completion.
2. Task-specific evidence belongs under the selected work item, commonly in a relative `research/` subtree. `wiki/raw/` is only for small curated inputs useful to future wiki maintenance and explicitly excludes large generated outputs and temporary tool output.
3. Fresh Pi sessions are handed an item ID or relative artifact path. The canonical implementation handoff points to `plan.md` and `item.yaml` rather than copying their contents into chat.
4. The archive helper blocks Markdown outside an item when it contains a literal canonical `spec/active/<id>` reference. Item-internal relative links remain relocatable when the item directory moves to archive.
5. Existing complex artifacts use a folder boundary, a compact machine-readable state/manifest, human-readable Markdown, and relative paths to secondary evidence.

Evidence:
- Library `README.md`
- Library `spec/AGENTS.md`
- Library `quick-plan/references/pi-handoff.md`
- Library `grill-with-docs/SKILL.md`
- Library `to-spec/SKILL.md`
- Library `implement/SKILL.md`
- Library representative `spec/archive/*/research/` directories
- Repo Wiki Template `README.md`, `INSTALL.md`, and `UPDATE.md`
- Repo Wiki Template `install/template/wiki/raw/README.md`
- Repo Wiki Template `install/template/spec/scripts/manage-spec-item.py`

## Recommendation

Export one transparent annotation bundle directory:

```text
<bundle>/
|-- annotations.json
`-- screenshots/
    `-- <stable capture names>.png
```

- `annotations.json` is the canonical machine-readable artifact, with a schema version, capture metadata, pages, annotations, element evidence, comments, and relative screenshot paths.
- Separate PNGs avoid base64 expansion and let Pi inspect only the images relevant to the current annotation.
- A generated `summary.md` was initially considered for human convenience, but the user's intended LLM-first intake can read JSON directly. Omitting the second representation is simpler and avoids drift.

Destination convention after the user's follow-up:

- Use dated session directories under one hidden project-local root, with the exact root name still to be confirmed (`.pi-annotations/` or `.web-annotations/`).
- Ask the user to confirm or replace the proposed destination after Finish.
- Keep the generated root out of Git. Whether the extension offers an explicit `.gitignore` edit or only warns remains open.
- Do not silently create or attach to a spec item and do not use `wiki/raw/`. A planning session can read the selected dated bundle by path and decide whether any evidence must be promoted into its own work item.

## Main trade-off

A folder bundle is not one physical file, but it keeps images efficient and selectively readable. Storing generated bundles outside active items avoids premature planning coupling and Git bloat, at the cost of making the annotation root a local, non-durable intake area unless the user deliberately promotes evidence later.
