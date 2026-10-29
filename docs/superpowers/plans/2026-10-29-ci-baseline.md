# CI baseline prerequisite

Status: implementation prerequisite for the reviewed public-repository improvement plan, 2026-10-29.

## Evidence and change
The budget-only PR #141 runs the unchanged main workflow. Its GitHub-hosted run 40962504443 fails before browser testing because `ubuntu-latest` now resolves to Ubuntu 26.04, unsupported by Playwright 1.59.1. Its type-check step also fails with `tsc: command not found` because it assumes a globally installed compiler.

The reviewed health plan already includes both fixes. Isolate them here so the measurement-only budget PR remains separate and can follow a functioning protected baseline. Pin CI jobs to Ubuntu 24.04 and invoke the existing `npm run typecheck` script. Preserve test selection, retry policy, package versions, permissions, and all other workflow behavior.

## Verification and integration
Inspect the minimal YAML diff and run the actual workflow through this PR. Existing local Node 22 baseline checks passed in the health audit. Merge order is CI baseline → budget (#141) → health (#140) → documentation (#142). No automatic merging or deployment is authorized.
