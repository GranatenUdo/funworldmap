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

    // Submit three point guesses. Wait for the HUD attempts counter to reach
    // the expected value after each guess, so the test self-paces to the
    // animated-reveal + auto-advance cycle instead of guessing a fixed wait.
    for (let i = 0; i < 3; i++) {
      const expectedAttempts = i + 1
      await page.evaluate(() => {
        const g = (window as unknown as { __funworldmap_game?: { submitGuess: (i: { kind: string; lngLat: [number, number] }) => void } }).__funworldmap_game
        g?.submitGuess({ kind: 'point', lngLat: [0, 0] })
      })
      // Poll the HUD attempts indicator. After the third submission the game
      // transitions to game-over (asserted below) — so for the third loop the
      // attempts counter briefly shows 3 before the overlay mounts.
      await expect
        .poll(
          () => page.evaluate(() => (window as unknown as { __funworldmap_game?: { getSession?: () => { currentAttempts: unknown[] } } }).__funworldmap_game?.getSession?.().currentAttempts.length ?? 0),
          { timeout: 10_000 },
        )
        .toBeGreaterThanOrEqual(expectedAttempts)
    }

    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 15_000 })
  })
})
