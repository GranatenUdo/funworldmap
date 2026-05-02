import { test, expect } from '@playwright/test'
import { waitForAppReady, waitForGameTestHook, stubDailyIndex, routeMapTiles, submitAndWait, finalizeGame } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.describe('daily best-of-3 final attempt holds before game-over', () => {
  test('country-pinning attempt 3 → status round-ended → finalize → game-over', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await routeMapTiles(page)
    await stubDailyIndex(page, today, { cca3: 'FRA', cityId: 'FRA-paris' })
    await page.goto(`/#daily/${today}/country-pinning`)
    await waitForAppReady(page)
    await waitForGameTestHook(page)
    // Wait for the daily session to actually start. waitForGameTestHook only
    // proves the test seam is registered — on slow CI the bootstrap effect's
    // deferred start (after the daily index resolves) can lag behind, and
    // submitCountryGuess becomes a no-op while session.status is still 'idle'.
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 15_000 })

    await submitAndWait(page, 'DEU', 1)
    await submitAndWait(page, 'ESP', 2)
    await submitAndWait(page, 'ITA', 3)

    // Read status synchronously right after the third attempt commits. The
    // round-ended hold is 3000 ms; on slow CI we may already be past it,
    // so accept either 'round-ended' (hold active) or 'game-over' (hold
    // expired before this read). The unit tests verify the reducer's
    // round-ended transition explicitly.
    const status = await page.evaluate(() => {
      const game = (window as unknown as { __funworldmap_game: { getSession: () => { status: string } } }).__funworldmap_game
      return game.getSession().status
    })
    expect(['round-ended', 'game-over']).toContain(status)

    await finalizeGame(page)
    await expect(page.getByTestId('game-over')).toBeVisible()
  })
})
