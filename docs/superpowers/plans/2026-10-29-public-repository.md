# Public Repository Implementation Plan

> Execute inline with superpowers:executing-plans. Preserve progress in the task ledger.

**Goal:** Make the public repository accurate, reproducible, maintained, and welcoming.
**Architecture:** Two sequential reviewable PRs, preserving the static app and optional analytics Worker. GitHub settings are read back after updates; merge and deployment are separate release actions.
**Tech stack:** React, TypeScript, Vite, MapLibre, Vitest, Playwright, Wrangler, GitHub Actions.
**Spec:** [Accepted design](../specs/2026-10-29-public-repository-design.md).

## Global constraints
Node >=22.22.1 <23. Preserve current checkout, gameplay/UI and historical evidence. New public contact: tobias.ens@proton.me. No force-fix, new quarantines/retries, history rewriting, paid services, or automatic merge/deployment.

## Tasks
- [ ] Health: clean supported-runtime baseline; contact replacement; compatible dependency fixes and MapLibre 6.x migration; Worker CI install/test/dry-run; validate both audits, root checks/budget, map/browser regression tests; open health PR.
- [ ] Documentation: refresh README with actual UI images; contributor setup and docs navigation; correct system/product/operations claims; structured issue forms, support and PR guidance; preserve historical intent.
- [ ] Automation: tested marked/github-slugger local link/anchor/npm-script checker and maintained-doc formatting; weekly/manual external links; Worker Dependabot; pinned supported Actions and minimal permissions; aggregate correctness job and exact-SHA CI/CodeQL deployment gates.
- [ ] GitHub: snapshot settings; set description/homepage/topics and branch cleanup; enable available security features; apply main rules only after exact check names/App observed; read back all settings.
- [ ] Delivery: whole-branch review, appropriate local/CI validation, two PRs and honest remaining limitations. No merge or production release.

## Review focus
Node engine floors and actual hook execution; Worker dependency updates included in required checks; map projection/context recovery and attribution behavior after major migration; skip/failure/stale-SHA deployment gates; historical Markdown code examples excluded from path checks.

## Execution rulings
The second PR is prepared as a dependent draft while PR1 awaits merging; it must be retargeted to main after PR1 lands. This fulfills reviewable delivery without assuming merge authorization. Existing data snapshots are not refreshed as an incidental side effect.

### Final execution packaging

The user approved a separate measured budget PR when patched MapLibre exceeded the old ceilings. MapLibre is pinned exactly to 6.4.1, with worker bytes charged to initial JS and both aggregate totals. The addendum received independent review by the original GPT-6 Astra reviewer.

Hosted testing also exposed two unchanged-main CI assumptions (Ubuntu 26.04 unsupported by Playwright 1.59.1; missing global tsc). The already-planned fixes were isolated as a minimal CI prerequisite, independently checked by the same reviewer as a packaging correction. Final integration order: [CI baseline #143](https://github.com/GranatenUdo/funworldmap/pull/143) → [budget #141](https://github.com/GranatenUdo/funworldmap/pull/141) → [health #140](https://github.com/GranatenUdo/funworldmap/pull/140) → [documentation #142](https://github.com/GranatenUdo/funworldmap/pull/142). No merge or deployment performed.

An independent implementation reviewer found no material defects. Main protection uses existing observed checks until the aggregate workflow reaches main; the post-merge replacement payload and instructions are in the operations runbook.
