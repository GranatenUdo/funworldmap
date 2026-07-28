import { test, expect, type Locator, type Page } from '@playwright/test'
import { ensureLauncherDismissed } from './helpers'

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
      await ensureLauncherDismissed(page)
      await page.getByTestId('search-input').fill('Germany')
      const result = page.getByTestId('search-results').getByRole('option', { name: /^Germany\s/ })
      await expect(result).toBeVisible({ timeout: 10_000 })
      const badge = result.getByTestId('region-badge')
      const px = await computedFontSizePx(badge)
      expect(px).toBeGreaterThanOrEqual(11)
    })
  })

  test.describe('Meta-color contrast', () => {
    // Use substring matching — Chromium normalises to `rgb(...)`, but older
    // WebKit/Firefox builds can emit `rgba(R, G, B, 1)` for the same color
    // declaration. `toContain` is format-agnostic.
    const SAND_600_RGB = '107, 100, 89' // #6b6459
    const DARK_100_RGB = '148, 163, 184' // #94a3b8
    const TEAL_ACCESSIBLE_RGB = '6, 95, 86' // #065f56 — --color-teal-accessible
    const TEAL_LIGHT_RGB = '94, 234, 212' // #5eead4 — --color-teal-light

    async function computedColor(locator: Locator): Promise<string> {
      return locator.evaluate((el) => window.getComputedStyle(el).color)
    }

    test('official-name line uses sand-600 in light mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
      const panel = await openPanel(page, 'FRA', 'France')
      const official = panel.getByText('French Republic').first()
      const color = await computedColor(official)
      expect(color).toContain(SAND_600_RGB)
    })

    test('official-name line is unchanged in dark mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'dark'))
      const panel = await openPanel(page, 'FRA', 'France')
      const official = panel.getByText('French Republic').first()
      const color = await computedColor(official)
      expect(color).toContain(DARK_100_RGB)
    })

    test('close-button icon uses sand-600 in light mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
      const panel = await openPanel(page, 'FRA', 'France')
      const closeBtn = panel.getByTestId('panel-close')
      const color = await computedColor(closeBtn)
      expect(color).toContain(SAND_600_RGB)
    })

    test('header wordmark uses teal-accessible in light mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const wordmark = page.getByTestId('header-wordmark')
      await expect(wordmark).toBeVisible()
      expect(await computedColor(wordmark)).toContain(TEAL_ACCESSIBLE_RGB)
    })

    test('header Play button uses teal-accessible in light mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const play = page.getByTestId('header-play')
      await expect(play).toBeVisible()
      expect(await computedColor(play)).toContain(TEAL_ACCESSIBLE_RGB)
    })

    test('header wordmark keeps teal-light in dark mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'dark'))
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const wordmark = page.getByTestId('header-wordmark')
      await expect(wordmark).toBeVisible()
      expect(await computedColor(wordmark)).toContain(TEAL_LIGHT_RGB)
    })
  })

  test.describe('Tabular figures on DataCell', () => {
    test('DataCell values have font-variant-numeric: tabular-nums', async ({ page }) => {
      const panel = await openPanel(page, 'FRA', 'France')
      const valueCells = panel.locator('[data-testid="data-cell-value"]')
      const count = await valueCells.count()
      expect(count).toBeGreaterThan(0)
      const variant = await valueCells
        .first()
        .evaluate((el) => window.getComputedStyle(el).fontVariantNumeric)
      expect(variant).toContain('tabular-nums')
    })
  })
})
