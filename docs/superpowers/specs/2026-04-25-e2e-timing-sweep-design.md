# e2e timing sweep — design

**Date:** 2026-04-25
**Author:** Tobias Ens (with Claude)
**Status:** Spec — pending implementation plan

## Summary

The Playwright e2e suite has chronic flakiness on GitHub Actions' `chromium-gpu` project (software ANGLE renderer, ~3-5× slower than hardware GPU). Multiple runs across `main`, PR #19, PR #20, and PR #21 have shown the same handful of tests fail intermittently with timeouts: `map-and-countries` deselect, `game-country-pinning` Continue/Play-again/wrong-guesses, `keyboard-map-nav` focus, plus a `launcher` flake on the `chromium` project.

The flakes are not seven independent bugs — they share a single style anti-pattern: **arbitrary `waitForTimeout(N)` delays followed by assertions with default 5 s polling**. On hardware GPU the delays are ample; on software ANGLE every operation is 5× slower and the budgets blow.

This sweep attacks the style problem at its root:

1. **Foundation.** Per-project + CI-aware timing defaults in `playwright.config.ts`. The slow `chromium-gpu` project gets generous defaults (120 s test budget, 15 s assertion polling, 20 s action timeout) under CI; locally, defaults stay tight for fast feedback.
2. **Spec sweep.** Replace every `waitForTimeout(N)` in the 8 chromium-gpu spec files with a state-based wait (`expect.poll`, `waitForFunction`, or assertion-with-explicit-timeout). Aggressive — even tests that aren't currently flaky.
3. **Verification.** Three consecutive green CI runs before merge.

Total surface: ~30 LOC in `playwright.config.ts`, ~50-100 LOC across 8 spec files. No production code changes.

## Goals & non-goals

**Goals**
- Eliminate the seven currently-known flakes by removing their root-cause style.
- Establish a consistent state-based-wait pattern across all chromium-gpu specs so future tests inherit reliability.
- Make local dev-loop assertions snappy (5 s defaults) while CI gets headroom (15 s).

**Non-goals**
- Fix the chromium-project `launcher` flake (`launcher does NOT re-show launcher`). The new global `expect.timeout: 10_000` may soften it; if not, follow-up.
- Touch e2e specs that are NOT in chromium-gpu's `testMatch` (search, accessibility, daily-* etc.). They aren't currently flaking and are out of scope.
- Revisit the test-seam architecture from PR #19 (`__funworldmap_*` window globals).
- Add new test seams. The deselect test stays on the real click path.

## Branch & PR

- **Branch:** `fix/e2e-timing-sweep` off latest `origin/main` at `2c2602a`.
- **PR title:** `test(e2e): per-project + CI-aware timeouts; replace waitForTimeout with state-based waits`.
- **Two commits:**
  1. `chore(e2e): per-project + CI-aware timing defaults`
  2. `test(e2e): replace waitForTimeout with state-based waits in chromium-gpu specs`

After this PR merges, PR #21 (the targeted `map-and-countries deselect` timeout-bump) should be closed — the foundation defaults plus the per-spec sweep cover the same ground PR #21 was attacking, more cleanly.

This branch is independent of PR #19 (the security-hardening PR). Order of operations:
1. Land this PR.
2. Rebase PR #19 onto new `main`. PR #19's CI should now be reliably green.
3. Merge PR #19.

---

## Item 1 — Foundation: per-project + CI-aware timing defaults

### Where
`playwright.config.ts` — currently 102 lines, mostly per-project `testMatch` arrays and one `webServer` block. The new code adds project-level `timeout` / `expect.timeout` / `actionTimeout` overrides.

### What
Detect CI via `process.env.CI` (already used at `playwright.config.ts:6-7`). Set tighter defaults locally and generous defaults in CI for the slow `chromium-gpu` project. `chromium`, `mobile-*`, and `desktop-firefox-touch` projects use the global defaults — they're fast enough.

### Code shape
```ts
const slow = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'html',
  // Global defaults — fit most tests.
  timeout: 60_000,
  expect: { timeout: slow ? 10_000 : 5_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    permissions: ['clipboard-read', 'clipboard-write'],
    actionTimeout: slow ? 15_000 : 5_000,
  },
  projects: [
    {
      name: 'chromium',
      // No project-level overrides — global defaults are fine.
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--use-gl=swiftshader'] },
      },
      testMatch: [/* unchanged */],
    },
    {
      name: 'chromium-gpu',
      // Software ANGLE renderer ~3-5× slower than hardware GPU under CI.
      // Bump test budget and per-assertion polling so slow renders don't trip.
      timeout: slow ? 120_000 : 60_000,
      expect: { timeout: slow ? 15_000 : 5_000 },
      use: {
        ...devices['Desktop Chrome'],
        actionTimeout: slow ? 20_000 : 5_000,
        launchOptions: { args: ['--use-gl=angle', '--use-angle=default'] },
      },
      testMatch: [/* unchanged */],
    },
    {
      name: 'mobile-chromium',
      // Pixel 7 emulation — moderate speed; global defaults work.
      use: {
        ...devices['Pixel 7'],
        launchOptions: { args: ['--use-gl=angle', '--use-angle=default'] },
      },
      testMatch: [/* unchanged */],
    },
    {
      name: 'mobile-webkit',
      use: {
        ...devices['iPhone 14'],
        permissions: [],
      },
      testMatch: [/* unchanged */],
    },
    {
      name: 'desktop-firefox-touch',
      use: {
        defaultBrowserType: 'firefox',
        viewport: { width: 412, height: 839 },
        hasTouch: true,
        userAgent: '...',
        permissions: [],
      },
      testMatch: [/* unchanged */],
    },
  ],
  webServer: { /* unchanged */ },
})
```

