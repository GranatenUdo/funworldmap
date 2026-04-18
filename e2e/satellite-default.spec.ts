import { test, expect } from '@playwright/test'

test.setTimeout(60_000)

test.describe('Satellite is the default basemap', () => {
  test('toggle is pressed on first load', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })

    const toggle = page.getByTestId('satellite-toggle')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  test('satellite raster layer is visible on first load', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })

    const visibility = await page.evaluate(() => {
      const map = (window as unknown as {
        __funworldmap_map?: { getLayoutProperty: (id: string, prop: string) => string | undefined }
      }).__funworldmap_map
      if (!map) return null
      return map.getLayoutProperty('satellite-layer', 'visibility')
    })

    expect(visibility).toBe('visible')
  })

  test('user can still toggle back to vector basemap', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })

    const toggle = page.getByTestId('satellite-toggle')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })
})
