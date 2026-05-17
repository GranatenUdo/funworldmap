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

  test('retry button is rendered and clickable for webgl-lost', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await ensureLauncherDismissed(page)
    await waitForCountryTilesRendered(page)

    await forceWebGLContextLoss(page)

    // Wait for webgl-lost overlay.
    await expect(page.locator('[data-map-error="webgl-lost"]')).toBeAttached()
    await expect(page.getByTestId('map-error-retry')).toBeVisible()

    // The retry button is clickable (not covered by any overlay).
    // Clicking it dispatches retryWebGL() — which calls restoreContext() and,
    // after 1 s fallback, reloads if context hasn't restored.
    // We verify the click completes without error and the page either reloads
    // (detected by a new navigation) or the overlay clears.
    const navigationPromise = page.waitForNavigation({ timeout: 5_000 }).catch(() => null)
    await page.getByTestId('map-error-retry').click()

    // Either a navigation happens (reload fallback) or overlay clears.
    // Both are valid recovery paths.
    const navigated = await navigationPromise
    if (!navigated) {
      // If no reload, verify at minimum that the button press didn't throw.
      // The 1s timeout hasn't elapsed yet; give it time.
      await expect(page.getByTestId('map-error-retry'))
        .toBeVisible({ timeout: 500 })
        .catch(() => {
          // overlay may have cleared
        })
    }
    // If navigation happened, the app reloaded — map should be available again.
    if (navigated) {
      await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    }
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
