import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

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
    // Allow one animation frame for filter + paint to settle.
    await page.waitForTimeout(500)

    // In compare view, dimming pins borders at 0.15.
    const dimmedOpacity = await getBorderOpacity(page)
    expect(dimmedOpacity).toBeCloseTo(0.15, 2)

    // Exit compare.
    await page.evaluate(() => {
      window.location.hash = '#FRA'
    })
    await page.waitForTimeout(500)

    // Satellite-default opacity is 0.6, not the dimmed value.
    const restoredOpacity = await getBorderOpacity(page)
    expect(restoredOpacity).toBeCloseTo(0.6, 2)
  })
})
