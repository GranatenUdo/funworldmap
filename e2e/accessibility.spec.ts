import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.setTimeout(30000)

test.describe('Accessibility', () => {
  test('skip to search link works', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    // Tab to the first skip link
    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('button', { name: 'Skip to search' })
    await expect(skipLink).toBeFocused()

    // Activate it
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Search input should be focused
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('skip to map link works', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    // Tab to first skip link, then tab to second
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('button', { name: 'Skip to map' })
    await expect(skipLink).toBeFocused()

    // Activate it
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Map container should be focused
    await expect(page.locator('[role="application"]')).toBeFocused()
  })

  test('ARIA live region announces country selection', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    // Navigate to a country via hash
    await page.evaluate(() => {
      window.location.hash = 'FRA'
    })
    await page.waitForTimeout(1000)

    const liveRegion = page.locator('[aria-live="polite"]').first()
    await expect(liveRegion).toContainText('France selected')
  })

  test('ARIA live region announces panel close', async ({ page }) => {
    await page.goto('/#FRA')
    await page.waitForTimeout(1500)

    // Close the panel
    await page.getByTestId('panel-close').click()
    await page.waitForTimeout(500)

    const liveRegion = page.locator('[aria-live="polite"]').first()
    await expect(liveRegion).toContainText('Country panel closed')
  })

  test('search combobox has correct ARIA attributes', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    const input = page.getByTestId('search-input')
    await expect(input).toHaveRole('combobox')
    await expect(input).toHaveAttribute('aria-expanded', 'false')
    await expect(input).toHaveAttribute('aria-controls', 'search-results')
    await expect(input).toHaveAttribute('aria-autocomplete', 'list')
  })

  test('panel has correct ARIA role and label', async ({ page }) => {
    await page.goto('/#FRA')
    await page.waitForTimeout(1500)

    const panel = page.getByTestId('country-panel')
    await expect(panel).toHaveAttribute('role', 'complementary')
    await expect(panel).toHaveAttribute('aria-label', 'Country information')
  })

  test('theme toggle has descriptive aria-label', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    const toggle = page.getByTestId('theme-toggle')
    const label = await toggle.getAttribute('aria-label')
    expect(label).toBeTruthy()
    expect(label).toContain('Switch to')
  })

  test('axe-core audit passes on home page', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-map-loaded], [data-map-error]').first().waitFor({ timeout: 15_000 })

    const results = await new AxeBuilder({ page })
      .exclude('.maplibregl-canvas') // canvas is inherently opaque
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('axe-core audit passes with country panel open', async ({ page }) => {
    await page.goto('/#FRA')
    // Wait for both the panel and the map-settled signal — the loading splash
    // dismisses only when the map reaches a terminal state, and its brand
    // text introduces a transient contrast violation if scanned earlier.
    await page.locator('[data-map-loaded], [data-map-error]').first().waitFor({ timeout: 15_000 })
    await page.getByTestId('country-panel').waitFor({ timeout: 5_000 })

    const results = await new AxeBuilder({ page })
      .exclude('.maplibregl-canvas')
      .analyze()

    expect(results.violations).toEqual([])
  })
})
