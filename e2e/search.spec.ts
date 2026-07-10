import { test, expect } from '@playwright/test'
import { ensureLauncherDismissed, waitForAppReady } from './helpers'

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await ensureLauncherDismissed(page)
  })

  test('typing shows results dropdown', async ({ page }) => {
    await page.getByTestId('search-input').fill('France')

    const results = page.getByTestId('search-results')
    await expect(results).toBeVisible()
    // Wait for options to appear
    await expect(results.getByRole('option', { name: /^France\s/ }).first()).toBeVisible({
      timeout: 10_000,
    })
    // France should be the first result
    await expect(results.getByRole('option', { name: /^France\s/ }).first()).toContainText('France')
  })

  test('selecting a result opens the country panel', async ({ page }) => {
    const searchInput = page.getByTestId('search-input')
    await searchInput.fill('France')
    const firstOption = page
      .getByTestId('search-results')
      .getByRole('option', { name: /^France\s/ })
      .first()
    await expect(firstOption).toBeVisible({ timeout: 15_000 })
    // Auto-activation commits one render after the results appear — wait for
    // the activated state, not just visibility, before pressing Enter.
    await expect(firstOption).toHaveAttribute('aria-selected', 'true')

    // No ArrowDown: the top result is auto-activated, Enter commits it.
    await searchInput.press('Enter')

    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 15_000 })
      .toBe('#FRA')
    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await expect(panel).toContainText('France')
  })

  test('fuzzy matching works for typos', async ({ page }) => {
    await page.getByTestId('search-input').fill('Untied')

    const results = page.getByTestId('search-results')
    await expect(results).toBeVisible()
    await expect(results).toContainText('United')
  })

  test('keyboard navigation: top result auto-active, arrows move, enter selects', async ({
    page,
  }) => {
    const input = page.getByTestId('search-input')
    await input.fill('Ger')

    // Wait for options to be present before pressing keys — ensures React has
    // committed the isOpen state that gates onKeyDown. 'Ger' fuzzy-matches
    // several countries (Germany, Niger, Nigeria, Algeria), so there are
    // always ≥2 options for the arrow-key round trip below.
    const options = page.getByTestId('search-results').getByRole('option')
    await expect(options.nth(1)).toBeVisible({ timeout: 15_000 })

    // The top result is auto-activated as soon as results appear.
    await expect(options.first()).toHaveAttribute('aria-selected', 'true')

    // Arrows move the active option and back.
    await input.press('ArrowDown')
    await expect(options.first()).toHaveAttribute('aria-selected', 'false')
    await input.press('ArrowUp')
    await expect(options.first()).toHaveAttribute('aria-selected', 'true')

    // Enter commits whichever country is top-ranked — derive the expectation
    // from the option itself rather than assuming Fuse's ordering
    // (CLAUDE.md: never assert Fuse.js result order).
    const topName = await options.first().getByTestId('search-option-name').textContent()
    if (!topName) throw new Error('top search option rendered without a name')
    await input.press('Enter')

    await expect(page.getByTestId('country-panel')).toBeVisible()
    await expect(page.getByTestId('country-panel')).toContainText(topName)
  })

  test('escape closes dropdown', async ({ page }) => {
    const input = page.getByTestId('search-input')
    await input.fill('Japan')

    await expect(page.getByTestId('search-results')).toBeVisible()

    await input.press('Escape')

    await expect(page.getByTestId('search-results')).not.toBeAttached()
  })

  test('no results message for unknown query', async ({ page }) => {
    await page.getByTestId('search-input').fill('xyznotacountry')

    await expect(page.getByTestId('search-no-results')).toBeVisible()
    await expect(page.getByTestId('search-no-results')).toContainText('No countries found')
  })

  test('clear button clears input', async ({ page }) => {
    const input = page.getByTestId('search-input')
    await input.fill('Brazil')

    await expect(page.getByTestId('search-results')).toBeVisible()

    await page.getByTestId('search-clear').click()

    await expect(input).toHaveValue('')
    await expect(page.getByTestId('search-results')).not.toBeAttached()
  })

  test('search by capital city', async ({ page }) => {
    await page.getByTestId('search-input').fill('Paris')

    await expect(page.getByTestId('search-results')).toContainText('France')
  })

  test('search by country code', async ({ page }) => {
    await page.getByTestId('search-input').fill('USA')

    await expect(page.getByTestId('search-results')).toContainText('United States')
  })

  test('keyboard hint is visible when dropdown is open', async ({ page }) => {
    const input = page.getByTestId('search-input')
    await input.fill('fra')

    await expect(page.getByTestId('search-results')).toBeVisible()
    await expect(page.getByTestId('search-keyboard-hint')).toBeVisible()
    await expect(page.getByTestId('search-keyboard-hint')).toContainText('Select')
    await expect(page.getByTestId('search-keyboard-hint')).toContainText('Confirm')
    await expect(page.getByTestId('search-keyboard-hint')).toContainText('Close')
  })

  test('keyboard hint is hidden when dropdown closes', async ({ page }) => {
    const input = page.getByTestId('search-input')
    await input.fill('fra')

    await expect(page.getByTestId('search-results')).toBeVisible()
    await expect(page.getByTestId('search-keyboard-hint')).toBeVisible()

    // Clear the input — dropdown should close and hint should disappear
    await input.fill('')

    await expect(page.getByTestId('search-results')).not.toBeAttached()
    await expect(page.getByTestId('search-keyboard-hint')).not.toBeAttached()
  })

  test('keyboard hint is hidden when no results', async ({ page }) => {
    const input = page.getByTestId('search-input')
    await input.fill('xyznotacountry')

    await expect(page.getByTestId('search-no-results')).toBeVisible()
    // Hint should not be visible when there are no results
    const hint = page.getByTestId('search-keyboard-hint')
    await expect(hint).toHaveCount(0)
  })
})
