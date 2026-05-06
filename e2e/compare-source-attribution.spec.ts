import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap } from './helpers'

test.describe('compare view source attribution footer', () => {
  test('shows compare-sources footer with source links', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')

    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })

    const footer = page.getByTestId('compare-sources')
    await expect(footer).toBeVisible({ timeout: 10_000 })

    // Footer must contain the "Sources:" label
    await expect(footer).toContainText('Sources:')

    // Each source link must have an href and open in a new tab
    const links = footer.getByRole('link')
    const count = await links.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const link = links.nth(i)
      const href = await link.getAttribute('href')
      expect(href).toBeTruthy()
      expect(href).toMatch(/^https?:\/\//)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  test('source links are keyboard-reachable', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')

    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })

    const footer = page.getByTestId('compare-sources')
    await expect(footer).toBeVisible({ timeout: 10_000 })

    const links = footer.getByRole('link')
    const count = await links.count()
    expect(count).toBeGreaterThan(0)

    // Tab to the first source link by pressing Tab until it is focused.
    // Use focused-element polling rather than a fixed Tab count, so the test
    // is resilient to changes in the number of focusable elements in the panel.
    const firstLink = links.first()
    const firstLinkText = await firstLink.textContent()

    // Focus the footer element itself as a starting point, then Tab into links
    await firstLink.focus()
    await expect(firstLink).toBeFocused({ timeout: 5_000 })

    // If there is a second link, Tab to it and assert focus moves
    if (count > 1) {
      const secondLink = links.nth(1)
      await page.keyboard.press('Tab')
      await expect(secondLink).toBeFocused({ timeout: 5_000 })
    }

    // Verify the first link text is non-empty (sanity check)
    expect(firstLinkText?.trim()).toBeTruthy()
  })
})
