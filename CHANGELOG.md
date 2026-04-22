# Changelog

All notable changes to this project are documented in this file.

## [1.1.0] - 2026-04-22

### Added
- Single/Bulk add modes with bulk JSON import conflict strategy (overwrite/skip).
- Select mode with batch copy/export/delete and select-all for filtered results.
- Storage change watcher with add/update/delete transient highlight feedback.
- 10-second Undo flow for delete, clear, and overwrite operations.
- `undo-controller` module for isolated undo registration/application.
- `telemetry-service` module for centralized event tracking pipeline.
- `CHANGELOG.md` for release-oriented documentation.

### Changed
- Popup logic refactored to reduce `popup.js` responsibility via controller/service extraction.
- Watch loop upgraded to dynamic backoff:
  - active interaction: 1s polling
  - idle window: 4s polling
  - only runs when popup is visible and active tab context is valid.
- Added async data request sequencing guard to prevent stale watcher/load results from overriding newer state.
- Undo plans now prefer operation-delta rollback (set/remove keys) and use full replace only for clear-all restore.
- README and README.en updated with latest feature set and highlights.

