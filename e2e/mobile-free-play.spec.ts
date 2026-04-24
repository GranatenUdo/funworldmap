import { test, expect } from '@playwright/test'
import { routeMapTiles } from './helpers'

test.setTimeout(60_000)

test.describe('mobile — free play', () => {
  test('country-pinning free play starts and records a wrong guess', async ({ page }) => {
    await routeMapTiles(page)
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })

    await page.getByTestId('launcher-card-country-pinning-free-link').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { setRound: (c: string) => boolean } }).__funworldmap_game
      g?.setRound('FRA')
    })
    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { submitCountryGuess: (c: string) => boolean } }).__funworldmap_game
      g?.submitCountryGuess('DEU')
    })

    await expect(page.getByTestId('hud-lives')).toHaveAttribute('aria-label', '2 lives remaining', { timeout: 5_000 })
  })

  test('city-guessing free play starts and records a wrong point guess', async ({ page }) => {
    await routeMapTiles(page)
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })

    await page.getByTestId('launcher-card-city-guessing-free-link').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { submitGuess: (i: { kind: string; lngLat: [number, number] }) => void } }).__funworldmap_game
      g?.submitGuess({ kind: 'point', lngLat: [0, 0] })
    })

    // Round-ended → round advances → HUD still visible.
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 10_000 })
  })
})
