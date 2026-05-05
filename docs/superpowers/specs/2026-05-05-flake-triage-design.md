# Spec: chromium e2e flake triage — 2026-05-05

## Goal

Resolve the residual chromium e2e flakes observed across PR #36's CI runs (2 persistent failures + 5 variable-flake-pool specs) so that `feat/vision-audit-remediation` (or its successor branch) reaches reliably-green CI without resorting to:
- Test rewrites that violate the project's non-flaky e2e rules (`waitForTimeout`, `force: true`, etc.)
- Self-hosted GPU runner (option D — separate roadmap item)
- Increasing retries / blanket timeout bumps as a substitute for diagnosis

## Context

Initial framing assumed the project's residual flakes were from `waitForTimeout` / `force: true` anti-patterns persisting in test specs (per `2026-04-28-flake-regression-analysis.md`). Research before this spec showed that framing is **stale**:

- `grep waitForTimeout e2e/`: **1 occurrence** (`helpers.ts:149`, in `dismissLauncher`)
- `grep "force:\s*true" e2e/`: **0 occurrences**
- `data-animation-state` signals: already implemented on `Launcher.tsx`, `LauncherMilestoneOverlay.tsx`, `SingleCountryPanel.tsx`, with unit-test lifecycle coverage

So tests are already CLAUDE.md-compliant. The flakes have moved into a different category:
1. The single remaining `waitForTimeout` (helpers.ts:149) — last anti-pattern, plausibly racy on CI
2. Specific specs that consistently fail under Software ANGLE on ubuntu-latest, despite being well-written — environmental tightness or real bugs surfaced by CI's slower timing
3. A flake-pool of specs that fail intermittently with no obvious shared cause

The 2026-04-28 analysis prescription "remove anti-patterns" no longer applies; the diagnosis must be evidence-driven per failing test.

## Failures observed (PR #36, three CI runs)

### Persistent (≥ 2 of 3 runs)
- `label-contrast.spec.ts:316` (light + map view) — 3/3 runs. `waitForSelector('[data-map-loaded]')` timeout 90 s.
- `theme-and-responsive.spec.ts:28` — 2/3 runs. Theme toggle click after `dismissLauncher`; `expect.poll` for `dark` class fails.
- `panel-focus.spec.ts:27` — 2/3 runs. `waitForAnimationIdle(panel, 30_000)` times out.

### Variable (1 of 3 runs)
- `done-confirm-low-score.spec.ts:112`
- `game-country-pinning.spec.ts:113` and `:147`
- `daily-puzzle.spec.ts:82`
- `source-tooltip-edge.spec.ts:20`
- `search.spec.ts:84`

### Confirmed not in scope
- Mobile/Firefox failures (already filed as backlog under `docs/roadmap.md` § "Cross-browser CI failures from PR #36")

## Approach: phased fix-and-monitor

Four phases, each independently verifiable. Phases 1-3 land as separate small commits on the existing branch; Phase 4 is observational. Each fix uses 10× local-green at `workers=2 retries=0` as the merge gate (per CLAUDE.md "10× local rule").

### Phase 1 — High-confidence fix: `dismissLauncher` race

**Diagnosis**: `e2e/helpers.ts:149` has the project's only remaining `waitForTimeout(150)`, called inside `dismissLauncher()` after `expect(launcher).not.toBeAttached()`. Comment-implied purpose: wait for the Header to remount (since `Header.tsx` returns null while launcher is visible per Phase 3.2). On CI's 5-10× slower runner, 150 ms can race the Header's remount → subsequent clicks (e.g. `theme-toggle` in `theme-and-responsive.spec.ts:28`) miss because the target isn't in the DOM yet.

**Fix**: replace the `await page.waitForTimeout(150)` with a deterministic state wait on a Header child. The search input (`#search-input`) is mounted only when Header is mounted, so:

```ts
await page.getByTestId('search-input').waitFor({ state: 'attached', timeout: 5_000 })
```

