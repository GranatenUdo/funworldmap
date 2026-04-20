import { test, expect, type Locator, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function openPanel(page: Page, cca3: string, expectedName: string) {
  await page.goto(`/#${cca3}`)
  const panel = page.getByTestId('country-panel')
  await expect(panel).toBeVisible({ timeout: 15_000 })
  await expect(panel).toContainText(expectedName, { timeout: 15_000 })
  return panel
}

async function computedFontSizePx(locator: Locator): Promise<number> {
  const value = await locator.evaluate((el) => window.getComputedStyle(el).fontSize)
  return parseFloat(value)
}

test.describe('A11y + Contrast Pass', () => {
  test.describe('Region-badge size floor', () => {
    test('single-panel region badge is >= 11px', async ({ page }) => {
      const panel = await openPanel(page, 'FRA', 'France')
      const badge = panel.getByTestId('region-badge').first()
      const px = await computedFontSizePx(badge)
      expect(px).toBeGreaterThanOrEqual(11)
    })

    test('compare-column region badges are >= 11px', async ({ page }) => {
      await page.goto('/#FRA')
      const panel = page.getByTestId('country-panel')
      await expect(panel).toBeVisible({ timeout: 15_000 })
      await panel.getByRole('button', { name: /Compare with another country/i }).click()
      await panel.getByRole('button', { name: 'Germany' }).click()
      const badges = panel.getByTestId('region-badge')
      const count = await badges.count()
      expect(count).toBeGreaterThanOrEqual(2)
      for (let i = 0; i < count; i++) {
        const px = await computedFontSizePx(badges.nth(i))
        expect(px).toBeGreaterThanOrEqual(11)
      }
    })

    test('search-result region badge is >= 11px', async ({ page }) => {
      await page.goto('/')
      await page.getByTestId('search-input').fill('Germany')
      const firstResult = page
        .getByTestId('search-results')
        .getByRole('option')
        .first()
      await expect(firstResult).toBeVisible({ timeout: 10_000 })
      const badge = firstResult.getByTestId('region-badge')
      const px = await computedFontSizePx(badge)
      expect(px).toBeGreaterThanOrEqual(11)
    })
  })
})
