/**
 * Phase 4.1 — Confirm-on-low-score before "Done" in daily best-of-3.
 *
 * Rules:
 * - Show a one-time inline confirm if best score < 30 AND attemptsRemaining >= 1.
 * - Once the prompt has been shown this round (even if dismissed via "Use
 *   attempts"), a subsequent Done click goes through immediately — no nag.
 * - High score (>= 30) ends immediately without a prompt.
 *
 * Country score reference (target = FRA, DECAY_KM = 3000):
 *   AUS – ~15 000 km → Math.round(100 * exp(-5)) ≈ 1  (low score, < 30)
 *   DEU – ~1 100 km  → Math.round(100 * exp(-0.37)) ≈ 69 (high score, >= 30)
 */
import { test, expect } from '@playwright/test'
import { stubDailyIndex, waitForAppReady, waitForGameTestHook } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

type GameWindow = {
  __funworldmap_game: {
    submitCountryGuess(s: string): boolean
    getSession(): { currentAttempts: unknown[]; status: string }
  }
}

/** Submit a country guess via test seam and wait for the session to reflect it. */
async function submitAndWait(page: import('@playwright/test').Page, cca3: string, expectAfter: number) {
  await page.evaluate((c) => {
    ;(window as unknown as GameWindow).__funworldmap_game.submitCountryGuess(c)
  }, cca3)
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as GameWindow).__funworldmap_game.getSession().currentAttempts.length,
        ),
      { timeout: 10_000 },
    )
    .toBe(expectAfter)
}

/** Navigate to today's daily country-pinning, wait for game hooks. */
async function gotoDaily(page: import('@playwright/test').Page) {
  const today = toLocalDateString(new Date())
  await stubDailyIndex(page, today, { cca3: 'FRA' })
  await page.goto(`/#daily/${today}/country-pinning`)
  await waitForAppReady(page)
  await waitForGameTestHook(page)
  await page.waitForSelector('[data-testid="game-hud"]')
  return today
}

test.describe('Done button — low-score confirm (daily best-of-3)', () => {
  test('low score + attempts remaining: first Done click shows inline confirm', async ({ page }) => {
    await gotoDaily(page)

    // AUS vs FRA ≈ 1 pt — below threshold
    await submitAndWait(page, 'AUS', 1)

    await expect(page.getByTestId('game-done')).toBeVisible()
    await page.getByTestId('game-done').click()

    // Prompt replaces the Done button
    await expect(page.getByTestId('done-confirm')).toBeVisible()
    await expect(page.getByTestId('game-done')).not.toBeAttached()
  })

  test('"Done anyway" on the confirm ends the round immediately', async ({ page }) => {
    await gotoDaily(page)
    await submitAndWait(page, 'AUS', 1)

    await page.getByTestId('game-done').click()
    await expect(page.getByTestId('done-confirm')).toBeVisible()

    await page.getByTestId('done-confirm-anyway').click()

    // Prompt is gone and session moved to round-ended or game-over
    await expect(page.getByTestId('done-confirm')).not.toBeAttached()
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as GameWindow).__funworldmap_game.getSession().status,
          ),
        { timeout: 10_000 },
      )
      .toMatch(/round-ended|game-over/)
  })

  test('high score (>= 30): Done ends immediately without prompt', async ({ page }) => {
    await gotoDaily(page)

    // DEU vs FRA ≈ 69 pt — above threshold
    await submitAndWait(page, 'DEU', 1)

    await expect(page.getByTestId('game-done')).toBeVisible()
    await page.getByTestId('game-done').click()

    // No confirm prompt
    await expect(page.getByTestId('done-confirm')).not.toBeAttached()

    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as GameWindow).__funworldmap_game.getSession().status,
          ),
        { timeout: 10_000 },
      )
      .toMatch(/round-ended|game-over/)
  })

  test('dismissing with "Use attempts" then clicking Done again ends game without re-prompting', async ({ page }) => {
    await gotoDaily(page)
    await submitAndWait(page, 'AUS', 1)

    // First Done → prompt appears
    await page.getByTestId('game-done').click()
    await expect(page.getByTestId('done-confirm')).toBeVisible()

    // Dismiss with "Use attempts"
    await page.getByTestId('done-confirm-use-attempts').click()
    await expect(page.getByTestId('done-confirm')).not.toBeAttached()
    await expect(page.getByTestId('game-done')).toBeVisible()

    // Second Done → goes through immediately (no re-prompt)
    await page.getByTestId('game-done').click()
    await expect(page.getByTestId('done-confirm')).not.toBeAttached()

    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as GameWindow).__funworldmap_game.getSession().status,
          ),
        { timeout: 10_000 },
      )
      .toMatch(/round-ended|game-over/)
  })

  test('confirm prompt uses singular "attempt" when 1 remaining, plural "attempts" when 2', async ({ page }) => {
    await gotoDaily(page)

    // 1 guess made → 2 attempts remaining
    await submitAndWait(page, 'AUS', 1)
    await page.getByTestId('game-done').click()
    await expect(page.getByTestId('done-confirm')).toContainText('2 attempts')

    // Dismiss → second guess → 1 attempt remaining
    await page.getByTestId('done-confirm-use-attempts').click()
    // Done now goes through (no re-prompt this round). Navigate fresh for second assertion.
  })

  test('confirm prompt shows singular "attempt" when 1 remaining', async ({ page }) => {
    await gotoDaily(page)

    // 2 guesses made → 1 attempt remaining
    await submitAndWait(page, 'AUS', 1)
    await submitAndWait(page, 'AUS', 2)
    await expect(page.getByTestId('game-done')).toBeVisible()
    await page.getByTestId('game-done').click()
    await expect(page.getByTestId('done-confirm')).toContainText('1 attempt')
    // No stray "s" after "attempt"
    await expect(page.getByTestId('done-confirm')).not.toContainText('1 attempts')
  })

  test('analytics event fired when prompt is shown', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __PLAYWRIGHT__: boolean }).__PLAYWRIGHT__ = true
    })
    await gotoDaily(page)
    await submitAndWait(page, 'AUS', 1)

    await page.getByTestId('game-done').click()
    await expect(page.getByTestId('done-confirm')).toBeVisible()

    const events = await page.evaluate(() => {
      const w = window as unknown as { __testAnalytics?: Array<{ name: string }> }
      return (w.__testAnalytics ?? []).map((e) => e.name)
    })
    expect(events).toContain('daily_done_low_score_prompt')
  })

  test('analytics event NOT fired when high-score Done ends immediately', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __PLAYWRIGHT__: boolean }).__PLAYWRIGHT__ = true
    })
    await gotoDaily(page)
    await submitAndWait(page, 'DEU', 1)

    await page.getByTestId('game-done').click()
    await expect(page.getByTestId('done-confirm')).not.toBeAttached()

    const events = await page.evaluate(() => {
      const w = window as unknown as { __testAnalytics?: Array<{ name: string }> }
      return (w.__testAnalytics ?? []).map((e) => e.name)
    })
    expect(events).not.toContain('daily_done_low_score_prompt')
  })
})
