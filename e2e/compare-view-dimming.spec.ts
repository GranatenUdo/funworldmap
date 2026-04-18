import { test, expect } from '@playwright/test'

/** Guard for Phase 5 call-order coupling: useCompareViewDimming must run
 *  after useMapTheme so the dimming wins on theme change while in compare. */
test.describe('compare-view dimming survives theme toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]')
  })

  test('country-borders stays dimmed in compare view after toggling dark mode', async ({ page }) => {
    // Open compare view via URL hash to skip the picking flow.
    await page.evaluate(() => {
      window.location.hash = 'FRA,DEU'
    })
    await page.waitForFunction(
      () => document.querySelector('[data-testid="country-panel"]') !== null,
    )
    // Wait for the dimming effect to settle (effects run sync after mount,
    // but the camera flyTo and paint commits are async).
    await page.waitForTimeout(500)

    const dimmedOpacity = await page.evaluate(() => {
      const map = (
        window as unknown as {
          __funworldmap_map?: { getPaintProperty: (id: string, prop: string) => unknown }
        }
      ).__funworldmap_map
      return map?.getPaintProperty('country-borders', 'line-opacity') ?? null
    })
    expect(dimmedOpacity).toBe(0.15)

    // Toggle theme — this re-runs useMapTheme (writes 0.5/0.35) and then
    // useCompareViewDimming (writes 0.15). Last writer wins; assert 0.15.
    await page.locator('[data-testid="theme-toggle"]').click()
    await page.waitForTimeout(500)

    const opacityAfterToggle = await page.evaluate(() => {
      const map = (
        window as unknown as {
          __funworldmap_map?: { getPaintProperty: (id: string, prop: string) => unknown }
        }
      ).__funworldmap_map
      return map?.getPaintProperty('country-borders', 'line-opacity') ?? null
    })
    expect(opacityAfterToggle).toBe(0.15)
  })
})
