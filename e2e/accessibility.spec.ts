import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.setTimeout(60_000)

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

  test('axe-core audit passes on game-over overlay', async ({ page }) => {
    await page.goto('/#game/country-pinning/play')
    await page.waitForSelector('[data-map-loaded]', { timeout: 30_000 })

    // GameController registers test hooks after the mode resolves + first round
    // dispatches, which races [data-map-loaded] on slow chromium CI. Wait for
    // the hook to exist before driving the game to game-over.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            type H = { submitCountryGuess?: unknown; setRound?: unknown }
            const g = (window as unknown as { __funworldmap_game?: H }).__funworldmap_game
            return typeof g?.submitCountryGuess === 'function' && typeof g?.setRound === 'function'
          }),
        { timeout: 15_000 },
      )
      .toBe(true)

    // Force game-over via the test hook: set a round, submit three wrong guesses.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        type H = {
          setRound?: (cca3: string) => boolean
          submitCountryGuess?: (cca3: string) => boolean
        }
        const g = (window as unknown as { __funworldmap_game?: H }).__funworldmap_game
        g?.setRound?.('FRA')
        g?.submitCountryGuess?.('AUS')
      })
      await page.waitForTimeout(100)
    }

    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })

    // Scope the audit to the overlay itself. The map canvas and HUD behind
    // the overlay produce their own a11y noise that isn't what this test
    // verifies — we want to assert the overlay is well-formed, not re-audit
    // the whole page.
    const results = await new AxeBuilder({ page })
      .include('[data-testid="game-over"]')
      .analyze()

    expect(results.violations).toEqual([])
  })
})
