# Outcome: Set canonical repository URL in documentation

Work item: `260917-1512-set-canonical-repository-url-in-documentation`
Disposition: Completed
Date: 2026-09-17

## Delivered scope

- Added the canonical repository link `https://github.com/GyroZepelix/pi-web-annotator` to `README.md`.
- Replaced the Git installation owner placeholder with `GyroZepelix/pi-web-annotator`.
- Preserved unrelated external and historical source URLs.

## Deviations from plan

- None.

## Verification summary

- Confirmed no tracked documentation retains `OWNER/pi-web-annotator`.
- Confirmed the README contains the canonical repository URL and corrected installation command.
- Changed Markdown fence and local-link checks passed.
- Item and operational spec validation passed.
- `git diff --check` passed.
- Runtime tests were not run because runtime behavior did not change.

## Retained, reverted, or transferred work

- All planned documentation changes were retained.
- No work was reverted or transferred.

## Residual risks

- The supplied GitHub URL was not fetched. It matches the configured Git `origin` and was treated as authoritative.

## Follow-up work items

- None.

## Source references

- `README.md`
- `spec/index.md`
- User-supplied canonical repository URL.

## Wiki updates

- None. The change does not alter durable architecture or operating guidance.
