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
    const ICE_ACCESSIBLE_RGB = '7, 89, 133' // #075985 — --color-ice-accessible
    const ICE_RGB = '125, 211, 252' // #7dd3fc — --color-ice
    const SIGNAL_RGB = '255, 138, 76' // #ff8a4c — --color-signal (compare-A)
    const DARK_INK_RGB = '18, 21, 24' // #121518 — --color-dark-500 (compare-badge ink)

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

    test('header wordmark uses ice-accessible in light mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const wordmark = page.getByTestId('header-wordmark')
      await expect(wordmark).toBeVisible()
      expect(await computedColor(wordmark)).toContain(ICE_ACCESSIBLE_RGB)
    })

    test('header Play button uses ice-accessible in light mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const play = page.getByTestId('header-play')
      await expect(play).toBeVisible()
      expect(await computedColor(play)).toContain(ICE_ACCESSIBLE_RGB)
    })

    test('header wordmark keeps ice in dark mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'dark'))
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const wordmark = page.getByTestId('header-wordmark')
      await expect(wordmark).toBeVisible()
      expect(await computedColor(wordmark)).toContain(ICE_RGB)
    })

    test('map nav-control buttons use ice-accessible in light mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const button = page
        .locator('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button')
        .first()
      await expect(button).toBeVisible()
      expect(await computedColor(button)).toContain(ICE_ACCESSIBLE_RGB)
    })

    test('map nav-control buttons keep ice in dark mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'dark'))
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const button = page
        .locator('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button')
        .first()
      await expect(button).toBeVisible()
      expect(await computedColor(button)).toContain(ICE_RGB)
    })

    async function computedBackground(locator: Locator): Promise<string> {
      return locator.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    }

    test('compare badges: A is signal, B is ice, ink is dark-500 (AA on both)', async ({
      page,
    }) => {
      await page.goto('/#FRA')
      const panel = page.getByTestId('country-panel')
      await expect(panel).toBeVisible({ timeout: 15_000 })
      await panel.getByRole('button', { name: /Compare with another country/i }).click()
      await panel.getByRole('button', { name: 'Germany' }).click()
      const badgeA = page.locator('.compare-badge-a')
      const badgeB = page.locator('.compare-badge-b')
      await expect(badgeA).toBeVisible()
      await expect(badgeB).toBeVisible()
      // #121518 on #ff8a4c = 7.85:1, on #7dd3fc = 10.99:1 — the retired
      // white-on-coral/teal-dim badges were 3.67:1 / 3.74:1 (sub-AA).
      expect(await computedBackground(badgeA)).toContain(SIGNAL_RGB)
      expect(await computedBackground(badgeB)).toContain(ICE_RGB)
      expect(await computedColor(badgeA)).toContain(DARK_INK_RGB)
      expect(await computedColor(badgeB)).toContain(DARK_INK_RGB)
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

  test.describe('Map control touch targets (B7)', () => {
    // Pixel-7-like emulation: isMobile + hasTouch flip Chromium's CSS
    // `pointer` media feature to coarse, so the `@media (pointer: coarse)`
    // block in src/index.css applies. Fine-pointer desktop runs keep
    // MapLibre's stock 29px buttons — that path is intentionally unasserted.
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test('every bottom-right map control button is >= 44px on coarse pointers', async ({
      page,
    }) => {
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const buttons = page.locator('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button')
      await expect(buttons.first()).toBeVisible()
      // zoom-in, zoom-out, compass (NavigationControl) + reset (ResetViewControl)
      await expect(buttons).toHaveCount(4)
      for (let i = 0; i < 4; i++) {
        const box = await buttons.nth(i).boundingBox()
        expect(box, `button ${i} bounding box`).not.toBeNull()
        expect(box!.width, `button ${i} width`).toBeGreaterThanOrEqual(44)
        expect(box!.height, `button ${i} height`).toBeGreaterThanOrEqual(44)
      }
    })

    test('reset control keeps its accessible name', async ({ page }) => {
      await page.goto('/')
      await ensureLauncherDismissed(page)
      await expect(page.getByRole('button', { name: 'Reset to world view' })).toBeVisible()
    })
  })
})
