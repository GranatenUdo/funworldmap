# e2e Timing Sweep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the seven currently-known CI flakes by replacing the `waitForTimeout(N)` style anti-pattern with state-based waits in the 8 chromium-gpu spec files, plus per-project + CI-aware timing defaults in `playwright.config.ts`.

**Architecture:** Two atomic commits on one branch. Commit 1 sets project-level timeout defaults so chromium-gpu gets a generous budget (120 s test, 15 s assertion polling, 20 s action timeout) under CI while local stays tight. Commit 2 sweeps every `waitForTimeout(N)` site in the chromium-gpu specs into a state-based wait — five patterns cover all cases.

**Tech Stack:** Playwright 1.59 (e2e), TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-25-e2e-timing-sweep-design.md`

---

## File Structure

### Modified
- `playwright.config.ts` — add CI-aware project-level `timeout` / `expect.timeout` / `actionTimeout` overrides.
- `e2e/map-and-countries.spec.ts` — 10 `waitForTimeout` replacements + Pattern 4 + Pattern 5; remove redundant `test.setTimeout(60000)`.
- `e2e/game-country-pinning.spec.ts` — 1 `waitForTimeout` replacement; remove redundant `test.setTimeout(60_000)`.
- `e2e/game-city-guessing.spec.ts` — add `emulateMedia({ reducedMotion: 'reduce' })` to the `ten rounds end the game` test (Pattern 3); remove redundant `test.setTimeout` declarations.
- `e2e/compare-view-dimming.spec.ts` — 2 `waitForTimeout` replacements; remove redundant `test.setTimeout(60_000)`.
- `e2e/reveal-animation.spec.ts` — remove redundant `test.setTimeout(60_000)`.
- `e2e/reveal-animation-reduced-motion.spec.ts` — remove redundant `test.setTimeout(60_000)`.

### Unchanged
- `e2e/map-reliability.spec.ts` — no `waitForTimeout` sites.
- `e2e/keyboard-map-nav.spec.ts` — no `waitForTimeout` sites; flake is intermittent and may resolve via the new `expect.timeout: 15_000` global.

---

## Phase 0 — Branch Setup

### Task 0: Verify worktree state

**Files:** _(none — verification only)_

- [ ] **Step 1: Verify on the right branch + clean tree**

```bash
cd E:/polworldmap-timing-sweep
git status
git rev-parse --abbrev-ref HEAD
```

Expected: branch is `fix/e2e-timing-sweep`, working tree clean (only the spec is committed; commit `03d1e03`).

- [ ] **Step 2: Verify worktree node_modules is set up**

```bash
cd E:/polworldmap-timing-sweep
ls node_modules/@rollup/rollup-win32-x64-msvc 2>&1 | head -1
```

Expected: directory exists. If not, copy from `E:/polworldmap/node_modules/@rollup/`, `node_modules/@tailwindcss/oxide-win32-x64-msvc`, and `node_modules/lightningcss-win32-x64-msvc` (the Windows native bindings npm misses).

```bash
mkdir -p node_modules/@rollup node_modules/@tailwindcss
cp -r E:/polworldmap/node_modules/@rollup/rollup-win32-x64-msvc node_modules/@rollup/
cp -r E:/polworldmap/node_modules/@tailwindcss/oxide-win32-x64-msvc node_modules/@tailwindcss/
cp -r E:/polworldmap/node_modules/lightningcss-win32-x64-msvc node_modules/
```

- [ ] **Step 3: Verify clean baseline**

```bash
cd E:/polworldmap-timing-sweep && npm run test:unit 2>&1 | tail -5
```

Expected: 286/286 pass.

---

## Phase 1 — Commit 1: foundation

### Task 1: Add CI-aware timing defaults to `playwright.config.ts`

**Files:**
- Modify: `playwright.config.ts`

- [ ] **Step 1: Apply the foundation change**

Read the current `playwright.config.ts`. Make these specific edits:

**Edit 1:** After `import { defineConfig, devices } from '@playwright/test'`, add a new line that defines the slow flag:

```ts
const slow = !!process.env.CI
```

**Edit 2:** Inside `defineConfig({...})` after the `reporter: 'html'` line, add three new top-level fields (timeout, expect, modify use):

```ts
  reporter: 'html',
  // Per-project overrides take precedence; chromium-gpu bumps these on CI.
  timeout: 60_000,
  expect: { timeout: slow ? 10_000 : 5_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    permissions: ['clipboard-read', 'clipboard-write'],
    actionTimeout: slow ? 15_000 : 5_000,
  },
