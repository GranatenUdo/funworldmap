import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, openLauncher, waitForGameTestHook } from './helpers'

test.setTimeout(60_000)

test.describe('mobile — free play', () => {
  test('country-pinning free play starts and records a wrong guess', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'country-pinning')
    })
    await gotoAndWaitForMap(page)
    await openLauncher(page)

    await page.getByTestId('launcher-unlimited-link').click()
    await waitForGameTestHook(page)

    await page.evaluate(() => window.__funworldmap_game?.setRound?.('FRA'))
    // Wait for the round override to commit before submitting
    await expect(page.getByTestId('game-prompt-name')).toHaveText('France', { timeout: 5_000 })
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('DEU'))

    await expect(page.getByTestId('hud-lives')).toHaveAttribute('aria-label', '2 lives remaining', {
      timeout: 5_000,
    })
  })

  test('city-guessing free play starts and records a wrong point guess', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'city-guessing')
    })
    await gotoAndWaitForMap(page)
    await openLauncher(page)

    await page.getByTestId('launcher-unlimited-link').click()
    await waitForGameTestHook(page)

    await page.evaluate(() => {
      window.__funworldmap_game?.submitGuess?.({ kind: 'point', lngLat: [0, 0] })
    })

    // Round-ended → round advances → HUD still visible.
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 10_000 })
  })
})
