import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  ensureLauncherDismissed,
  waitForAppReady,
  openLauncher,
  gotoAndWaitForMap,
} from './helpers'

test.setTimeout(60_000)

test.describe('Accessibility', () => {
  test('skip to search link works', async ({ page }) => {
    await page.goto('/')
    await ensureLauncherDismissed(page)
    // Test the skip-link's CONTRACT: when focused and activated, it moves
    // focus to the search input. Reaching it via Tab is a separate concern
    // that depends on overall tab order (map controls, launcher state,
    // etc.) and is brittle across environments. Focus + Enter tests the
    // thing the skip link actually does for the user.
    const skipLink = page.getByRole('button', { name: 'Skip to search' })
    await skipLink.focus()
    await expect(skipLink).toBeFocused()

    await page.keyboard.press('Enter')

    // Search input should be focused
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('skip to map link works', async ({ page }) => {
    await page.goto('/')
    await ensureLauncherDismissed(page)
    const skipLink = page.getByRole('button', { name: 'Skip to map' })
    await skipLink.focus()
    await expect(skipLink).toBeFocused()

    // Activate it
    await page.keyboard.press('Enter')

    // Map container should be focused
    await expect(page.locator('[role="application"]')).toBeFocused()
  })

  test('ARIA live region announces country selection', async ({ page }) => {
    await page.goto('/')
    await ensureLauncherDismissed(page)

    // Navigate to a country via hash
    await page.evaluate(() => {
      window.location.hash = 'FRA'
    })

    const liveRegion = page.locator('[aria-live="polite"]').first()
    await expect(liveRegion).toContainText('France selected')
  })

  test('ARIA live region announces panel close', async ({ page }) => {
    await page.goto('/#FRA')
    await expect(page.getByTestId('country-panel')).toBeVisible()

    // Close the panel
    await page.getByTestId('panel-close').click()

    const liveRegion = page.locator('[aria-live="polite"]').first()
    await expect(liveRegion).toContainText('Country panel closed')
  })

  test('search combobox has correct ARIA attributes', async ({ page }) => {
    await page.goto('/')
    await ensureLauncherDismissed(page)

    const input = page.getByTestId('search-input')
    await expect(input).toHaveRole('combobox')
    await expect(input).toHaveAttribute('aria-expanded', 'false')
    await expect(input).toHaveAttribute('aria-controls', 'search-results')
    await expect(input).toHaveAttribute('aria-autocomplete', 'list')
  })

  test('panel has correct ARIA role and label', async ({ page }) => {
    await page.goto('/#FRA')
    await expect(page.getByTestId('country-panel')).toBeVisible()

    const panel = page.getByTestId('country-panel')
    await expect(panel).toHaveAttribute('role', 'complementary')
    await expect(panel).toHaveAttribute('aria-label', 'Country information')
  })

  test('theme toggle has descriptive aria-label', async ({ page }) => {
    await page.goto('/')
    await ensureLauncherDismissed(page)

    const toggle = page.getByTestId('theme-toggle')
    await expect(toggle).toHaveAttribute('aria-label', /Switch to/)
  })

  test('axe-core audit passes on home page', async ({ page }) => {
    await page.goto('/')
    await ensureLauncherDismissed(page)
    await page.locator('main').waitFor({ timeout: 15_000 })

    const results = await new AxeBuilder({ page })
      .exclude('.maplibregl-canvas') // canvas is inherently opaque
      .exclude('.z-\\[200\\]') // ephemeral loading splash — aria-hidden but axe still scans color
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('axe-core audit passes with country panel open', async ({ page }) => {
    await page.goto('/#FRA')
    await page.locator('main').waitFor({ timeout: 15_000 })
    await page.getByTestId('country-panel').waitFor({ timeout: 10_000 })

    const results = await new AxeBuilder({ page })
      .exclude('.maplibregl-canvas')
      .exclude('.z-\\[200\\]')
      .analyze()

    expect(results.violations).toEqual([])
  })

  // ── Surface 1: Launcher (idle) ────────────────────────────────────────────
  test('axe-core audit passes on launcher (idle)', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await waitForAppReady(page)
    await openLauncher(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    const results = await new AxeBuilder({ page })
      .include('[data-testid="launcher"]')
      .exclude('.maplibregl-canvas')
      .exclude('.z-\\[200\\]')
      .analyze()
    expect(results.violations).toEqual([])
  })
})
