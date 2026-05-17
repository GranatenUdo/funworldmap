import { test, expect } from '@playwright/test'
import { ensureLauncherDismissed, waitForAppReady, routeMapTiles } from './helpers'

test.setTimeout(60_000)

test.describe('Satellite is the default basemap', () => {
  // routeMapTiles stubs external tile / sprite / TileJSON requests so that
  // network variance cannot block MapLibre's 'load' event.  The stub runs
  // before page.goto so the intercepts are in place before any fetch fires.
  test.beforeEach(async ({ page }) => {
    await routeMapTiles(page)
  })

  test('toggle is pressed on first load', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await ensureLauncherDismissed(page)

    // aria-pressed is driven by React state (satellite = useState(true))
    // and does not require the MapLibre 'load' event.
    const toggle = page.getByTestId('satellite-toggle')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  test('satellite raster layer is visible on first load', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await ensureLauncherDismissed(page)

    // satellite-layer is added by addRasterSources() inside onLoad(), so we
    // must wait for the MapLibre 'load' event to have fired.
    await page.waitForSelector('[data-map-loaded]', { timeout: 30_000 })

    const visibility = await page.evaluate(() => {
      const map = (
        window as unknown as {
          __funworldmap_map?: {
            getLayoutProperty: (id: string, prop: string) => string | undefined
          }
        }
      ).__funworldmap_map
      if (!map) return null
      return map.getLayoutProperty('satellite-layer', 'visibility')
    })

    expect(visibility).toBe('visible')
  })

  test('user can still toggle back to vector basemap', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await ensureLauncherDismissed(page)

    // Toggle click and aria-pressed check work on React state alone —
    // no map-loaded synchronisation needed.
    const toggle = page.getByTestId('satellite-toggle')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })
})