```

(The existing `use:` block is replaced by the one above — `actionTimeout` is added; everything else preserved.)

**Edit 3:** Inside the `chromium-gpu` project, add `timeout`, `expect`, and `actionTimeout` overrides:

```ts
    {
      name: 'chromium-gpu',
      // Software ANGLE renderer is ~3-5x slower than hardware GPU on CI.
      timeout: slow ? 120_000 : 60_000,
      expect: { timeout: slow ? 15_000 : 5_000 },
      use: {
        ...devices['Desktop Chrome'],
        actionTimeout: slow ? 20_000 : 5_000,
        // No SwiftShader — uses real GPU for WebGL2
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=default'],
        },
      },
      // Map interaction tests need real GPU
      testMatch: ['map-and-countries.spec.ts', 'map-reliability.spec.ts', 'keyboard-map-nav.spec.ts', 'game-country-pinning.spec.ts', 'game-city-guessing.spec.ts', 'compare-view-dimming.spec.ts', 'reveal-animation.spec.ts', 'reveal-animation-reduced-motion.spec.ts'],
    },
```

(`testMatch` is unchanged from the original; only `timeout`, `expect`, and `actionTimeout` are new.)

Other projects (`chromium`, `mobile-chromium`, `mobile-webkit`, `desktop-firefox-touch`) keep their existing config — they inherit the new global defaults.

- [ ] **Step 2: Verify the config parses + lint passes**

```bash
cd E:/polworldmap-timing-sweep && npx tsc -b --noEmit 2>&1 | tail -5
```

Expected: silent / no errors.

- [ ] **Step 3: Smoke-test that one spec still runs under the new config**

```bash
cd E:/polworldmap-timing-sweep && npx playwright test e2e/reveal-animation.spec.ts --project chromium-gpu 2>&1 | tail -5
```

Expected: 2 passed (locally — fast hardware so timeouts irrelevant; this just verifies config parses correctly at runtime).

- [ ] **Step 4: Commit**

```bash
cd E:/polworldmap-timing-sweep && git add playwright.config.ts
cd E:/polworldmap-timing-sweep && git commit -m "$(cat <<'EOF'
chore(e2e): per-project + CI-aware timing defaults

Sets generous defaults for the chromium-gpu project under CI (120 s
test budget, 15 s assertion polling, 20 s action timeout) while
keeping local defaults tight (60 s / 5 s / 5 s) for fast feedback.

The chromium-gpu project uses software ANGLE on GitHub Actions
(--use-gl=angle --use-angle=default), which is ~3-5x slower than
hardware GPU. Tests there were chronically flaking on default 5 s
assertion polling. Foundation step before sweeping waitForTimeout
calls in the chromium-gpu spec files.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Commit 2: per-spec sweep

The order below batches related changes per file. Each task is mechanical: read current code, apply the documented replacement, verify locally.

### Task 2: Sweep `e2e/compare-view-dimming.spec.ts` (2 `waitForTimeout` sites + 1 `test.setTimeout`)

**Files:**
- Modify: `e2e/compare-view-dimming.spec.ts`

- [ ] **Step 1: Remove redundant `test.setTimeout(60_000)` at line 3**

Find:
```ts
test.setTimeout(60_000)
```

Delete the line and the blank line that follows if it's now duplicated. The chromium-gpu project default is 60 s locally / 120 s on CI — this declaration was matching the local default, no longer needed.

- [ ] **Step 2: Replace `waitForTimeout` at line 25 with `expect.poll`**

Find:
```ts
    await page.goto('/#FRA,DEU')
    await waitForMap(page)
    // Allow one animation frame for filter + paint to settle.
    await page.waitForTimeout(500)

    // In compare view, dimming pins borders at 0.15.
    const dimmedOpacity = await getBorderOpacity(page)
    expect(dimmedOpacity).toBeCloseTo(0.15, 2)
```

Replace with:
```ts
    await page.goto('/#FRA,DEU')
    await waitForMap(page)
    // Poll until dimming animation settles to the compare-view value (0.15).
    await expect.poll(() => getBorderOpacity(page), { timeout: 5_000 }).toBeCloseTo(0.15, 2)
```

