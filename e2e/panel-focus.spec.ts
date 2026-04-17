import { test, expect } from '@playwright/test'

test.describe('panel focus management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded], [data-map-error]')
  })

  test('opening panel via search moves focus into panel', async ({ page }) => {
    await page.getByTestId('search-input').fill('France')
    await page.waitForTimeout(300)
    await page.getByTestId('search-results').getByRole('option').first().click()
    await page.waitForSelector('[data-testid="country-panel"]')

    // requestAnimationFrame defers focus by one frame
    await page.waitForTimeout(50)

    const active = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    expect(active).toBe('panel-close')
  })

  test('Esc closes panel and returns focus to search', async ({ page }) => {
    await page.getByTestId('search-input').fill('France')
    await page.waitForTimeout(300)
    await page.getByTestId('search-results').getByRole('option').first().click()
    await page.waitForSelector('[data-testid="country-panel"]')
    await page.waitForTimeout(50)

    await page.keyboard.press('Escape')
    await page.waitForSelector('[data-testid="country-panel"]', { state: 'detached' })

    const activeId = await page.evaluate(() => document.activeElement?.id)
    expect(activeId).toBe('search-input')
  })
})
