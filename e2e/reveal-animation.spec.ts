import { test, expect, type Page } from '@playwright/test'
import { waitForRevealLineCoords } from './helpers'

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

test.describe('reveal animation', () => {
  test('wrong country guess renders a tessellated line from guess → target', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await page.getByTestId('launcher-card-country-pinning-free-link').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    // Pin France as the target, then submit Germany as the guess.
    await page.evaluate(() => window.__funworldmap_game?.setRound?.('FRA'))
    await expect(page.getByTestId('game-prompt-name')).toHaveText('France', { timeout: 10_000 })
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('DEU'))

    // Wait for animation completion (full 65-point tessellated arc settled).
    const geom = await waitForRevealLineCoords(page, { minPoints: 65 })
    const coords = await geom.jsonValue()

    // 64 segments => 65 vertices. Endpoints match DEU (lng 9, lat 51) and
    // FRA (lng 2, lat 46) centroids; `toBeCloseTo(_, 0)` tolerates ±0.5°.
    expect(coords).toHaveLength(65)
    expect(coords[0][0]).toBeCloseTo(9, 0)
    expect(coords[0][1]).toBeCloseTo(51, 0)
    expect(coords[64][0]).toBeCloseTo(2, 0)
    expect(coords[64][1]).toBeCloseTo(46, 0)

    // Camera ends near the target centroid (FRA = [2, 46]). 2° tolerance
    // accommodates the final-frame quantisation of arc[idx].
    const center = await page.evaluate(() => {
      const c = window.__funworldmap_map?.getCenter()
      return c ? { lng: c.lng, lat: c.lat } : null
    })
    expect(center).not.toBeNull()
    expect(center!.lng).toBeCloseTo(2, 0)
    expect(center!.lat).toBeCloseTo(46, 0)
  })

  test('city-guessing wrong guess renders a tessellated line from point → target', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await page.getByTestId('launcher-card-city-guessing-free-link').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    // Submit a point guess at [0, 0] — target is whatever the mode picked.
    await page.evaluate(() => {
      window.__funworldmap_game?.submitGuess?.({ kind: 'point', lngLat: [0, 0] })
    })

    const geom = await waitForRevealLineCoords(page, { minPoints: 65 })
    const coords = await geom.jsonValue()

    expect(coords).toHaveLength(65)
    expect(coords[0][0]).toBeCloseTo(0, 5)
    expect(coords[0][1]).toBeCloseTo(0, 5)
  })
})