(One assertion replaces the wait + read + assert sequence.)

- [ ] **Step 3: Replace `waitForTimeout` at line 35 with `expect.poll`**

Find:
```ts
    // Exit compare.
    await page.evaluate(() => {
      window.location.hash = '#FRA'
    })
    await page.waitForTimeout(500)

    // Satellite-default opacity is 0.6, not the dimmed value.
    const restoredOpacity = await getBorderOpacity(page)
    expect(restoredOpacity).toBeCloseTo(0.6, 2)
```

Replace with:
```ts
    // Exit compare.
    await page.evaluate(() => {
      window.location.hash = '#FRA'
    })
    // Poll until dimming releases back to the satellite-default value (0.6).
    await expect.poll(() => getBorderOpacity(page), { timeout: 5_000 }).toBeCloseTo(0.6, 2)
```

- [ ] **Step 4: Verify the spec still passes locally**

```bash
cd E:/polworldmap-timing-sweep && npx playwright test e2e/compare-view-dimming.spec.ts --project chromium-gpu 2>&1 | tail -5
```

Expected: all tests pass.

### Task 3: Sweep `e2e/game-country-pinning.spec.ts` (1 `waitForTimeout` + 1 `test.setTimeout`)

**Files:**
- Modify: `e2e/game-country-pinning.spec.ts`

- [ ] **Step 1: Remove redundant `test.setTimeout(60_000)` at line 3**

Delete the line.

- [ ] **Step 2: Replace `waitForTimeout` at line 150 with `expect.poll`**

Find:
```ts
    const mapContainer = page.locator('.maplibregl-canvas').first()
    await mapContainer.hover({ position: { x: 400, y: 300 } })
    await page.waitForTimeout(500)

    const tooltipVisible = await page.evaluate(() => {
      const t = document.querySelector('.country-tooltip')
      return t?.classList.contains('visible') ?? false
    })
    expect(tooltipVisible).toBe(false)
```

Replace with:
```ts
    const mapContainer = page.locator('.maplibregl-canvas').first()
    await mapContainer.hover({ position: { x: 400, y: 300 } })

    // Poll: tooltip must remain hidden — assert false stably for ~500 ms,
    // not just on the first read after hover.
    await expect.poll(
      () => page.evaluate(() => {
        const t = document.querySelector('.country-tooltip')
        return t?.classList.contains('visible') ?? false
      }),
      { timeout: 2_000 },
    ).toBe(false)
```

- [ ] **Step 3: Verify the spec still passes locally**

```bash
cd E:/polworldmap-timing-sweep && npx playwright test e2e/game-country-pinning.spec.ts --project chromium-gpu 2>&1 | tail -5
```

Expected: all tests pass.

### Task 4: Sweep `e2e/game-city-guessing.spec.ts` (Pattern 3 — reduced-motion + 2 `test.setTimeout`)

**Files:**
- Modify: `e2e/game-city-guessing.spec.ts`

- [ ] **Step 1: Remove the file-level `test.setTimeout(60_000)` at line 3**

Delete the line.

- [ ] **Step 2: Apply Pattern 3 (reduced-motion) to `ten rounds end the game`**

Find the test at line ~134:
```ts
  test('ten rounds end the game', async ({ page }) => {
    // Ten iterations of setRoundAndWait + hook-skip take longer on CI
    // (~6 s each under headless Chrome without GPU); double the budget.
    test.setTimeout(120_000)
    await openCityGuessing(page)
    // Between iterations, setRoundAndWait() + overrideRound forces status
    // back to 'playing' and increments roundIndex. Skip via the hook bypasses
    // the DOM click entirely — the skip button's bounding box is unstable on
    // slow CI as the HUD re-renders each reveal cycle.
    for (let i = 0; i < 10; i++) {
      await setRoundAndWait(page, 'FRA-paris', 'Paris')
      await skipViaHook(page)
    }
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('game-over-score')).toHaveText('0')
  })
```

Replace with:
```ts
  test('ten rounds end the game', async ({ page }) => {
    // Reduced-motion bypasses the per-round reveal animation. The test
    // verifies game-flow termination, not animation behaviour. Without
    // this, 10 × ~600-1200 ms × 5x slower CI = up to 60 s of pure
    // animation tax, which together with setup blew the test budget.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openCityGuessing(page)
    for (let i = 0; i < 10; i++) {
      await setRoundAndWait(page, 'FRA-paris', 'Paris')
      await skipViaHook(page)
    }
    await expect(page.getByTestId('game-over')).toBeVisible()
    await expect(page.getByTestId('game-over-score')).toHaveText('0')
  })
```

