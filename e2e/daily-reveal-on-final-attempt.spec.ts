import { test, expect } from '@playwright/test'
import { waitForAppReady, waitForGameTestHook, stubDailyIndex, routeMapTiles } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.describe('daily best-of-3 final attempt holds before game-over', () => {
  test('country-pinning attempt 3 → status round-ended → finalize → game-over', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await routeMapTiles(page)
    await stubDailyIndex(page, today, { cca3: 'FRA', cityId: 'FRA-paris' })
    await page.goto(`/#daily/${today}/country-pinning`)
    await waitForAppReady(page)
    await waitForGameTestHook(page)

    // submitAndWait pattern: dispatch a guess then poll until the attempt is
    // recorded before issuing the next one (avoids reducer races on slow CI).
    await page.evaluate(() => (window as any).__funworldmap_game.submitCountryGuess('DEU'))
    await expect.poll(
      () => page.evaluate(() => (window as any).__funworldmap_game?.getSession?.()?.currentAttempts?.length ?? 0),
      { timeout: 5_000 },
    ).toBeGreaterThanOrEqual(1)
    await page.evaluate(() => (window as any).__funworldmap_game.submitCountryGuess('ESP'))
    await expect.poll(
      () => page.evaluate(() => (window as any).__funworldmap_game?.getSession?.()?.currentAttempts?.length ?? 0),
      { timeout: 5_000 },
    ).toBeGreaterThanOrEqual(2)
    await page.evaluate(() => (window as any).__funworldmap_game.submitCountryGuess('ITA'))

    // After the third attempt the session holds at round-ended (game-over modal
    // is NOT yet attached — the reveal animation must play first in production).
    await expect.poll(
      () => page.evaluate(() => (window as any).__funworldmap_game?.getSession?.()?.status),
      { timeout: 10_000 },
    ).toBe('round-ended')
    await expect(page.getByTestId('game-over')).not.toBeAttached()

    // finalize() drives round-ended → game-over.
    await page.evaluate(() => (window as any).__funworldmap_game.finalize())
    await expect(page.getByTestId('game-over')).toBeVisible()
  })
})
