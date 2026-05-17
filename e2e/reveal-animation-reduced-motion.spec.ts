import { test, expect, type Page } from '@playwright/test'
import { waitForRevealLineCoords } from './helpers'

test.use({ colorScheme: 'dark', reducedMotion: 'reduce' })

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

test.describe('reveal animation — reduced motion', () => {
  test('full tessellated line is present immediately on wrong guess', async ({ page }) => {
    // test.use({ reducedMotion: 'reduce' }) does not propagate reliably under
    // chromium-gpu's custom --use-gl=angle launch args, so emulate explicitly
    // and assert with matchMedia before proceeding.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    // Seed lastMode so the shared unlimited link routes to country-pinning.
    await page.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'country-pinning')
    })
    await page.goto('/')
    await waitForMap(page)
    expect(
      await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    ).toBe(true)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-unlimited-link').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    await page.evaluate(() => window.__funworldmap_game?.setRound?.('FRA'))
    await expect(page.getByTestId('game-prompt-name')).toHaveText('France', { timeout: 10_000 })
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('DEU'))

    // Reduced-motion writes the full 65-point arc in one shot, not a rAF
    // sequence — the first polled frame must already have all 65 points.
    const handle = await waitForRevealLineCoords(page, { minPoints: 1 })
    const coords = await handle.jsonValue()
    expect(coords).toHaveLength(65)
  })
})
