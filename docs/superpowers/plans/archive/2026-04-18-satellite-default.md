# Satellite Default View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the EOX Sentinel-2 satellite basemap the default view on first load, replacing the current vector (positron) default.

**Architecture:** One-line initial-state flip in `App.tsx` plus one new Playwright e2e spec that locks the default in. All supporting infrastructure (tiles, terrain DEM, toggle button, paint overrides) already exists from the 2026-04-16 globe/terrain design.

**Tech Stack:** React 19, TypeScript, MapLibre GL JS 5.23, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-18-satellite-default-and-game-modes-design.md` — Part A.

**Scope out of this plan:**
- Persisting the user's toggle choice in `localStorage` (explicit non-goal in spec).
- Dark-mode contrast tweaks (already handled by `useSatelliteMode` paint overrides).
- Any change to the satellite toggle button UI, icon, copy, or position.
- Game-mode work — separate plan `2026-04-18-country-pinning-game.md`.

---

## File Structure

**Files to modify:**
- `src/App.tsx:22` — flip initial satellite state from `false` to `true`.

**Files to create:**
- `e2e/satellite-default.spec.ts` — asserts the satellite raster layer is visible and the toggle is pressed on first load.

**Files NOT modified:**
- `src/hooks/useSatelliteMode.ts` — paint overrides already theme-aware.
- `src/lib/mapStyles.ts` — tile URLs and constants unchanged.
- `src/components/Header.tsx` — button unchanged.
- No other e2e specs need updating — a prior grep of `e2e/` for `aria-pressed` matched nothing.

---

## Pre-flight

- [ ] **Step 0.1: Working tree clean, on `main`**

Run:
```bash
git status --short
git branch --show-current
```

Expected: clean working tree, current branch `main`. If dirty, stash or commit before starting.

- [ ] **Step 0.2: Baseline — existing e2e suite passes**

Run:
```bash
npm run build
npx playwright test --project=chromium
```

Expected: all chromium (SwiftShader) e2e specs pass. If any fail, resolve first — this plan should not mix with unrelated failures.

---

## Task 1: Write the failing e2e spec

**Files:**
- Create: `e2e/satellite-default.spec.ts`

**Rationale:** TDD — the test fails today because the satellite toggle starts in the non-pressed state. We write the assertion first, confirm it fails, then flip the default.

- [ ] **Step 1.1: Create the spec file**

Write to `e2e/satellite-default.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.describe('Satellite is the default basemap', () => {
  test('toggle is pressed on first load', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })

    const toggle = page.getByTestId('satellite-toggle')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  test('satellite raster layer is visible on first load', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })

    const visibility = await page.evaluate(() => {
      const map = (window as unknown as {
        __funworldmap_map?: { getLayoutProperty: (id: string, prop: string) => string | undefined }
      }).__funworldmap_map
      if (!map) return null
      return map.getLayoutProperty('satellite-layer', 'visibility')
    })

    expect(visibility).toBe('visible')
  })

  test('user can still toggle back to vector basemap', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })

    const toggle = page.getByTestId('satellite-toggle')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })
})
```

- [ ] **Step 1.2: Run the new spec — expect it to fail**

Run:
```bash
npm run build
npx playwright test e2e/satellite-default.spec.ts --project=chromium-gpu
```

Expected: first two tests FAIL with `aria-pressed` equal to `"false"` (initial state) and `visibility` equal to `"none"`. Third test may or may not pass today — the important failures are the first two.

If the spec fails for a different reason (e.g., `__funworldmap_map` undefined), investigate before continuing — that's a sign of an environment issue, not the missing default.

---

## Task 2: Flip the satellite default to `true`

**Files:**
- Modify: `src/App.tsx:22`

- [ ] **Step 2.1: Edit `src/App.tsx`**

Replace exactly one line. Find:

```ts
  const [satellite, setSatellite] = useState(false)
```

Replace with:

```ts
  const [satellite, setSatellite] = useState(true)
```

- [ ] **Step 2.2: Re-run the e2e spec — expect it to pass**

Run:
```bash
npm run build
npx playwright test e2e/satellite-default.spec.ts --project=chromium-gpu
```

Expected: all three tests PASS.

If the "user can still toggle back" test was already passing before Task 2, it continues passing — the toggle flow is unchanged.

- [ ] **Step 2.3: Commit**

```bash
git add src/App.tsx e2e/satellite-default.spec.ts
git commit -m "feat(map): satellite imagery is the default basemap

Opens the site on EOX Sentinel-2 cloudless + AWS Terrain instead of
OpenFreeMap positron. The toggle, tile sources, terrain DEM, and
paint overrides already existed — this flip makes the new view the
entry-point experience.

Spec: docs/superpowers/specs/2026-04-18-satellite-default-and-game-modes-design.md (Part A)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Regression sweep — full e2e and unit suites

**Files:** none

**Rationale:** Satellite paint overrides touch every country layer. Confirm no adjacent behaviour (search, panel, theme toggle, compare) regressed.

- [ ] **Step 3.1: Run unit tests**

Run:
```bash
npm run test:unit
```

Expected: all tests pass. No unit-level changes were made, so any failure is a pre-existing issue to investigate separately.

- [ ] **Step 3.2: Run full chromium (SwiftShader) e2e suite**

Run:
```bash
npm run build
npx playwright test --project=chromium
```

Expected: all DOM-level specs pass. Theme, search, panel, accessibility, scaffold, meta-and-static specs are unaffected by the basemap default — any failure here is the regression signal.

- [ ] **Step 3.3: Run chromium-gpu e2e suite**

Run:
```bash
npx playwright test --project=chromium-gpu
```

Expected: all GPU specs pass, including the new `satellite-default.spec.ts`. `map-and-countries.spec.ts`, `map-reliability.spec.ts`, `keyboard-map-nav.spec.ts` should continue to pass — they don't depend on the basemap being vector.

- [ ] **Step 3.4: Visual smoke-test (human)**

Run locally:
```bash
npm run dev
```

Open `http://localhost:5173` in a browser. Confirm:
1. Satellite imagery renders on first paint.
2. Country borders are visible (white 35% alpha per `useSatelliteMode.ts:55-57`).
3. Cycling the theme toggle through light / dark / system does not break satellite rendering.
4. Clicking the satellite toggle returns to the positron vector basemap; clicking again restores satellite.
5. Country selection, search, compare mode, and reset view all work identically to before.

If any visual defect appears (unreadable labels, missing borders, broken toggle), stop and investigate before merging — the paint overrides may need tuning in `useSatelliteMode.ts:55-63`.

- [ ] **Step 3.5: No second commit needed**

This task is verification only. If steps 3.1–3.4 all pass, the work from Task 2 stands as the single commit for this PR.

---

## Post-plan

Open a PR titled `feat(map): satellite imagery as default basemap`. Link to the spec.

In the PR description, include:

- The licence note: **EOX Sentinel-2 cloudless is CC BY-NC-SA 4.0. This is compatible with the site's free non-commercial posture today; any future monetisation will require swapping tile sources.**
- A screenshot of the landing page before/after.

Once merged, the country-pinning game plan (`2026-04-18-country-pinning-game.md`) can proceed.
