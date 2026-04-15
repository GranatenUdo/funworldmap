import { test, expect } from '@playwright/test'

test.setTimeout(30000)

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)
  })

  test('typing shows results dropdown', async ({ page }) => {
    await page.getByTestId('search-input').fill('France')
    await page.waitForTimeout(300) // debounce + render

    const results = page.getByTestId('search-results')
    await expect(results).toBeVisible()
    const options = results.getByRole('option')
    expect(await options.count()).toBeGreaterThan(0)
    // France should be the first result
    await expect(options.first()).toContainText('France')
  })

  test('selecting a result opens the country panel', async ({ page }) => {
    await page.getByTestId('search-input').fill('France')
    await page.waitForTimeout(300)

    await page.getByTestId('search-results').getByRole('option').first().click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('country-panel')).toBeVisible()
    await expect(page.getByTestId('country-panel')).toContainText('France')
    const hash = await page.evaluate(() => window.location.hash)
    expect(hash).toBe('#FRA')
  })

  test('fuzzy matching works for typos', async ({ page }) => {
    await page.getByTestId('search-input').fill('Untied')
    await page.waitForTimeout(300)

    const results = page.getByTestId('search-results')
    await expect(results).toBeVisible()
    await expect(results).toContainText('United')
  })

  test('keyboard navigation: arrow down, enter selects', async ({ page }) => {
    const input = page.getByTestId('search-input')
    await input.fill('Ger')
    await page.waitForTimeout(300)

    // Arrow down to first result
    await input.press('ArrowDown')
    // Enter to select
    await input.press('Enter')
    await page.waitForTimeout(500)

    await expect(page.getByTestId('country-panel')).toBeVisible()
    await expect(page.getByTestId('country-panel')).toContainText('Germany')
  })

  test('escape closes dropdown', async ({ page }) => {
    const input = page.getByTestId('search-input')
    await input.fill('Japan')
    await page.waitForTimeout(300)

    await expect(page.getByTestId('search-results')).toBeVisible()

    await input.press('Escape')
    await page.waitForTimeout(200)

    await expect(page.getByTestId('search-results')).not.toBeAttached()
  })

  test('no results message for unknown query', async ({ page }) => {
    await page.getByTestId('search-input').fill('xyznotacountry')
    await page.waitForTimeout(300)

    await expect(page.getByTestId('search-no-results')).toBeVisible()
    await expect(page.getByTestId('search-no-results')).toContainText('No countries found')
  })

  test('clear button clears input', async ({ page }) => {
    const input = page.getByTestId('search-input')
    await input.fill('Brazil')
    await page.waitForTimeout(300)

    await expect(page.getByTestId('search-results')).toBeVisible()

    await page.getByTestId('search-clear').click()
    await page.waitForTimeout(200)

    await expect(input).toHaveValue('')
    await expect(page.getByTestId('search-results')).not.toBeAttached()
  })

  test('search by capital city', async ({ page }) => {
    await page.getByTestId('search-input').fill('Paris')
    await page.waitForTimeout(300)

    await expect(page.getByTestId('search-results')).toContainText('France')
  })

  test('search by country code', async ({ page }) => {
    await page.getByTestId('search-input').fill('USA')
    await page.waitForTimeout(300)

    await expect(page.getByTestId('search-results')).toContainText('United States')
  })
})
