import { test, expect } from '@playwright/test'
import { routeMapTiles, seedDailyHistory, stubDailyIndex } from './helpers'

test.setTimeout(60_000)

test.describe('mobile — daily city flow', () => {
  test('daily city round completes on mobile viewport', async ({ page }) => {
    // Use LOCAL date to match the GameController's toLocalDateString check.
    // Using UTC (toISOString) would mis-classify the puzzle as "in the past"
    // when the local clock is ahead of UTC (any positive-offset timezone late
    // in the day), redirecting to /reveal instead of starting the round.
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    await routeMapTiles(page)
    await stubDailyIndex(page, today, { cca3: 'FRA', cityId: 'FRA-paris' })
    await seedDailyHistory(page, { date: today, modes: [] })
    await page.goto(`/#daily/${today}/city-guessing`)
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 15_000 })

    // Submit three point guesses, self-pacing to the animated-reveal +
    // auto-advance cycle by polling the HUD attempts counter.
    for (let i = 0; i < 3; i++) {
      const expectedAttempts = i + 1
      await page.evaluate(() => {
        window.__funworldmap_game?.submitGuess?.({ kind: 'point', lngLat: [0, 0] })
      })
      await expect
        .poll(
          () => page.evaluate(() => window.__funworldmap_game?.getSession?.().currentAttempts.length ?? 0),
          { timeout: 10_000 },
        )
        .toBeGreaterThanOrEqual(expectedAttempts)
    }

    // Three attempts exhaust the daily city round, landing in round-ended.
    // finalize() drives the round-ended → game-over transition.
    await page.evaluate(() => (window as unknown as { __funworldmap_game: { finalize(): void } }).__funworldmap_game.finalize())
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 15_000 })
  })
})