### Effect
- Locally (no `CI` env var): tests run with 5 s assertion polling, 5 s action timeout, 60 s test budget. Snappy fail-fast feedback.
- CI: chromium-gpu tests run with 15 s assertion polling, 20 s action timeout, 120 s test budget.
- Existing per-test `test.setTimeout(60000)` declarations are now no-ops (the global default already is 60 s; the project default for chromium-gpu is 120 s under CI). Test files can drop them.

### Tests
The foundation itself doesn't get a unit test — it's config. Verification is the chromium-gpu suite running green on CI after the foundation lands (before the spec sweep).

---

## Item 2 — Spec sweep: replace `waitForTimeout(N)` with state-based waits

### Where
8 spec files in `chromium-gpu`'s `testMatch`:
- `e2e/map-and-countries.spec.ts`
- `e2e/map-reliability.spec.ts`
- `e2e/keyboard-map-nav.spec.ts`
- `e2e/game-country-pinning.spec.ts`
- `e2e/game-city-guessing.spec.ts`
- `e2e/compare-view-dimming.spec.ts`
- `e2e/reveal-animation.spec.ts`
- `e2e/reveal-animation-reduced-motion.spec.ts`

### What
Replace every `waitForTimeout(N)` call with a state-based wait. Five patterns cover the full set of cases — Patterns 1-2 are the bulk; Patterns 3-5 are surgical for specific tests.

### Pattern 1 — click → fixed wait → assertion ⇒ click → assertion-with-timeout

```ts
// Before
await page.click('#btn')
await page.waitForTimeout(1000)
await expect(page.getByTestId('result')).toBeVisible()

// After
await page.click('#btn')
await expect(page.getByTestId('result')).toBeVisible()
// Timeout comes from expect.timeout (15 s in chromium-gpu under CI).
```

### Pattern 2 — multi-step game flow ⇒ per-iteration state sync

```ts
// Before (game-city-guessing.spec.ts:134 style)
for (let i = 0; i < 10; i++) {
  await setRoundAndWait(page, 'FRA-paris', 'Paris')
  await skipViaHook(page)
  // implicit reliance on auto-advance timing
}

// After
for (let i = 0; i < 10; i++) {
  await setRoundAndWait(page, 'FRA-paris', 'Paris')
  await skipViaHook(page)
  // Wait for round to actually transition before the next iteration.
  await expect.poll(
    () => page.evaluate(() => window.__funworldmap_game?.getSession?.().status),
    { timeout: 5_000 },
  ).toBe('round-ended')
}
```

### Pattern 3 — animation-heavy test that isn't about the animation: reduced-motion

The `game-city-guessing.spec.ts:134 'ten rounds end the game'` test loops `setRoundAndWait + skipViaHook` 10 times. Each iteration includes a reveal animation (600-1200 ms) plus auto-advance. On software ANGLE under CI, ~5× slower → 3-6 s per round of pure animation × 10 = 30-60 s of animation time alone. The test verifies the *game-flow* ends after 10 rounds; it does NOT verify the animation itself.

Bypass the animation tax with `page.emulateMedia({ reducedMotion: 'reduce' })` at the start of the test. The reveal animation's reduced-motion branch (already implemented in `GameController.tsx`) writes the full arc instantly, and auto-advance still fires. Same coverage, no animation budget.

```ts
// Before
test('ten rounds end the game', async ({ page }) => {
  test.setTimeout(120_000)
  await openCityGuessing(page)
  for (let i = 0; i < 10; i++) {
    await setRoundAndWait(page, 'FRA-paris', 'Paris')
    await skipViaHook(page)
  }
  await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
})

// After
test('ten rounds end the game', async ({ page }) => {
  // Reduced-motion bypasses the per-round reveal animation. The test verifies
  // game-flow termination, not animation behaviour.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openCityGuessing(page)
  for (let i = 0; i < 10; i++) {
    await setRoundAndWait(page, 'FRA-paris', 'Paris')
    await skipViaHook(page)
  }
  await expect(page.getByTestId('game-over')).toBeVisible()
  // test.setTimeout removed — chromium-gpu's project default of 120 s under CI is sufficient.
})
```

Apply the same pattern to other animation-heavy tests in `game-country-pinning.spec.ts` IF the test isn't specifically about the animation.

### Pattern 4 — `map-and-countries deselect` specifically

