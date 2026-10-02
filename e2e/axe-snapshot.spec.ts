/**
 * axe-snapshot.spec.ts — axe-core accessibility sweep
 *
 * Captures accessibility violations across canonical UI states from the
 * vision-audit remediation plan. Violations FAIL the suite — every audit below
 * asserts an empty violations array. Each test prints its findings to stdout so
 * the CI trace captures them.
 *
 * States:
 *   1. Cold launcher         — `/` with cleared localStorage
 *   2. Country panel open    — `/#FRA`
 *   3. Game-over modal       — driven via the "End game" button
 *   4. In-game HUD           — free country-pinning, mid-round
 *   5. End-game confirm      — the C-4 run-safety dialog (non-trivial run)
 *
 * See: docs/superpowers/notes/2026-05-05-post-audit-verification.md
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { waitForAppReady, waitForGameTestHook, openLauncher, gotoAndWaitForMap } from './helpers'

test.setTimeout(120_000)

/**
 * Violation list type derived from AxeBuilder's return type — `axe-core` is a
 * transitive dependency of `@axe-core/playwright` and is not hoisted to the
 * root node_modules, so `import('axe-core')` does not resolve from here.
 */
type AxeViolations = Awaited<ReturnType<AxeBuilder['analyze']>>['violations']

/** Shared axe excludes: map canvas (opaque WebGL) and loading splash. */
const AXE_EXCLUDES = ['.maplibregl-canvas', '.z-\\[200\\]']

/**
 * Summarise violations to stdout in a compact table.
 */
function reportViolations(stateName: string, violations: AxeViolations): void {
  if (violations.length === 0) {
    console.log(`\n[axe-snapshot] ${stateName}: No violations`)
    return
  }
  console.log(`\n[axe-snapshot] ${stateName}: ${violations.length} violation(s)`)
  console.log('| Rule | Impact | Count | Brief |')
  console.log('|---|---|---|---|')
  for (const v of violations) {
    const count = v.nodes.length
    const brief = v.description.replace(/\|/g, '/').slice(0, 80)
    console.log(`| ${v.id} | ${v.impact ?? 'unknown'} | ${count} | ${brief} |`)
  }
}

// ── 1. Cold launcher ─────────────────────────────────────────────────────────
test('axe-snapshot: cold launcher', async ({ page }) => {
  await gotoAndWaitForMap(page, '/')
  await waitForAppReady(page)
  await openLauncher(page)

  const results = await new AxeBuilder({ page })
    .include('[data-testid="launcher"]')
    .exclude(AXE_EXCLUDES[0])
    .exclude(AXE_EXCLUDES[1])
    .analyze()

  reportViolations('Cold launcher', results.violations)
  expect(results.violations).toEqual([])
})

// ── 2. Country panel open ─────────────────────────────────────────────────────
test('axe-snapshot: country panel open', async ({ page }) => {
  await page.goto('/#FRA')
  await waitForAppReady(page)
  await page.getByTestId('country-panel').waitFor({ state: 'visible', timeout: 10_000 })

  const results = await new AxeBuilder({ page })
    .exclude(AXE_EXCLUDES[0])
    .exclude(AXE_EXCLUDES[1])
    .analyze()

  reportViolations('Country panel open', results.violations)
  expect(results.violations).toEqual([])
})

// ── 3. Game-over modal (driven via the End-game button) ──────────────────────
test('axe-snapshot: game-over modal', async ({ page }) => {
  // Start a free country-pinning game via deep-link
  // Tile-stubbed navigation (routeMapTiles) — without it, slow real satellite
  // tiles surface the basemap-degraded banner over the HUD and intercept the
  // End-game click (observed 2026-08-04). Axe scans the DOM; no imagery needed.
  await gotoAndWaitForMap(page, '/#game/country-pinning/play')
  await waitForAppReady(page)
  await waitForGameTestHook(page)

  // End game → game-over via "End game" button. No guess was submitted, so
  // this is a trivial run (round 1, score 0) and the C-4 confirm dialog is
  // deliberately skipped — game-over shows directly.
  await expect(page.getByTestId('game-end')).toBeVisible({ timeout: 5_000 })
  await page.getByTestId('game-end').click()
  await page.getByTestId('game-over').waitFor({ state: 'visible', timeout: 10_000 })

  const results = await new AxeBuilder({ page })
    .include('[data-testid="game-over"]')
    .exclude(AXE_EXCLUDES[0])
    .exclude(AXE_EXCLUDES[1])
    .analyze()

  reportViolations('Game-over modal', results.violations)
  expect(results.violations).toEqual([])
})

// ── 4. In-game HUD (free country-pinning) ─────────────────────────────────────
test('axe-snapshot: in-game HUD', async ({ page }) => {
  // Tile-stubbed navigation (routeMapTiles) — without it, slow real satellite
  // tiles surface the basemap-degraded banner over the HUD and intercept the
  // End-game click (observed 2026-08-04). Axe scans the DOM; no imagery needed.
  await gotoAndWaitForMap(page, '/#game/country-pinning/play')
  await waitForAppReady(page)
  await waitForGameTestHook(page)

  await page.getByTestId('game-hud').waitFor({ state: 'visible', timeout: 10_000 })

  const results = await new AxeBuilder({ page })
    .exclude(AXE_EXCLUDES[0])
    .exclude(AXE_EXCLUDES[1])
    .analyze()

  reportViolations('In-game HUD', results.violations)
  expect(results.violations).toEqual([])
})

// ── 5. End-game confirm dialog (C-4 run-safety) ───────────────────────────────
test('axe-snapshot: end-game confirm dialog', async ({ page }) => {
  // Tile-stubbed navigation (routeMapTiles) — without it, slow real satellite
  // tiles surface the basemap-degraded banner over the HUD and intercept the
  // End-game click (observed 2026-08-04). Axe scans the DOM; no imagery needed.
  await gotoAndWaitForMap(page, '/#game/country-pinning/play')
  await waitForAppReady(page)
  await waitForGameTestHook(page)

  // Make the run non-trivial (score > 0) via the test seams — the C-4 dialog
  // only appears when there is something worth confirming. setRound first so
  // the correct-guess evaluation targets a known round.
  await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })
  await page.evaluate(() => {
    type Hook = { setRound?: (c: string) => boolean }
    const g = (window as unknown as { __funworldmap_game?: Hook }).__funworldmap_game
    g?.setRound?.('FRA')
  })
  await expect(page.getByTestId('game-prompt-name')).toHaveText('France', { timeout: 10_000 })
  await page.evaluate(() => {
    type Hook = { submitCountryGuess?: (c: string) => boolean }
    const g = (window as unknown as { __funworldmap_game?: Hook }).__funworldmap_game
    g?.submitCountryGuess?.('FRA')
  })
  await expect(page.getByTestId('hud-score')).toHaveText('100', { timeout: 10_000 })

  await expect(page.getByTestId('game-end')).toBeVisible({ timeout: 5_000 })
  await page.getByTestId('game-end').click()
  await page.getByTestId('end-game-confirm').waitFor({ state: 'visible', timeout: 10_000 })

  const results = await new AxeBuilder({ page })
    .include('[data-testid="end-game-confirm"]')
    .exclude(AXE_EXCLUDES[0])
    .exclude(AXE_EXCLUDES[1])
    .analyze()

  reportViolations('End-game confirm dialog', results.violations)
  expect(results.violations).toEqual([])
})
