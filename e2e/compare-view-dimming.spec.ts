import { test, expect, type Page } from '@playwright/test'

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

async function getBorderOpacity(page: Page): Promise<number> {
  return page.evaluate(() => {
    const map = (window as unknown as {
      __funworldmap_map?: { getPaintProperty: (id: string, prop: string) => number }
    }).__funworldmap_map
    if (!map) throw new Error('map not exposed')
    return map.getPaintProperty('country-borders', 'line-opacity')
  })
}

test.describe('compare view dimming interacts with satellite mode', () => {
  test('exiting compare with satellite ON restores satellite border opacity', async ({ page }) => {
    // Satellite is ON by default.
    await page.goto('/#FRA,DEU')
    await waitForMap(page)
    // Poll until dimming animation settles to the compare-view value (0.15).
    await expect.poll(() => getBorderOpacity(page), { timeout: 15_000 }).toBeCloseTo(0.15, 2)

    // Exit compare.
    await page.evaluate(() => {
      window.location.hash = '#FRA'
    })
    // Poll until dimming releases back to the satellite-default value (0.6).
    await expect.poll(() => getBorderOpacity(page), { timeout: 15_000 }).toBeCloseTo(0.6, 2)
  })
})
