# Spec Instructions

Protocol version: 2.0.0

## Purpose

`/spec` stores intended change, active planning state, implementation tasks, verification evidence, outcomes, and archived work history.

## Required structure

- `spec/active/<id>/`: every nonterminal initiative or work item.
- `spec/archive/<id>/`: terminal history retained under the same stable ID.
- `spec/templates/`: canonical artifact templates.
- `spec/scripts/manage-spec-item.py`: deterministic creation, resolution, current planning transitions, completed archival, supersession, validation, and index maintenance.
- `spec/index.md`: generated routing tables plus human-authored orientation.

## Work-item contract

- Every item contains `item.yaml` with integer `schema_version: 2` and required `superseded_by` metadata.
- `superseded_by` is `null` for active and completed items. Superseded items name a distinct existing repository-local replacement.
- Quick Plan items contain `plan.md` and start in `planned`.
- Grill With Docs items contain `discovery.md` and start in `discovering`.
- To Spec preserves discovery evidence, creates `plan.md`, and transitions `ready_for_spec` to `planned`.
- Implement creates or updates `verification.md` after successful evidence gates. It creates `outcome.md` only after explicit completion approval.
- `plan.md` is the canonical implementation contract. Discovery and research cannot silently override it.

## Planning boundaries

- Ask questions before planning.
- Keep unresolved and evolving design in `discovery.md`.
- Keep confirmed implementation decisions in the plan Decision Log.
- Keep task-specific research under the active item.
- Do not mirror every spec into the wiki.
- Keep future design out of current-state wiki guidance until implementation and verification establish it.

## Indexing

- `item.yaml` and filesystem location are authoritative for item identity and status.
- Active items use `discovering`, `ready_for_spec`, or `planned` as their route permits. Archived items use `completed` or `superseded`.
- Update only the managed regions in `spec/index.md`.
- Explicitly identify an item by ID or path. Infer only when exactly one eligible active item exists.
- Never infer the active item from a Git branch or shared current-item pointer.

## Archive boundary

`spec/archive/` is the only terminal location. Missing route artifacts, invalid state, an existing destination, or literal canonical `spec/active/<id>` text in Markdown outside the item block a new terminal move. Archive location is the commit point and managed indexes are derived.

After all applicable implementation evidence gates pass, Implement may preflight completion, request explicit terminal approval, create `outcome.md`, and invoke the helper's dedicated `archive` command. Only that command records `completed`; it requires a planned source plus regular `plan.md`, `verification.md`, and `outcome.md`. Rerunning it may idempotently finish an archive-only planned item or repair a completed item's index.

The dedicated Supersede skill may retire any active status only after explicit source and replacement IDs, non-mutating helper preflight, an exact disposition summary, and explicit terminal approval. Only `supersede --item <id> --replacement <id>` records `superseded`; it requires a distinct active or completed replacement and regular `outcome.md`, but never invents a missing plan or requires verification evidence. Rerunning the same command may converge an archive-only active-state item or repair a valid superseded item's index.

Cancellation and broader execution-state automation remain unimplemented. Planning skills do not perform terminal mutations.

## Authority

Explicit user instructions and current `AGENTS.md` files outrank accepted plans. Source at `HEAD` is authoritative for current implementation state. When a plan conflicts with source or current repository instructions, record the conflict and resolve it instead of guessing.
