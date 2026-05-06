# Flake-watch tracking — PR #36

Tracks the 5-consecutive-green acceptance criterion for `docs/superpowers/specs/2026-05-05-flake-triage-design.md` (Phase 4) on branch `feat/vision-audit-remediation`.

Acceptance: 5 consecutive CI runs all-green (chromium e2e + lint+unit + merge-reports).

If we don't reach 5-in-a-row within ~10 total runs, the residual flakes are environmental and the next move is option D (real GPU CI runner) — separate roadmap item.

## Branch state at watch start

Last commit before watch: `8cfb6b7` (`fix(useMapInstance): raise BASEMAP_LOAD_TIMEOUT_MS to 30s for cold CI`).

Phase 1: `1592ecf` + `433fae5` (helpers.ts dismissLauncher Header-attached wait + JSDoc cleanup)
Phase 2 + 3: `8cfb6b7` (BASEMAP_LOAD_TIMEOUT_MS 10s→30s + waitForMapLoaded fast-fail on watchdog)
Phase 4: this watch
Phase 5 (Task 5): NO-OP — Task 1 + prior `c3de935` already addressed panel-focus

## Runs

### Run 1 — 2026-05-05 ~20:25 UTC

- run_id: `25399020741`
- Result: **❌ FAIL** (resets consecutive-green counter to 0)
- Duration: 28m15s
- chromium e2e: **5 failures**
  - `accessibility.spec.ts:189` — axe milestone overlay (`No elements found for include in page Context`)
  - `label-contrast.spec.ts:337` — `page.waitForFunction` timeout 90s. The Task 3 fast-fail helper hit the OUTER 90s timeout, meaning neither `[data-map-loaded]` NOR `[data-map-error="timeout"]` appeared in 90s. Watchdog didn't fire — contradicts the Task 3 hypothesis.
  - `axe-snapshot.spec.ts:89` — in-game HUD axe
  - `reveal-animation.spec.ts:9` — wrong country guess
  - `search.spec.ts:96` — search by capital city
- lint+unit: ✅ pass (1m19s)
- merge-reports: ✅ pass (22s)

**Notes:** the label-contrast failure mode is NEW — the watchdog should have fired at 30s setting `data-map-error="timeout"`, the helper would fast-fail. Instead the OUTER 90s timeout was hit. Either the watchdog never fired OR the page never rendered the map component at all (e.g., an earlier navigation error). Without trace inspection, it's speculation.

The 4 unrelated specs (`accessibility`, `axe-snapshot`, `reveal-animation`, `search`) match the historical "flake-pool" pattern — different selection per run, varying root causes likely environmental.

## Pivot: Option A (Mesa/llvmpipe install + Playwright new headless)

After research into alternatives that work on free GitHub runners, two changes applied to test the hypothesis that the underlying issue is environmental software-rendering slowness:

1. **`.github/workflows/ci.yml`** — added `apt-get install mesa-utils libgl1-mesa-dri libglu1-mesa libegl1` step before Playwright install. ubuntu-latest doesn't ship Mesa/llvmpipe; without them Chromium falls back to its built-in SwiftShader software renderer (5-10× slower than llvmpipe). Per Promaton/Snider 2026-02 research, just having Mesa available gives ~3× speedup on WebGL-heavy tests.
2. **`playwright.config.ts`** — added `channel: 'chromium'` to switch from `chromium-headless-shell` (default; more aggressive about disabling GPU/WebGL) to Playwright v1.49+'s new headless mode, which treats GPU/WebGL handling the same as headed mode.

Both are minimal config changes — no test code touched. If chromium e2e drops from ~28 min to ~10 min and label-contrast stops flaking, hypothesis confirmed and the rest of the watch can resume. If not, evidence for option D (paid GPU runner) is conclusive.

### Run 2 — 2026-05-05 ~21:51 UTC (option A test)

- run_id: `25402952484`
- Result: **❌ FAIL** (option A didn't help)
- Duration: 31m9s (slightly worse than the 28m baseline)
- chromium e2e: **8 failures**, including same `label-contrast.spec.ts:382 light + map view` 90s `waitForFunction` timeout, plus a wider variety of flake-pool specs.

**Conclusion**: neither Mesa/llvmpipe nor `channel: 'chromium'` materially improved CI behavior. The bottleneck is deeper than software-renderer choice OR Playwright headless mode.

## Pivot: Option B (4-way sharding)

After option A failed, switched approach. Hypothesis: the bottleneck is per-job CUMULATIVE time pressure (215 specs × cold-WebGL penalty stacking up), not per-test slowness.

`.github/workflows/ci.yml` modified to shard chromium across 4 parallel matrix jobs via `--shard=N/4`. Mesa install + new headless mode kept (no harm; may help marginally).

### Run 3 — 2026-05-06 ~00:?? UTC (option B / sharding test)

- run_id: `25418049261`
- Result: **✅ PASS** (1st green of the watch)
- Wall-clock: ~13 min (longest shard 2/4 at 12m44s, others 5-9m)
- chromium e2e: ALL 4 SHARDS GREEN

| Job | Duration | Result |
|---|---|---|
| lint + type + unit | 1m11s | ✅ |
| e2e (chromium shard 1/4) | 6m49s | ✅ |
| e2e (chromium shard 2/4) | 12m44s | ✅ |
| e2e (chromium shard 3/4) | 5m1s | ✅ |
| e2e (chromium shard 4/4) | 8m41s | ✅ |
| Merge e2e reports | 22s | ✅ |

**Hypothesis confirmed**. Wall-clock dropped from 28-31 min to ~13 min; label-contrast no longer hit the 90s test timeout. Sharding broke the cumulative-time-pressure pattern that 3 rounds of in-spec / app-config fixes couldn't address.

**Watch counter (consecutive green)**: 1 / 5

