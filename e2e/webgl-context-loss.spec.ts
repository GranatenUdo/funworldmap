import { test, expect } from '@playwright/test'
import {
  gotoAndWaitForMap,
  waitForCountryTilesRendered,
  forceWebGLContextLoss,
  ensureLauncherDismissed,
} from './helpers'

test.describe('WebGL context-loss recovery', () => {
  test('context loss shows MapErrorOverlay with webgl-lost reason', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await waitForCountryTilesRendered(page)

    await forceWebGLContextLoss(page)

    // Wait for the webgl-lost reason to be set — authoritative via data attribute.
    await expect(page.locator('[data-map-error="webgl-lost"]')).toBeAttached()
    await expect(page.getByTestId('map-error-overlay')).toBeVisible()
    await expect(page.getByTestId('map-error-overlay')).toContainText(/paused|context|restore/i)
  })

  test('retry button recovers the map after webgl-lost', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await ensureLauncherDismissed(page)
    await waitForCountryTilesRendered(page)

    await forceWebGLContextLoss(page)
    await expect(page.locator('[data-map-error="webgl-lost"]')).toBeAttached()
    await expect(page.getByTestId('map-error-retry')).toBeVisible()

    await page.getByTestId('map-error-retry').click()

    // retryWebGL() calls restoreContext() on the extension captured at init;
    // if the context doesn't restore within 1 s the app falls back to a full
    // reload. Both paths must end with the error cleared and a loaded map.
    // ([data-map-loaded] never detaches on context loss, so assert the error
    // attribute is gone FIRST — otherwise the reload path passes vacuously.)
    await expect(page.locator('[data-map-error]')).not.toBeAttached({ timeout: 60_000 })
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    await expect(page.getByTestId('map-error-overlay')).not.toBeVisible()
  })

  test('overlay shows correct title for webgl-lost reason', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await waitForCountryTilesRendered(page)

    await forceWebGLContextLoss(page)

    await expect(page.locator('[data-map-error="webgl-lost"]')).toBeAttached()
    // Title must be 'Map paused' per REASON_MESSAGES.
    await expect(page.getByTestId('map-error-overlay')).toContainText('Map paused')
    // Body must contain 'graphics context'.
    await expect(page.getByTestId('map-error-overlay')).toContainText('graphics context')
  })
})
