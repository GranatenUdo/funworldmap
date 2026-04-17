import { test, expect } from '@playwright/test'

test.describe('keyboard map navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]')
  })

  test('Home announces "View reset" via live region', async ({ page }) => {
    await page.locator('[role="application"]').focus()
    await page.keyboard.press('Home')
    // Live-region updates synchronously when Home fires; small buffer for React effect.
    await expect(page.locator('[data-testid="announce-region"]')).toContainText('View reset')
  })

  test('Home flies camera back to default center', async ({ page }) => {
    await page.locator('[role="application"]').focus()

    // Pan via the underlying map API to a known offset, then verify Home brings us back.
    await page.evaluate(() => {
      const map = (
        window as unknown as {
          __funworldmap_map?: {
            jumpTo: (opts: { center: [number, number]; zoom: number }) => void
          }
        }
      ).__funworldmap_map
      map?.jumpTo({ center: [50, 30], zoom: 3 })
    })

    await page.keyboard.press('Home')
    await page.waitForTimeout(1600) // flyTo duration

    const center = await page.evaluate(() => {
      const map = (
        window as unknown as {
          __funworldmap_map?: { getCenter: () => { lng: number; lat: number } }
        }
      ).__funworldmap_map
      return map ? map.getCenter() : null
    })
    expect(center).not.toBeNull()
    if (center) {
      // Default center is roughly [0, 0..30]; certainly not at lng=50 anymore.
      expect(Math.abs(center.lng)).toBeLessThan(20)
    }
  })

  test('focus ring is visible on the map container when tabbed to', async ({ page }) => {
    await page.locator('[role="application"]').focus()
    const hasOutline = await page.locator('[role="application"]').evaluate((el) => {
      const style = getComputedStyle(el)
      return style.outlineStyle !== 'none' && style.outlineWidth !== '0px'
    })
    expect(hasOutline).toBe(true)
  })
})