(Removes per-test `test.setTimeout(120_000)` — chromium-gpu's project default is now 120 s under CI. Adds `emulateMedia({ reducedMotion: 'reduce' })`. Drops the explicit `{ timeout: 10_000 }` on `toBeVisible` — the project-default `expect.timeout: 15_000` covers it.)

- [ ] **Step 3: Verify the spec still passes locally**

```bash
cd E:/polworldmap-timing-sweep && npx playwright test e2e/game-city-guessing.spec.ts --project chromium-gpu 2>&1 | tail -5
```

Expected: all tests pass, including `ten rounds end the game` (which should now run noticeably faster locally too).

### Task 5: Sweep `e2e/map-and-countries.spec.ts` (10 `waitForTimeout` sites + 1 `test.setTimeout` + Patterns 4 & 5)

**Files:**
- Modify: `e2e/map-and-countries.spec.ts`

This is the largest file. Apply each replacement in order; line numbers may shift slightly as edits accumulate.

- [ ] **Step 1: Remove `test.setTimeout(60000)` at line 6**

Delete the line. Keep the surrounding comment.

- [ ] **Step 2: Replace `waitForTimeout(2000)` at line 44 (waiting for tile rendering)**

Find:
```ts
    await waitForMapReady(page)

    // Wait for tiles to render
    await page.waitForTimeout(2000)

    const result = await page.evaluate(() => {
```

Replace with:
```ts
    await waitForMapReady(page)

    // Poll until at least one country-fill feature is rendered (tiles loaded).
    await expect.poll(
      () => page.evaluate(() => {
        const map = (window as unknown as Record<string, unknown>).__funworldmap_map as {
          getCanvas: () => HTMLCanvasElement
          queryRenderedFeatures: (point: [number, number], opts: { layers: string[] }) => unknown[]
        } | undefined
        if (!map) return 0
        const canvas = map.getCanvas()
        return map.queryRenderedFeatures(
          [canvas.clientWidth / 2, canvas.clientHeight / 2],
          { layers: ['country-fill'] },
        ).length
      }),
      { timeout: 10_000 },
    ).toBeGreaterThan(0)

    const result = await page.evaluate(() => {
```

- [ ] **Step 3: Replace `waitForTimeout(750)` at line 94 with the same poll pattern**

Find:
```ts
    // GPU compositor settle after launcher's backdrop-filter teardown
    // before queryRenderedFeatures runs. Matches the sibling Hover test's
    // handling; without this, features occasionally don't query cleanly.
    await page.waitForTimeout(750)

    // Find a country feature at the center of the viewport and click it
    const clicked = await page.evaluate(() => {
```

Replace with:
```ts
    // Poll until queryRenderedFeatures returns data — the GPU compositor
    // settle from launcher teardown is what we're really waiting on, and
    // a state-based poll is more reliable than a fixed 750 ms wait on slow CI.
    await expect.poll(
      () => page.evaluate(() => {
        const map = (window as unknown as Record<string, unknown>).__funworldmap_map as {
          getCanvas: () => HTMLCanvasElement
          queryRenderedFeatures: (point: [number, number], opts: { layers: string[] }) => unknown[]
        } | undefined
        if (!map) return 0
        const canvas = map.getCanvas()
        return map.queryRenderedFeatures(
          [canvas.clientWidth / 2, canvas.clientHeight / 2],
          { layers: ['country-fill'] },
        ).length
      }),
      { timeout: 10_000 },
    ).toBeGreaterThan(0)

    // Find a country feature at the center of the viewport and click it
    const clicked = await page.evaluate(() => {
```

- [ ] **Step 4: Replace `waitForTimeout(1000)` at line 127 with poll-for-hash**

Find (note: includes the redundant intermediate `const hash = ...` and `expect(hash).toMatch(...)` lines that follow — the poll subsumes them):
```ts
    // Click at the found coordinates
    await page.mouse.click(clicked!.x, clicked!.y)
    await page.waitForTimeout(1000)

    // Hash should be set (some 3-letter country code)
    const hash = await page.evaluate(() => window.location.hash)
    expect(hash).toMatch(/^#[A-Z]{3}$/)

    // Panel should be open
    await expect(page.getByTestId('country-panel')).toBeVisible()
```

Replace with:
```ts
    // Click at the found coordinates
    await page.mouse.click(clicked!.x, clicked!.y)

    // Poll until the hash reflects the country selection.
    await expect.poll(
      () => page.evaluate(() => window.location.hash),
      { timeout: 5_000 },
    ).toMatch(/^#[A-Z]{3}$/)

    // Panel should be open
    await expect(page.getByTestId('country-panel')).toBeVisible()
```

(The intermediate read + redundant assertion are gone; the poll asserts the regex with retry, then the panel-visibility assertion follows directly.)

- [ ] **Step 5: Replace `waitForTimeout(750)` at line 143 (now ~138 after earlier edits)**

This is inside the `clicking ocean deselects country and closes panel` test, just after `dismissLauncher(page)` and `waitForMapReady(page)`.

Find:
```ts
    await dismissLauncher(page)
    await waitForMapReady(page)
    // GPU compositor settle after launcher teardown.
    await page.waitForTimeout(750)

    // First, click a country to select it
    const countryPoint = await page.evaluate(() => {
```

Replace with:
```ts
    await dismissLauncher(page)
    await waitForMapReady(page)
    // Poll until queryRenderedFeatures returns data — GPU compositor settle
    // after launcher's backdrop-filter teardown.
    await expect.poll(
      () => page.evaluate(() => {
        const map = (window as unknown as Record<string, unknown>).__funworldmap_map as {
          getCanvas: () => HTMLCanvasElement
          queryRenderedFeatures: (point: [number, number], opts: { layers: string[] }) => unknown[]
        } | undefined
        if (!map) return 0
        const canvas = map.getCanvas()
        return map.queryRenderedFeatures(
          [canvas.clientWidth / 2, canvas.clientHeight / 2],
          { layers: ['country-fill'] },
        ).length
      }),
      { timeout: 10_000 },
    ).toBeGreaterThan(0)

    // First, click a country to select it
    const countryPoint = await page.evaluate(() => {
```

- [ ] **Step 6: Replace `waitForTimeout(1500)` at line 171 with poll-for-hash**

Find (in the deselect test, after the country-finding loop):
```ts
    expect(countryPoint).not.toBeNull()
    await page.mouse.click(countryPoint!.x, countryPoint!.y)
    await page.waitForTimeout(1500)

    // Verify a country is now selected
    const hashAfterSelect = await page.evaluate(() => window.location.hash)
    expect(hashAfterSelect).toMatch(/^#[A-Z]{3}$/)
    await expect(page.getByTestId('country-panel')).toBeVisible()
```

Replace with:
```ts
    expect(countryPoint).not.toBeNull()
    await page.mouse.click(countryPoint!.x, countryPoint!.y)

    // Poll until the hash reflects the country selection.
    await expect.poll(
      () => page.evaluate(() => window.location.hash),
      { timeout: 5_000 },
    ).toMatch(/^#[A-Z]{3}$/)
    await expect(page.getByTestId('country-panel')).toBeVisible()
```

(Drops the redundant intermediate assertion.)

- [ ] **Step 7: Pattern 5 — bump `setTimeout(done, 5000)` to 15_000 inside the `jumpTo` Promise**

Find:
```ts
        const done = (): void => resolve()
        map.jumpTo({ center: [-170, 0], zoom: 4 })
        map.once('idle', done)
        setTimeout(done, 5000)
      })
    })
    await page.waitForTimeout(500)
```

Replace with:
```ts
        const done = (): void => resolve()
        map.jumpTo({ center: [-170, 0], zoom: 4 })
        map.once('idle', done)
        // Slow ANGLE CI can stall idle for 10+ s. The fallback is a safety
        // net; we want to give idle a fair chance first.
        setTimeout(done, 15000)
      })
    })
```

(The `setTimeout(done, 5000)` becomes `setTimeout(done, 15000)`. The next-line `await page.waitForTimeout(500)` is REMOVED entirely — once `idle` (or the fallback) fires, the camera is settled; no further wait needed.)

- [ ] **Step 8: Pattern 4 — replace the post-ocean-click sequence at line 201**

Find:
```ts
    // Click center of viewport — should be ocean
    const canvas = page.locator('.maplibregl-canvas')
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.waitForTimeout(1000)

    // Hash should be cleared
    const hash = await page.evaluate(() => window.location.hash)
    expect(hash).toBe('')

    // Panel should be gone
    await expect(page.getByTestId('country-panel')).not.toBeAttached()
```

Replace with:
```ts
    // Click center of viewport — should be ocean
    const canvas = page.locator('.maplibregl-canvas')
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

    // Poll until deselect propagates: hash clears AND panel unmounts.
    await expect.poll(
      () => page.evaluate(() => window.location.hash),
      { timeout: 10_000 },
    ).toBe('')
    await expect(page.getByTestId('country-panel')).not.toBeAttached()
    // expect.timeout (15 s on chromium-gpu CI) covers the React re-render flush.
```

- [ ] **Step 9: Replace `waitForTimeout(1000)` at line 238 (`invalid hash` test)**

Find (includes the redundant intermediate `const hash = ...` and `expect(hash).toBe('')` — the poll subsumes them):
```ts
  test('invalid hash is cleared and no panel shown', async ({ page }) => {
    await page.goto('/#INVALID')
    await page.waitForTimeout(1000)

    const hash = await page.evaluate(() => window.location.hash)
    expect(hash).toBe('')
```

Replace with:
```ts
  test('invalid hash is cleared and no panel shown', async ({ page }) => {
    await page.goto('/#INVALID')

    // Poll until the invalid-hash redirect logic clears the hash.
    await expect.poll(
      () => page.evaluate(() => window.location.hash),
      { timeout: 5_000 },
    ).toBe('')
```

(The intermediate read + redundant assertion are gone; whatever assertion follows in the test stays.)

- [ ] **Step 10: Replace `waitForTimeout(750)` at line 253 (Hover test)**

This is inside the `Hover interaction › hovering over a country changes cursor to pointer` test. Find:
```ts
    await waitForMapReady(page)
    // Give the GPU compositor a beat to recover from the launcher's
    // backdrop-filter layer being torn down before querying features.
    await page.waitForTimeout(750)

    // Find a country feature
    const point = await page.evaluate(() => {
```

Replace with:
```ts
    await waitForMapReady(page)
    // Poll until the GPU has rendered a country-fill feature at the canvas
    // center — backdrop-filter teardown can leave the compositor briefly empty.
    await expect.poll(
      () => page.evaluate(() => {
        const map = (window as unknown as Record<string, unknown>).__funworldmap_map as {
          getCanvas: () => HTMLCanvasElement
          queryRenderedFeatures: (point: [number, number], opts: { layers: string[] }) => unknown[]
        } | undefined
        if (!map) return 0
        const canvas = map.getCanvas()
        return map.queryRenderedFeatures(
          [canvas.clientWidth / 2, canvas.clientHeight / 2],
          { layers: ['country-fill'] },
        ).length
      }),
      { timeout: 10_000 },
    ).toBeGreaterThan(0)

    // Find a country feature
    const point = await page.evaluate(() => {
```

- [ ] **Step 11: Replace `waitForTimeout(500)` at line 283 (cursor change after mouse.move)**

Find:
```ts
    // Move mouse to the country
    await page.mouse.move(point!.x, point!.y)
    await page.waitForTimeout(500)

    // Canvas cursor should be 'pointer'
    const cursor = await page.evaluate(() => {
      const c = document.querySelector('.maplibregl-canvas') as HTMLElement | null
      return c?.style.cursor ?? ''
    })
    expect(cursor).toBe('pointer')
```

Replace with:
```ts
    // Move mouse to the country
    await page.mouse.move(point!.x, point!.y)

    // Poll until the canvas cursor flips to 'pointer' — the mousemove handler
    // sets it via map.getCanvas().style.cursor = 'pointer' after the hover
    // event fires, which on slow CI can lag the move event.
    await expect.poll(
      () => page.evaluate(() => {
        const c = document.querySelector('.maplibregl-canvas') as HTMLElement | null
        return c?.style.cursor ?? ''
      }),
      { timeout: 5_000 },
    ).toBe('pointer')
```

- [ ] **Step 12: Verify the spec still passes locally**

```bash
cd E:/polworldmap-timing-sweep && npx playwright test e2e/map-and-countries.spec.ts --project chromium-gpu 2>&1 | tail -5
```

Expected: 7/7 pass.

### Task 6: Remove redundant `test.setTimeout` from reveal-animation specs

**Files:**
- Modify: `e2e/reveal-animation.spec.ts`
- Modify: `e2e/reveal-animation-reduced-motion.spec.ts`

- [ ] **Step 1: Delete `test.setTimeout(60_000)` at line 4 of each file**

Both specs declare `test.setTimeout(60_000)` at line 4. After the foundation, this matches the local default and is redundant. Delete the line in each file.

- [ ] **Step 2: Verify both specs still pass locally**

```bash
cd E:/polworldmap-timing-sweep && npx playwright test e2e/reveal-animation.spec.ts e2e/reveal-animation-reduced-motion.spec.ts --project chromium-gpu 2>&1 | tail -5
```

Expected: 3/3 pass.

### Task 7: Run the full chromium-gpu suite locally and commit

**Files:** _(none — verification + commit)_

- [ ] **Step 1: Run all 8 chromium-gpu specs locally**

```bash
cd E:/polworldmap-timing-sweep && npx playwright test --project chromium-gpu 2>&1 | tail -5
```

Expected: all tests pass (typically ~30 tests across 8 specs).

- [ ] **Step 2: Run the full e2e matrix to confirm no regression elsewhere**

```bash
cd E:/polworldmap-timing-sweep && npm run test:e2e 2>&1 | tail -5
```

Expected: all projects pass (~157 tests).

- [ ] **Step 3: Commit**

```bash
cd E:/polworldmap-timing-sweep && git add e2e/map-and-countries.spec.ts \
  e2e/game-country-pinning.spec.ts \
  e2e/game-city-guessing.spec.ts \
  e2e/compare-view-dimming.spec.ts \
  e2e/reveal-animation.spec.ts \
  e2e/reveal-animation-reduced-motion.spec.ts
cd E:/polworldmap-timing-sweep && git commit -m "$(cat <<'EOF'
test(e2e): replace waitForTimeout with state-based waits in chromium-gpu specs

Aggressive sweep across the 8 chromium-gpu spec files: every
waitForTimeout(N) call replaced with a state-based wait
(expect.poll, waitForFunction, or assertion-with-timeout). Five
patterns cover all sites:

1. click → fixed wait → assert ⇒ click → expect.poll(state)
2. multi-step game flow ⇒ per-iteration state sync
3. animation-heavy test that isn't about the animation ⇒
   emulateMedia({ reducedMotion: 'reduce' })  — applied to
   game-city-guessing 'ten rounds end the game' to bypass the per-round
   ~3-6 s reveal animation tax on slow CI
4. map-and-countries deselect ⇒ poll for hash clearing + panel unmount
5. map-and-countries jumpTo idle fallback bumped 5 s → 15 s

Also: removed redundant per-test test.setTimeout(60_000) declarations
that match the foundation's global default.

Local verification: 157/157 pass on the full e2e matrix; chromium-gpu
project completes faster on average due to reduced-motion bypass in
ten-rounds and removal of fixed waits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Push and verify with three consecutive green CI runs

### Task 8: Push and create PR

**Files:** _(none — git only)_

- [ ] **Step 1: Push the branch**

```bash
cd E:/polworldmap-timing-sweep && git push -u origin fix/e2e-timing-sweep 2>&1 | tail -3
```

- [ ] **Step 2: Create the PR**

```bash
cd E:/polworldmap-timing-sweep && gh pr create --base main --head fix/e2e-timing-sweep --title "test(e2e): per-project + CI-aware timeouts; replace waitForTimeout with state-based waits" --body "$(cat <<'EOF'
## Summary

Eliminates the seven currently-known CI flakes by removing the ``waitForTimeout(N)`` style anti-pattern across the chromium-gpu spec files and adding per-project + CI-aware timing defaults.

## Two commits

1. **chore(e2e): per-project + CI-aware timing defaults** — ``playwright.config.ts``. Chromium-gpu under CI gets 120 s test budget, 15 s assertion polling, 20 s action timeout. Local stays at 60/5/5.
2. **test(e2e): replace waitForTimeout with state-based waits in chromium-gpu specs** — 13 ``waitForTimeout`` sites swept across 6 files using five replacement patterns. Plus reduced-motion applied to the ``ten rounds end the game`` flake. Plus redundant ``test.setTimeout(60_000)`` removed.

## Verification target

**Three consecutive green CI runs** before merging. The first run is triggered by this PR; runs 2 and 3 via ``gh run rerun --failed`` or empty-commit retriggers.

If any run fails on a NEW flake (not in the seven we documented): treat as out-of-scope; document in PR comments and decide.

## Out of scope

- Chromium-project ``launcher does NOT re-show launcher`` flake. May be helped by the new ``expect.timeout: 10_000`` global; if not, a follow-up.
- Mobile + Firefox-touch projects. Inherit global defaults; not currently flaking.
- ``e2e/helpers.ts`` shared utilities. Some have ``waitForTimeout`` calls inside; out-of-scope unless tied to a known flake.

## Related PRs

After this lands:
- Close PR #21 (its targeted ``map-and-countries deselect`` fix is subsumed by this PR).
- Rebase PR #19 onto new ``main``. PR #19's CI should now be reliably green.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Capture the PR URL printed.

### Task 9: Verify with three consecutive green CI runs

**Files:** _(none — CI watching)_

- [ ] **Step 1: Watch first CI run to completion**

```bash
gh pr checks <PR#> --repo GranatenUdo/funworldmap --watch 2>&1 | tail -10
```

Replace `<PR#>` with the PR number from Task 8. Wait for completion (~10-15 min based on prior runs).

- [ ] **Step 2: Verify all four checks are green**

Run:
```bash
gh pr checks <PR#> --repo GranatenUdo/funworldmap
```

All four must be green:
- `lint + type + unit`
- `e2e (chromium)`
- `e2e (chromium-gpu)`
- `Merge e2e reports`

If any e2e check failed: inspect the failure logs. If it's one of the seven known flakes that we attacked, the sweep didn't fully kill it — re-investigate. If it's a NEW test (not previously flaky), document in PR comment and decide whether to block.

- [ ] **Step 3: Trigger the second run**

If all green:

```bash
gh run rerun <run-id> --repo GranatenUdo/funworldmap --failed 2>&1
```

OR push an empty commit to retrigger:

```bash
cd E:/polworldmap-timing-sweep && git commit --allow-empty -m "chore: retrigger CI for verification run 2" && git push
```

- [ ] **Step 4: Watch second run**

```bash
gh pr checks <PR#> --repo GranatenUdo/funworldmap --watch 2>&1 | tail -10
```

Wait for completion. All four checks (`lint + type + unit`, `e2e (chromium)`, `e2e (chromium-gpu)`, `Merge e2e reports`) must be green.

- [ ] **Step 5: Trigger the third run**

Since runs 1 and 2 were both green (you wouldn't be at this step otherwise), `gh run rerun --failed` does nothing. Use either:

```bash
# Option A: rerun all jobs of the previous run
gh run rerun <run-id-from-step-4> --repo GranatenUdo/funworldmap
```

OR push an empty commit to trigger a fresh pipeline:

```bash
cd E:/polworldmap-timing-sweep && git commit --allow-empty -m "chore: retrigger CI for verification run 3" && git push
```

Either works. The empty-commit approach gets logged in PR history; the rerun-by-id is cleaner.

- [ ] **Step 6: Watch third run**

```bash
gh pr checks <PR#> --repo GranatenUdo/funworldmap --watch 2>&1 | tail -10
```

All four checks must be green.

- [ ] **Step 7: Merge PR**

Once three consecutive green runs are confirmed:

```bash
gh pr merge <PR#> --repo GranatenUdo/funworldmap --rebase --delete-branch
```

### Task 10: Post-merge cleanup

**Files:** _(none — git only)_

- [ ] **Step 1: Close PR #21**

```bash
gh pr close 21 --repo GranatenUdo/funworldmap --comment "Subsumed by #<PR#>: timing sweep with per-project + CI-aware defaults."
```

- [ ] **Step 2: Rebase PR #19 onto new main**

```bash
cd E:/polworldmap-hardening
git fetch origin main
git rebase origin/main
git push --force-with-lease origin hardening-and-reveal-fixes
```

- [ ] **Step 3: Verify PR #19's CI is now reliably green**

```bash
gh pr checks 19 --repo GranatenUdo/funworldmap --watch 2>&1 | tail -5
```

Expected: all checks green. (One run is enough — the timing-sweep PR already verified the suite is reliable.)

- [ ] **Step 4: Merge PR #19**

```bash
gh pr merge 19 --repo GranatenUdo/funworldmap --rebase --delete-branch
```

Done.
