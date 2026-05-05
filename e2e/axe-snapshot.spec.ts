/**
 * axe-snapshot.spec.ts — Phase 2.1 axe-core baseline sweep
 *
 * Captures accessibility violations across five canonical UI states from the
 * vision-audit remediation plan. Violations are COLLECTED, not enforced — the
 * purpose is to establish a baseline, not to block the build. Each test prints
 * its findings to stdout so the CI trace captures them.
 *
 * States:
 *   1. Cold launcher         — `/` with cleared localStorage, daily stubbed
 *   2. In-game HUD           — `/#daily/<today>/country-pinning`, mid-game
 *   3. Country panel open    — `/#FRA`
 *   4. Game-over modal       — driven via `finalizeGame()` seam
 *   5. Reveal modal          — `/#daily/<past>/reveal`
 *
 * See: docs/superpowers/notes/2026-05-05-post-audit-verification.md
 */

import { test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  waitForAppReady,
  waitForGameTestHook,
  stubDailyIndex,
  seedDailyHistory,
  submitAndWait,
  finalizeGame,
} from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.setTimeout(120_000)

const TODAY = toLocalDateString(new Date())

// A past date whose puzzle content will also be stubbed — needed for the
// reveal-modal state. 3 days back avoids any "same day" edge in the daily logic.
const PAST_DATE = toLocalDateString(
  (() => {
    const d = new Date()
    d.setDate(d.getDate() - 3)
    return d
  })(),
)

/** Shared axe excludes: map canvas (opaque WebGL) and loading splash. */
const AXE_EXCLUDES = ['.maplibregl-canvas', '.z-\\[200\\]']

/**
 * Summarise violations to stdout in a compact table and return the list.
 * We never throw — the spec is baseline-collection-only.
 */
function reportViolations(
  stateName: string,
  violations: import('axe-core').Result[],
): void {
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
  // No seedDailyHistory — localStorage is clean (cold state).
  await stubDailyIndex(page, TODAY)
  await page.goto('/')
  await waitForAppReady(page)
  await page.getByTestId('launcher').waitFor({ state: 'visible', timeout: 10_000 })

  const results = await new AxeBuilder({ page })
    .include('[data-testid="launcher"]')
    .exclude(AXE_EXCLUDES[0])
    .exclude(AXE_EXCLUDES[1])
    .analyze()

  reportViolations('Cold launcher', results.violations)
  // No assertion — baseline collection only.
})

// ── 2. In-game HUD (daily country-pinning, one attempt logged) ───────────────
test('axe-snapshot: in-game HUD', async ({ page }) => {
  await stubDailyIndex(page, TODAY)
  // Deep-link directly into the daily game to bypass the launcher.
  await page.goto(`/#daily/${TODAY}/country-pinning`)
  await waitForAppReady(page)
  await waitForGameTestHook(page)

  // Log one attempt so the HUD reflects mid-game state.
  await submitAndWait(page, 'DEU', 1)

  // game-hud should be visible after the first attempt.
  await page.getByTestId('game-hud').waitFor({ state: 'visible', timeout: 10_000 })

  const results = await new AxeBuilder({ page })
    .exclude(AXE_EXCLUDES[0])
    .exclude(AXE_EXCLUDES[1])
    .analyze()

  reportViolations('In-game HUD', results.violations)

  // Phase 3.9: attempts indicator should have role=group, no aria-prohibited-attr.
  const ariaProhibitedAttr = results.violations.find(v => v.id === 'aria-prohibited-attr')
  if (ariaProhibitedAttr !== undefined) {
    throw new Error(
      `[axe] aria-prohibited-attr violation(s) found in in-game HUD: ${ariaProhibitedAttr.nodes
        .map(n => n.html)
        .join('; ')}`,
    )
  }
})

// ── 3. Country panel open ─────────────────────────────────────────────────────
test('axe-snapshot: country panel open', async ({ page }) => {
  await page.goto('/#FRA')
  await waitForAppReady(page)
  await page.getByTestId('country-panel').waitFor({ state: 'visible', timeout: 10_000 })

  const results = await new AxeBuilder({ page })
    .exclude(AXE_EXCLUDES[0])
    .exclude(AXE_EXCLUDES[1])
    .analyze()

  reportViolations('Country panel open', results.violations)
})

// ── 4. Game-over modal (daily, driven via test seam) ─────────────────────────
test('axe-snapshot: game-over modal', async ({ page }) => {
  await stubDailyIndex(page, TODAY)
  await page.goto(`/#daily/${TODAY}/country-pinning`)
  await waitForAppReady(page)
  await waitForGameTestHook(page)

  // Three guesses → finalizeGame triggers the modal without waiting for the
  // wall-clock reveal hold (≥ 3 s).
  await submitAndWait(page, 'DEU', 1)
  await submitAndWait(page, 'ESP', 2)
  await submitAndWait(page, 'FRA', 3)
  await finalizeGame(page)

  await page.getByTestId('game-over').waitFor({ state: 'visible', timeout: 10_000 })

  const results = await new AxeBuilder({ page })
    .include('[data-testid="game-over"]')
    .exclude(AXE_EXCLUDES[0])
    .exclude(AXE_EXCLUDES[1])
    .analyze()

  reportViolations('Game-over modal', results.violations)
})

// ── 5. Reveal modal (past daily) ──────────────────────────────────────────────
test('axe-snapshot: reveal modal', async ({ page }) => {
  // Seed history for the past date so the reveal has attempt data to render.
  await seedDailyHistory(page, { date: PAST_DATE, modes: ['country-pinning'] })
  // Stub the index to include both TODAY and PAST_DATE so the resolver can
  // look up the country/city for the past date.
  await page.route('**/daily/index.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: `${TODAY}T00:00:00.000Z`,
        window: { start: PAST_DATE, end: TODAY },
        days: {
          [PAST_DATE]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } },
          [TODAY]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } },
        },
      }),
    }),
  )

  await page.goto(`/#daily/${PAST_DATE}/reveal`)
  await waitForAppReady(page)
  await page.getByTestId('daily-reveal').waitFor({ state: 'visible', timeout: 10_000 })

  const results = await new AxeBuilder({ page })
    .include('[data-testid="daily-reveal"]')
    .exclude(AXE_EXCLUDES[0])
    .exclude(AXE_EXCLUDES[1])
    .analyze()

  reportViolations('Reveal modal', results.violations)
})
