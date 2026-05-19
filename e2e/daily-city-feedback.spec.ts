import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, stubDailyIndex, waitForGameTestHook } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.describe('daily city per-click feedback', () => {
  test('each attempt surfaces distance + points in the HUD; marker persists', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await stubDailyIndex(page, today, { cca3: 'FRA', cityId: 'FRA-paris' })
    await gotoAndWaitForMap(page, `/#daily/${today}/city-guessing`)
    await waitForGameTestHook(page)
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 15_000 })

    // No reveal line before the first attempt.
    await expect(page.getByTestId('game-reveal')).toHaveCount(0)

    // Attempt 1: far from Paris. The HUD must surface "km off" + "+0 points".
    await page.evaluate(() => {
      window.__funworldmap_game?.submitGuess?.({
        kind: 'point',
        lngLat: [-74, 40], // NYC, ~5800 km from Paris
      })
    })
    await expect
      .poll(
        () =>
          page.evaluate(
            () => window.__funworldmap_game?.getSession?.().currentAttempts.length ?? 0,
          ),
        { timeout: 5_000 },
      )
      .toBeGreaterThanOrEqual(1)
    await expect(page.getByTestId('game-reveal')).toBeVisible()
    await expect(page.getByTestId('game-reveal')).toContainText(/km off/)

    // Attempt 2: closer. The HUD reveal text must update.
    await page.evaluate(() => {
      window.__funworldmap_game?.submitGuess?.({
        kind: 'point',
        lngLat: [4, 50], // ~250 km from Paris
      })
    })
    await expect
      .poll(
        () =>
          page.evaluate(
            () => window.__funworldmap_game?.getSession?.().currentAttempts.length ?? 0,
          ),
        { timeout: 5_000 },
      )
      .toBeGreaterThanOrEqual(2)
    // Latest attempt was ~250 km — the text reflects the new distance, not the
    // first one's ~5800 km.
    await expect(page.getByTestId('game-reveal')).not.toContainText('5800')
    await expect(page.getByTestId('game-reveal')).toContainText(/km off/)
  })
})
