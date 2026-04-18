# Run Map-Interaction Tests on the Linux CI Runner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `test.skip(skipInCI, ...)` guard in `e2e/map-and-countries.spec.ts` and get all 7 map-interaction tests running and passing on GitHub's Linux runner, so CI goes from 44/51 (+ 7 skipped) to 51/51 green.

**Architecture:** The actual skip is a runtime guard at the top of `map-and-countries.spec.ts`, not the Playwright project config. The existing `chromium-gpu` project (`--use-gl=angle --use-angle=default`) already runs `map-reliability.spec.ts` successfully in CI — including the "degraded-mode banner" test which requires MapLibre to fully initialize. That's proof the ANGLE config handles MapLibre on Linux runners without a real GPU. Approach: remove the skip guard, leave the Playwright project structure untouched, fix any residual timing races that only surface under software rendering. No gamble on untested SwiftShader-for-MapLibre behavior.

**Tech Stack:** Playwright (`@playwright/test` 1.59), MapLibre GL (WebGL2), Chromium ANGLE on Linux headless, GitHub Actions Ubuntu runner.

**Scope out of this plan:** Collapsing the chromium / chromium-gpu project split (separate, lower-priority cleanup), pixel-snapshot testing, self-hosted runners with real GPU, stubbing MapLibre with a mock.

---

## File Structure

**Files to modify:**
- `e2e/map-and-countries.spec.ts` — remove the `skipInCI` guard; if investigation exposes timing races, replace fixed `waitForTimeout` calls with deterministic polls

**Files NOT modified:**
- `playwright.config.ts` — the two-project split is intentional in this plan; the chromium-gpu config is the proven-working path for MapLibre on Linux CI
- `e2e/map-reliability.spec.ts` — already passes in CI, unchanged
- `src/components/WorldMap.tsx` — production code is not under test; if a hidden race cannot be fixed from the test side, stop and ask before adding `data-*` hooks

---

## Pre-flight

- [ ] **Step 0.1: Confirm CI baseline**

Run:
```bash
cd E:/polworldmap && git log -1 --oneline
gh run list --repo GranatenUdo/funworldmap --limit 1 --workflow=CI --json conclusion --jq '.[0]'
```

Expected: latest CI run is `{"conclusion":"success"}`. If it's failing for unrelated reasons, fix that first — don't stack investigations.

- [ ] **Step 0.2: Confirm the skip is where the plan claims it is**

Run:
```bash
sed -n '6,10p' e2e/map-and-countries.spec.ts
```

Expected output (approximately):

```ts
test.setTimeout(60000)

// Skip in CI where GPU is unavailable — these require real WebGL2 rendering
const skipInCI = !!process.env.CI
test.skip(skipInCI, 'Map interaction tests require GPU — run locally')
```

If the lines don't match, re-read the full file and adjust line numbers in later tasks before proceeding.

- [ ] **Step 0.3: Confirm evidence for the working backing config**

Run:
```bash
gh run view --repo GranatenUdo/funworldmap --log $(gh run list --repo GranatenUdo/funworldmap --limit 1 --workflow=CI --json databaseId --jq '.[0].databaseId') 2>&1 | grep -E "map-reliability.*passed|chromium-gpu" | head -6
```

Expected: at least one line showing a `map-reliability` test passing in the `chromium-gpu` project. This is the evidence the plan rests on. If no matching lines appear, STOP — the premise of the plan (that the chromium-gpu config handles MapLibre on CI) is not confirmed and this plan needs to be revised before execution.

---

## Task 1: Probe — do the skipped tests pass as-is on CI?

**Files:** `e2e/map-and-countries.spec.ts` (temporarily; reverted at end of task)

**Rationale:** The skip guard predates any actual measurement. Before building a fix, confirm there's a problem to fix. Disable the guard locally under `CI=1`, run the 7 tests, and record the actual failure modes (if any). Everything downstream is conditional on what this task finds.

The probe uses a stash for clean revert — no risk of leaving a disarmed skip in a commit.

- [ ] **Step 1.1: Temporarily disable the skip**

Modify `e2e/map-and-countries.spec.ts` lines 8–9. Current:

```ts
const skipInCI = !!process.env.CI
test.skip(skipInCI, 'Map interaction tests require GPU — run locally')
```

