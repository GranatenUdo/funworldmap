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

    await submitAndWait(page, 'DEU', 1)
    await submitAndWait(page, 'ESP', 2)
    await submitAndWait(page, 'ITA', 3)

    await expect.poll(
      () => page.evaluate(() => {
        const game = (window as unknown as { __funworldmap_game?: { getSession: () => { status: string } } }).__funworldmap_game
        return game?.getSession().status
      }),
      { timeout: 10_000 },
    ).toBe('round-ended')
    await expect(page.getByTestId('game-over')).not.toBeAttached()

    await finalizeGame(page)
    await expect(page.getByTestId('game-over')).toBeVisible()
  })
})
