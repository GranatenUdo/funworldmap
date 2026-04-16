import { test, expect } from '@playwright/test'

test.describe('map reliability', () => {
  test('shows error overlay when basemap style is unreachable', async ({ page }) => {
    await page.route('**/tiles.openfreemap.org/**', (route) => route.abort('failed'))

    await page.goto('/')

    const overlay = page.getByTestId('map-error-overlay')
    await expect(overlay).toBeVisible({ timeout: 15_000 })
    await expect(overlay).toContainText(/map|load/i)

    const retry = page.getByTestId('map-error-retry')
    await expect(retry).toBeVisible()
    await expect(retry).toBeEnabled()
  })

  test('retry button triggers reload', async ({ page }) => {
    await page.route('**/tiles.openfreemap.org/**', (route) => route.abort('failed'))
    await page.goto('/')

    const retry = page.getByTestId('map-error-retry')
    await expect(retry).toBeVisible({ timeout: 15_000 })

    // Reload tears down the page mid-click; noWaitAfter prevents Playwright
    // from waiting on the detaching element. Verify by asserting the overlay
    // re-appears after reload (route stays blocked).
    await retry.click({ noWaitAfter: true })
    await expect(page.getByTestId('map-error-overlay')).toBeVisible({ timeout: 20_000 })
  })

  test('shows degraded-mode banner when basemap probe fails', async ({ page }) => {
    // Abort only the probe request (distinguished by ?probe=1), let
    // MapLibre's style fetch through — simulates a provider that fails
    // our explicit probe but is otherwise reachable.
    await page.route('**/tiles.openfreemap.org/styles/positron**', (route) => {
      if (route.request().url().includes('probe=1')) return route.abort('failed')
      return route.continue()
    })

    await page.goto('/')

    const banner = page.getByTestId('basemap-banner')
    await expect(banner).toBeVisible({ timeout: 8_000 })

    await banner.getByRole('button', { name: /dismiss/i }).click()
    await expect(banner).toBeHidden()
  })
})