Change to (keep line count stable for clean diff):

```ts
const skipInCI = false
test.skip(skipInCI, 'probe — not committed')
```

- [ ] **Step 1.2: Run the 7 tests under `CI=1` with the existing chromium-gpu config**

Run:
```bash
CI=1 npx playwright test map-and-countries.spec.ts --project=chromium-gpu --reporter=list
```

Expected outcomes, in order of likelihood:

- **All 7 pass.** The skip guard was simply stale. Stash the probe, proceed to Task 2 and commit only the skip-removal.
- **1–3 fail with timing-related errors** (queryRenderedFeatures returning empty, cursor still `grab` instead of `pointer`, hash unchanged after click). Note the failing test names and error types. Proceed to Task 2, then Task 3 for the specific failures.
- **≥4 fail or `waitForMapReady` times out.** Something bigger than timing — MapLibre may be slower under ANGLE locally than in CI, or your local graphics driver is interfering. Proceed to Task 4 (escape hatch).

Record the exact failure set before moving on. Keep the output; you'll reference it in Task 3.

- [ ] **Step 1.3: Stash the probe (don't commit)**

Run:
```bash
git stash push -m "probe: disable skipInCI" -- e2e/map-and-countries.spec.ts
```

Verify the working tree is clean:
```bash
git diff e2e/map-and-countries.spec.ts
```
Expected: no output.

---

## Task 2: Remove the skip guard

**Files:**
- Modify: `e2e/map-and-countries.spec.ts`

**Rationale:** This is the whole plan if Task 1 showed all 7 passing. Even if some failed, the guard removal is the right baseline — per-test fixes go on top of it (Task 3). The commit is intentionally small so a revert is trivial.

- [ ] **Step 2.1: Restore the probe and keep it**

Run:
```bash
git stash pop
```

Expected: `e2e/map-and-countries.spec.ts` now has `const skipInCI = false`.

- [ ] **Step 2.2: Delete the probe wrapping entirely**

Modify `e2e/map-and-countries.spec.ts`. Current lines 7–9 (from the probe):

```ts
// Skip in CI where GPU is unavailable — these require real WebGL2 rendering
const skipInCI = false
test.skip(skipInCI, 'probe — not committed')
```

Delete all three lines. The resulting file should go straight from `test.setTimeout(60000)` on line 5 to the first `test.describe(...)` on line 16 (formerly) without the skipInCI block.

- [ ] **Step 2.3: Run the full map-and-countries suite locally under `CI=1`**

Run:
```bash
CI=1 npx playwright test map-and-countries.spec.ts --project=chromium-gpu
```

Expected outcome mirrors Task 1.2 — if all 7 pass, proceed to Step 2.4. If some still fail, that's Task 3's territory; proceed to Task 3 first, then Step 2.4 after the fixes land.

- [ ] **Step 2.4: Commit the skip removal**

```bash
git add e2e/map-and-countries.spec.ts
git commit -m "test(ci): remove skipInCI guard on map-interaction tests

The guard was added defensively when ANGLE behavior on headless Linux
was uncertain. The chromium-gpu Playwright project config
(--use-gl=angle --use-angle=default) has been proven in CI via
map-reliability.spec.ts's 'degraded-mode banner' test, which requires
MapLibre to fully initialize. Remove the guard; the 7 tests now run."
```

---

## Task 3: Fix per-test races under ANGLE-on-Linux (only if Task 1.2 or 2.3 found failures)

**Files:**
- Modify: `e2e/map-and-countries.spec.ts`

**Rationale:** These tests were written against hardware-accelerated ANGLE. On Linux CI, ANGLE falls back to a software path; it works, but it's slower. Fixed waits like `waitForTimeout(1000)` calibrated for GPU can be short. Replace with deterministic polls on the actual observable.

The sub-steps below are **keyed to observed failures from Task 1.2**, not speculative. Don't apply a sub-step unless the corresponding test actually failed. Each sub-step is standalone — apply, verify, continue.

**General pattern to apply when a test fails with timing:** replace the post-action `waitForTimeout(N)` with `expect.poll(() => <observable>)` — where `<observable>` is the exact state change the test then asserts (hash, cursor, filter, panel). Examples in each sub-step below.

- [ ] **Step 3.1: Generic template — use when adapting**

If a failing test ends with this shape:

```ts
await page.someAction()
await page.waitForTimeout(1000)
const x = await page.evaluate(() => ...)
expect(x).toBe(...)
```

Rewrite as:

```ts
await page.someAction()
await expect.poll(() => page.evaluate(() => ...), { timeout: 5_000 }).toBe(...)
const x = await page.evaluate(() => ...)
```

Keep the subsequent `const x = ...` line if later assertions or logs need the value. The poll replaces the blind wait with a bounded loop that exits as soon as the condition holds.

- [ ] **Step 3.2: `clicking a country sets URL hash and opens panel` (if this failed)**

Around line 122–127 of the file. Find:

```ts
    await page.mouse.click(clicked!.x, clicked!.y)
    await page.waitForTimeout(1000)

    // Hash should be set (some 3-letter country code)
    const hash = await page.evaluate(() => window.location.hash)
    expect(hash).toMatch(/^#[A-Z]{3}$/)
```

Replace with:

```ts
    await page.mouse.click(clicked!.x, clicked!.y)

    // Wait for the hash to pick up the selection.
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toMatch(/^#[A-Z]{3}$/)
    const hash = await page.evaluate(() => window.location.hash)
```

Run:
```bash
CI=1 npx playwright test map-and-countries.spec.ts --project=chromium-gpu --grep "clicking a country sets URL hash"
```
Expected: PASS.

- [ ] **Step 3.3: `clicking ocean deselects country and closes panel` (if this failed)**

Around line 163–189. Two waits to replace.

First, around line 163–168:

```ts
    await page.mouse.click(countryPoint!.x, countryPoint!.y)
    await page.waitForTimeout(1500)

    // Verify a country is now selected
    const hashAfterSelect = await page.evaluate(() => window.location.hash)
    expect(hashAfterSelect).toMatch(/^#[A-Z]{3}$/)
```

Replace with:

```ts
    await page.mouse.click(countryPoint!.x, countryPoint!.y)

    // Verify a country is now selected
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toMatch(/^#[A-Z]{3}$/)
    const hashAfterSelect = await page.evaluate(() => window.location.hash)
```

Second, around line 186–193:

```ts
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.waitForTimeout(1000)

    // Hash should be cleared
    const hash = await page.evaluate(() => window.location.hash)
    expect(hash).toBe('')
```

Replace with:

```ts
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

    // Hash should be cleared
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toBe('')
    const hash = await page.evaluate(() => window.location.hash)
```

Run:
```bash
CI=1 npx playwright test map-and-countries.spec.ts --project=chromium-gpu --grep "clicking ocean"
```
Expected: PASS.

- [ ] **Step 3.4: `GeoJSON features have valid IDs in properties` (if this failed)**

Around line 40–45. The `await page.waitForTimeout(2000)` is a blind wait for tiles to render — under software ANGLE it can be too short. Replace with MapLibre's own settled signal.

Find:

```ts
    await page.goto('/')
    await waitForMapReady(page)

    // Wait for tiles to render
    await page.waitForTimeout(2000)
```

Replace with:

```ts
    await page.goto('/')
    await waitForMapReady(page)

    // Wait for MapLibre to settle (all in-flight renders + data loads done)
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const map = (window as unknown as Record<string, unknown>).__funworldmap_map as {
          loaded: () => boolean
          once: (event: string, fn: () => void) => void
        }
        if (map.loaded()) resolve()
        else map.once('idle', () => resolve())
      })
    })
```

Run:
```bash
CI=1 npx playwright test map-and-countries.spec.ts --project=chromium-gpu --grep "valid IDs"
```
Expected: PASS.

- [ ] **Step 3.5: `hovering over a country changes cursor to pointer` (if this failed)**

Around line 266–275. The chain `mouseMove → MapLibre mousemove handler → setFeatureState → cursor update` can take longer than 500ms under software rendering.

Find:

```ts
    await page.mouse.move(point!.x, point!.y)
    await page.waitForTimeout(500)

    // Canvas cursor should be 'pointer'
    const cursor = await page.evaluate(() => {
      const canvas = document.querySelector('.maplibregl-canvas') as HTMLCanvasElement
      return canvas?.style.cursor
    })
    expect(cursor).toBe('pointer')
```

Replace with:

```ts
    await page.mouse.move(point!.x, point!.y)

    // Poll for cursor change rather than a blind 500ms wait.
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (document.querySelector('.maplibregl-canvas') as HTMLCanvasElement | null)?.style
              .cursor ?? '',
          ),
        { timeout: 5_000 },
      )
      .toBe('pointer')
```

Run:
```bash
CI=1 npx playwright test map-and-countries.spec.ts --project=chromium-gpu --grep "hovering over a country"
```
Expected: PASS.

- [ ] **Step 3.6: `invalid hash is cleared and no panel shown` (if this failed)**

Around line 225–229:

```ts
    await page.goto('/#INVALID')
    await page.waitForTimeout(1000)

    const hash = await page.evaluate(() => window.location.hash)
    expect(hash).toBe('')
```

Replace with:

```ts
    await page.goto('/#INVALID')
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toBe('')
    const hash = await page.evaluate(() => window.location.hash)
```

Run:
```bash
CI=1 npx playwright test map-and-countries.spec.ts --project=chromium-gpu --grep "invalid hash"
```
Expected: PASS.

- [ ] **Step 3.7: Re-run the whole map-and-countries suite**

```bash
CI=1 npx playwright test map-and-countries.spec.ts --project=chromium-gpu
```
Expected: 7/7 pass.

- [ ] **Step 3.8: Commit the timing fixes in one commit**

```bash
git add e2e/map-and-countries.spec.ts
git commit -m "test: replace fixed waitForTimeout calls with observable polls

Under software ANGLE on Linux CI the render pipeline is slower than
hardware-backed ANGLE used locally. Fixed waits calibrated for GPU
timing don't give MapLibre enough time to settle. Replaced each with
expect.poll on the actual post-action observable (hash change, cursor
change, MapLibre idle event). Same semantics, no flake under software
rendering."
```

If Task 1 showed all 7 passing, skip this task entirely — no commit needed.

---

## Task 4: Escape hatch — if ≥4 tests still fail after Task 3 (only if Task 1.2 showed catastrophic failures)

**Files:**
- Potentially modify: `playwright.config.ts` to add `workers: 1` for map-interaction specs only

**Rationale:** SwiftShader/software-ANGLE rendering on a 4-core Linux runner with `workers: 2` means two MapLibre instances rendering concurrently in software — heavy CPU contention. If timing fixes from Task 3 still aren't enough and 4 or more tests remain flaky, drop to serial execution for the map specs specifically. It costs ~30s of walltime but removes contention entirely.

This task is an escape hatch. Do NOT execute it preemptively.

- [ ] **Step 4.1: Check whether failures correlate with worker contention**

Run map tests in isolation, with one worker:

```bash
CI=1 npx playwright test map-and-countries.spec.ts --project=chromium-gpu --workers=1
```

If this passes cleanly where `--workers=2` failed, the problem is CPU contention, not logic — proceed to Step 4.2. If it still fails, the failures are real and this plan cannot complete. Revert the skip-removal commit and open an issue:

```
Title: Map-interaction e2e tests flake on Linux CI even with single-worker software rendering

Body:
After removing the skipInCI guard and applying timing-observable fixes
(see commit <sha>), the following tests remain unstable on GitHub's
Linux runners under chromium-gpu: <list>.

Next steps to consider:
- Provision a self-hosted runner with a real GPU.
- Replace the affected tests with lower-fidelity fixtures that mock
  MapLibre interactions.
- Move the specs to a scheduled workflow that only runs on PRs and
  accepts higher flake tolerance.
```

Then stop — this plan cannot make CI green without one of those changes.

- [ ] **Step 4.2: Scope worker=1 to the map-interaction spec only**

Add a `describe.configure` at the top of `e2e/map-and-countries.spec.ts`, just after the `test.setTimeout(60000)` line:

```ts
test.setTimeout(60000)
test.describe.configure({ mode: 'serial' })
```

`serial` mode forces every test in the file to run sequentially within a single worker, without reducing the CI worker count globally (the DOM spec files still use workers: 2 in CI).

- [ ] **Step 4.3: Verify under `CI=1`**

```bash
CI=1 npx playwright test map-and-countries.spec.ts --project=chromium-gpu
```
Expected: 7/7 pass.

- [ ] **Step 4.4: Run the full suite to confirm no regression elsewhere**

```bash
CI=1 npx playwright test
```
Expected: 51/51 pass.

- [ ] **Step 4.5: Commit**

```bash
git add e2e/map-and-countries.spec.ts
git commit -m "test: force serial execution for map-interaction specs on CI

Two MapLibre instances rendering concurrently on a 4-core Linux runner
under software ANGLE create CPU contention that the timing-observable
polls can't absorb. Describe.configure(serial) keeps these 7 tests
single-worker within the file; the other spec files still parallelize."
```

---

## Task 5: Push and verify CI

**Files:** none modified.

**Rationale:** Confirm the Linux runner actually runs and passes what passes locally. Measure walltime impact.

- [ ] **Step 5.1: Push**

```bash
git push
```

Expected: push succeeds; CI workflow triggers automatically.

- [ ] **Step 5.2: Watch the CI run**

```bash
gh run watch --repo GranatenUdo/funworldmap --exit-status
```

Expected: exits 0.

- [ ] **Step 5.3: Confirm test counts**

```bash
gh run view --repo GranatenUdo/funworldmap --log $(gh run list --repo GranatenUdo/funworldmap --limit 1 --workflow=CI --json databaseId --jq '.[0].databaseId') 2>&1 | grep -E "passed|skipped|failed" | tail -5
```

Expected output includes a line like `51 passed (Xm Ys)` and NO `skipped` line — or, if Task 4 was invoked, still `51 passed` with no skips.

If the count is still `44 passed ... 7 skipped`, the skip-removal commit isn't on `origin/main`. Check `git log --oneline origin/main` and re-push if needed.

- [ ] **Step 5.4: Check walltime regression**

```bash
gh run list --repo GranatenUdo/funworldmap --limit 3 --workflow=CI --json displayTitle,updatedAt,createdAt --jq '.[] | {title: .displayTitle, duration_s: (((.updatedAt | fromdateiso8601) - (.createdAt | fromdateiso8601)))}'
```

Expected: the new run is slower than the prior baseline (~3m39s) but by no more than ~90s. Seven extra tests running serially within the chromium-gpu project under software ANGLE could plausibly add up to 60–90s; more than that suggests one test has a runaway wait that should be investigated.

If Task 4 was invoked (`mode: 'serial'`), walltime may grow by another 20–30s — still fine.

---

## Wrap-up

- [ ] **Step W.1: Save a project memory so future sessions don't relitigate this**

Append (or write) a `project` memory:

```
name: map-interaction tests on CI
description: Why the skipInCI guard was removed and under what config these tests run
type: project

The 7 tests in e2e/map-and-countries.spec.ts run under chromium-gpu
(--use-gl=angle --use-angle=default) on GitHub's Linux runner as of
2026-04-17. The previous test.skip(!!process.env.CI) guard was removed
after confirming via map-reliability.spec.ts that ANGLE's software
fallback on headless Linux handles MapLibre's full init. If these tests
start flaking in CI, suspect software-render timing first — replace any
waitForTimeout with expect.poll on the actual observable. If the entire
file falls over, check whether map-reliability also fails; if both do,
Chromium's ANGLE software path has regressed on the runner image and
the escape hatch is --workers=1 or describe.configure({ mode: 'serial' }).
```

- [ ] **Step W.2: Follow-up ideas (not in scope)**

Optional issues to file for later:

1. **Collapse the chromium / chromium-gpu Playwright project split** — a separate, lower-priority cleanup. Would require proving that `--use-gl=swiftshader` handles MapLibre the same way `--use-gl=angle --use-angle=default` does. Today we have no evidence it does.
2. **Add Lighthouse CI** on pushes to main — tracks bundle-size regressions and perf scores over time.
3. **Visual-regression snapshots** for `#FRA`, `#DEU`, `#JPN` — now that the map renders in CI, screenshot comparisons would catch unintended rendering changes.
4. **Self-hosted Linux runner with a real GPU** — only worth it if CI time becomes a bottleneck or GPU-specific test scenarios (WebGL2 extensions, high-perf rendering) become needed.