(Or `getByRole('combobox')` etc. — whatever's already canonical in the helper layer.)

**Why this likely fixes `theme-and-responsive.spec.ts:28`**: the failing test calls `dismissLauncher`, then `getByTestId('theme-toggle').click()` × 2. The toggle is in Header. If Header isn't yet remounted when the click fires, Playwright's auto-waiting on the locator may not bridge the gap because the toggle wasn't recently visible — it's "newly attached," subject to actionability checks that include stability.

**Acceptance**: 10× green local on `theme-and-responsive.spec.ts` at `workers=2 retries=0`. CI run on the branch passes that spec.

### Phase 2 — Investigate `label-contrast.spec.ts:316`

**Known**: spec calls `await routeMapTilesRich(page)` + sets light theme + `await page.goto('/')` + `await waitForMapLoaded(page)`. Map never reaches `data-map-loaded` within 90 s on CI; failed all 3 retries in run 2.

**Hypothesis** (unverified): `routeMapTilesRich` is a stub helper. If its URL match patterns don't cover the light-theme positron basemap's tile URLs (different from satellite/dark), MapLibre may wait indefinitely on a tile fetch that's intercepted-and-not-fulfilled.

**Investigation step (required before fix)**: read `e2e/helpers.ts` `routeMapTilesRich` and `routeMapTiles`; compare to the actual URL set the light-positron style requests at runtime. Either:
- Extend the stub to cover all needed URLs
- Drop the stub from this spec entirely (it's measuring paint properties, doesn't need network stubbing)
- Use the simpler `routeMapTiles` if it covers what's needed

**Fallback if investigation surfaces a different cause**: bump `waitForMapLoaded` timeout, but only if the cause is genuine slowness (measured) rather than a stuck request.

**Acceptance**: 10× green local + CI green on the spec. Investigation findings documented in the commit message or a follow-up note.

### Phase 3 — Investigate `panel-focus.spec.ts:27`

**Known**: spec opens panel via search, calls `waitForAnimationIdle(panel, 30_000)`. `SingleCountryPanel.tsx`'s animation-state machine flips `'entering' → 'idle'` via `Promise.all(animations.map(a => a.finished))` with a 1 s `setTimeout` fallback (panel.tsx:99-103). 30 s timeout SHOULD be ample.

**Hypothesis** (unverified): three candidates:
1. The animation-finished effect fires but writes stale state (closure bug)
2. Panel mounts but the effect doesn't run (StrictMode double-mount + `useRef` initialization race)
3. Panel unmounts before the wait completes (interaction with Phase 3.5's mobile reflow's container conditional)

**Investigation step (required before fix)**: pull the Playwright trace from a failed CI run (stored on retry). Check what `data-animation-state` actually IS at the 30 s timeout, what other panel state is visible, whether the effect cleanup ran.

**Possible fixes depending on findings**:
- Stale closure → fix the effect's deps in `SingleCountryPanel.tsx`
- Mount race → harden with a stable mount signal (e.g. don't run the effect until the ref is attached)
- Genuine slowness → bump `waitForAnimationIdle` to 45 s, with a justifying comment citing the measured CI duration

**Acceptance**: 10× green local + CI green.

### Phase 4 — Monitor + respond (no upfront PR)

After Phases 1-3 land:
- Watch 5 consecutive CI runs on the branch.
- For the variable-flake-pool specs: track which (if any) persistently flake. Specs that flake in ≥ 3 of 5 runs get triaged with the same investigate-then-fix pattern.
- Specs that don't recur are presumed environmental noise; not actioned.

**Acceptance**: 5 consecutive runs all-green (chromium e2e + lint+unit). If after 5 runs the flake rate hasn't dropped meaningfully, this spec acknowledges that the residual flakes are environmental and option D (real GPU CI runner) is the next move — outside this spec's scope.

## Out of scope

- Preventive ESLint rule banning `waitForTimeout` / `force: true` — declined upstream
- Self-hosted GPU runner / CI environment changes — separate roadmap item
- Cross-browser CI matrix — deferred per `docs/roadmap.md` § "Cross-browser CI failures from PR #36"
- Adding new e2e tests — explicitly forbidden per user constraint
- Modifying existing tests in ways that introduce flake risk — explicitly forbidden

## Risks and unknowns

1. **Phase 2 and 3 are investigation-prefixed.** Diagnosis may surface real bugs in app code rather than test-rigor issues. If so, fixes land in components, not tests; this is correct per CLAUDE.md but expands the change-set on the PR branch.
2. **Phase 4's "5 consecutive green" criterion may be statistically unreachable** if the variable-flake-pool baseline rate is > ~5%. Backup plan: relax to "8 of 10 green," document the per-spec residual rate, and surface remaining flakes as roadmap items for option D.
3. **Phase 1's hypothesis (Header-remount race) is not yet verified** by reproducing the failure with intentional slow-down. Counter-evidence (the fix doesn't resolve `theme-and-responsive`) would imply a different root cause and require Phase-2-style investigation.
4. **CI environment is not under this spec's control.** GitHub Actions runner allocation failures (one occurred in run 3) are separate from the test code; they show up as job-level failures, not spec failures, and are filed as out-of-band noise.

## Definition of done

- `e2e/helpers.ts` has 0 `waitForTimeout` calls.
- `theme-and-responsive.spec.ts:28`, `label-contrast.spec.ts:316`, `panel-focus.spec.ts:27` each pass 10× consecutively at `workers=2 retries=0` locally.
- 5 consecutive CI runs on the branch all pass chromium e2e (modulo the agreed-out-of-scope GitHub Actions infra failures, which are noted but not gated on).
- If Phase 4's criterion isn't met, this spec produces an artifact (commit, note, or roadmap entry) acknowledging that and pointing at option D.
