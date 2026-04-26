import { test, expect } from '@playwright/test'
import { stubDailyIndex, waitForAppReady } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.describe('daily best-of-3', () => {
  test('Done button after one attempt ends the game with that attempt', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await stubDailyIndex(page, today)
    await page.goto(`/#daily/${today}/country-pinning`)
    await waitForAppReady(page)
    await page.waitForSelector('[data-testid="game-hud"]')
    await page.evaluate(() => {
      const hooks = (window as unknown as { __funworldmap_game?: { submitCountryGuess?: (cca3: string) => boolean } }).__funworldmap_game
      hooks?.submitCountryGuess?.('DEU')
    })
    await expect(page.getByTestId('game-done')).toBeVisible()
    await page.getByTestId('game-done').click()
    await expect(page.getByTestId('game-over')).toBeVisible()
  })
})
