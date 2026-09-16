# 260916-1901-pi-web-annotator - standalone browser checkpoint

Date: 2026-09-16
Work item: `260916-1901-pi-web-annotator/01.01`
Status: shipped
In one line: T01 established and verified the standalone Chromium annotation runtime and schema-v1 bundle boundary needed by the pending Pi bridge slice.

Checkpoint: Gamemaster checkpoint: 260916-1901-pi-web-annotator/01.01

## Goal

Implement only Current 01.01: a dependency-free Manifest V3 annotator with explicit document enablement, retryable browser state, privacy-bounded evidence, viewport screenshots, and standalone schema-v1 bundle saves.

## How we approached it

The session first reconciled a plan contradiction: Chrome requires the narrow `storage` permission for the already-required `chrome.storage.session` behavior. After approval, the canonical plan recorded that least-privilege correction. The browser runtime, strict bundle helpers, File System Access saver, side-panel UI, fixtures, and built-in Node tests were then built together. A focused review exposed quota-headroom and descendant-form-text risks; limits, measured storage enforcement, privacy extraction, validation, and focused tests were tightened before a passing re-review.

## Key decisions

- **Preserve the two-slice boundary** - delivered only standalone browser behavior and a stable disconnected bridge status; deferred all Pi bridge behavior to Current 02.01.
- **Use measured session headroom** - kept screenshots in session state while enforcing conservative image, bundle, and serialized-state budgets below the documented Chrome 114 quota.
- **Keep validity manifest-last** - standalone writes never overwrite a capture and expose no valid bundle until every referenced PNG has been written.

## What did not work

- **Original exact permission list** - omitted the permission required by the selected Chrome session-storage API; the approved source-truth correction added only `storage` and updated the plan before implementation.
- **Initial review assumptions and evidence filtering** - an obsolete 1 MiB quota assumption and wrapper text containing descendant form content required source reconciliation and targeted hardening before re-review.

## Current state and where we left off

- Shipped/verified: Current 01.01 and T01 are checked complete; Current is 02.01; 38 Node tests, syntax checks, JSON validation, package dry run, spec validation, whitespace checks, and focused review passed.
- Pending: Pi extension and authenticated loopback bridge work remain entirely in Current 02.01.

## Source of truth

- `spec/active/260916-1901-pi-web-annotator/plan.md`: canonical requirements, decisions, and T01 progress.
- `spec/active/260916-1901-pi-web-annotator/implementation/01-01-standalone-browser-annotator.md`: completion evidence, review reconciliation, and residual uncertainty.
- `browser-extension/` and `tests/`: implemented runtime and executable evidence.

## Verification

- Done: `node --test` passed 38/38; browser JavaScript syntax, JSON fixtures, package dry run, spec validation, Markdown fence balance, `git diff --check`, and focused re-review passed.
- Not verified yet: live Google Chrome/Chromium behavior for Side Panel, `activeTab`, screenshot paint timing, File System Access, and actual session-quota accounting because no supported browser executable was available.

## Open questions, blockers, next safe action

- Open/blocked: no T01 implementation blocker remains; live-browser uncertainty carries into integrated verification.
- Next safe action: create the user-controlled Git checkpoint, then implement only Current 02.01 against the established browser contract and run the documented real-Chromium checklist when a supported browser is available.

## Dynamic knowledge trail

- `wiki/browser-annotator.md`: topic-specific dynamic knowledge.
