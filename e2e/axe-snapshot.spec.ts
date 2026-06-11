/**
 * axe-snapshot.spec.ts — axe-core baseline sweep
 *
 * Captures accessibility violations across canonical UI states from the
 * vision-audit remediation plan. Violations FAIL the suite — every audit below
 * asserts an empty violations array. Each test prints its findings to stdout so
 * the CI trace captures them.
 *
 * States:
 *   1. Cold launcher         — `/` with cleared localStorage
 *   2. Country panel open    — `/#FRA`
 *   3. Game-over modal       — driven via `finalizeGame()` seam
 *
 * See: docs/superpowers/notes/2026-05-05-post-audit-verification.md
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { waitForAppReady, waitForGameTestHook, openLauncher, gotoAndWaitForMap } from './helpers'

test.setTimeout(120_000)

/** Shared axe excludes: map canvas (opaque WebGL) and loading splash. */
const AXE_EXCLUDES = ['.maplibregl-canvas', '.z-\\[200\\]']

/**
 * Summarise violations to stdout in a compact table and return the list.
 */
function reportViolations(stateName: string, violations: import('axe-core').Result[]): void {
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

// ── 3. Game-over modal (driven via test seam) ─────────────────────────────────
test('axe-snapshot: game-over modal', async ({ page }) => {
  // Start a free country-pinning game via deep-link
  await page.goto('/#game/country-pinning/play')
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
  await waitForAppReady(page)
  await waitForGameTestHook(page)

  // End game → game-over via "End game" button
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
  await page.goto('/#game/country-pinning/play')
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
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