```ts
// Before
await page.mouse.click(boxCenter.x, boxCenter.y)
await page.waitForTimeout(1000)
const hash = await page.evaluate(() => window.location.hash)
expect(hash).toBe('')
await expect(panel).not.toBeAttached()

// After
await page.mouse.click(boxCenter.x, boxCenter.y)
await expect.poll(
  () => page.evaluate(() => window.location.hash),
  { timeout: 10_000 },
).toBe('')
await expect(panel).not.toBeAttached()
// expect.timeout (15 s) covers the React re-render flush.
```

### Pattern 5 — `map-and-countries deselect` `jumpTo`+idle dance

The test uses a `Promise` that resolves either on MapLibre's `idle` event or a 5 s fallback `setTimeout`. Bump the fallback to 15 s. The fallback is the SAFETY NET, not the happy path — if `idle` never fires, we want to give it real time first.

```ts
// Before
setTimeout(done, 5000)

// After
setTimeout(done, 15_000)
```

### Per-spec inventory
The implementation plan will enumerate every site exactly. The estimates below are from a quick grep and inform the rough scope; the plan reads each file in detail.
- `map-and-countries.spec.ts`: ~4 `waitForTimeout` sites + Pattern 4 + Pattern 5
- `map-reliability.spec.ts`: ~2 sites
- `keyboard-map-nav.spec.ts`: ~2 sites
- `game-country-pinning.spec.ts`: ~5 sites; some tests may benefit from Pattern 3 (reduced-motion)
- `game-city-guessing.spec.ts`: Pattern 3 for the `ten rounds end the game` test; ~2 other `waitForTimeout` sites
- `compare-view-dimming.spec.ts`: ~2 sites
- `reveal-animation.spec.ts`, `reveal-animation-reduced-motion.spec.ts`: 0 `waitForTimeout` sites (cleaned up in PR #18); these tests ARE about the animation so Pattern 3 doesn't apply

Estimated total touch surface: ~17 `waitForTimeout` replacements + 1-3 reduced-motion additions. Each change is mechanical.

### Drop redundant `test.setTimeout` declarations
After the foundation lands, per-test `test.setTimeout(60_000)` declarations that just match the global default are noise. Remove them where they're equal to or smaller than the new project default.

---

## Item 3 — Verification: three consecutive green CI runs

### Acceptance criterion
Three consecutive runs on the `fix/e2e-timing-sweep` branch must show:
- ✅ `lint + type + unit`
- ✅ `e2e (chromium)`
- ✅ `e2e (chromium-gpu)`
- ✅ `Merge e2e reports`

### How to obtain the three runs
1. First run: triggered by the initial push.
2. Second run: `gh run rerun --failed` on the same PR (re-runs only the e2e jobs, not lint).
3. Third run: another `gh run rerun --failed`, OR push an empty commit to retrigger the full pipeline.

If any run fails on a NEW flake (not in the seven we've documented), document it in the PR body and decide whether it's blocking or not. The bar is "kill the seven known flakes," not "every conceivable flake is dead."

### What if it doesn't pass three times?
- One green + two red across three runs: investigate which test is still flaking. Apply pattern 1/2/3 specifically. Re-verify.
- Two green + one red: check whether the red was a NEW test (out-of-scope) or a known flake. If known, the sweep didn't fully kill it — re-investigate.
- Three reds: serious problem. Stop, re-evaluate the design.

---

## Risks

- **Risk 1: the sweep changes test reliability characteristics; we might mask a real bug.** Mitigation: every replacement preserves the *intent* of the original assertion. A 1 s wait that was hiding a 200 ms animation becomes a 5 s `toBeVisible` polling — same behaviour.
- **Risk 2: pattern 2 (per-iteration sync) requires the test seams to be exposed.** The seams are currently exposed always-on; PR #19 (still pending merge) gates them behind `VITE_TEST_HOOKS`. This PR branches off `main` (without PR #19's gating), so seams are always-on. After PR #19 lands, seams are gated to the e2e build, which is what Playwright already uses. No interaction.
- **Risk 3: `expect.poll` with a fast poll interval can hammer the page.** Mitigation: default poll interval is 100 ms which is fine; we can bump to 500 ms for `page.evaluate`-based polls if it surfaces.
- **Risk 4: chromium-gpu becomes "slow by default" so even healthy tests now wait 20 s before failing.** Mitigation: tests pass when state arrives, not when timeout expires. Slow defaults only matter when something is genuinely broken.

---

## Out of scope (deferred)

- The chromium-project `launcher does NOT re-show launcher` flake. May be fixed by the new `expect.timeout: 10_000` global; if not, it's a follow-up.
- The mobile-chromium / mobile-webkit / desktop-firefox-touch projects. They use global defaults. If flakes surface there later, this same pattern can be applied.
- Replacing `waitForTimeout` calls in `e2e/helpers.ts` shared utilities. Out of scope unless a flake traces to one.
- Pure-DOM assertion improvements (e.g., `expect(...).toBeFocused()` → `expect.poll(activeElement)`). Only if a focus assertion is in the failing-test list.
