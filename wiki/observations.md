# Workflow observations

Tentative, action-oriented workflow improvements retained for later validation. These observations are not implementation authority.

## Browser-extension planning

- **Target:** browser-extension planning through `spec/AGENTS.md`
  - **Smallest proposed change:** Before a browser-extension item reaches `planned`, require one bounded live smoke test in every guaranteed browser for gesture-granted permissions and browser-dependent capabilities named in acceptance.
  - **Evidence:** [whole-lifecycle retrospective](./dreams/retrospectives/260916-1901-pi-web-annotator.md#whole-lifecycle-retrospective) and refinements R001-R003, which replaced action authorization, save capability, and browser-support assumptions after live Brave use.
  - **Expected benefit:** Prevent unsupported browser/API assumptions from producing repeated replacement Currents while preserving ordinary planning scope for changes without browser-dependent contracts.
