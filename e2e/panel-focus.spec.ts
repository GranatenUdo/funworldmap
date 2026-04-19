import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

// Search for a country and click the first result. Under slow CI the
// search-results dropdown can need >5 s to populate (Fuse debounce +
// render); waiting for the option locator is deterministic.
async function searchAndOpenPanel(page: Page, query: string) {
  await page.getByTestId('search-input').fill(query)
  const firstOption = page.getByTestId('search-results').getByRole('option').first()
  await expect(firstOption).toBeVisible({ timeout: 15_000 })
  await firstOption.click({ force: true })
  const panel = page.getByTestId('country-panel')
  await expect(panel).toBeVisible({ timeout: 15_000 })
  return panel
}

test.describe('panel focus management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded], [data-map-error]', { timeout: 30_000 })
  })

  test('opening panel via search moves focus into panel', async ({ page }) => {
    await searchAndOpenPanel(page, 'France')
    await expect
      .poll(
        () => page.evaluate(() => document.activeElement?.getAttribute('data-testid')),
        // 300 ms focus-deferring setTimeout in App.tsx + CI render latency
        // can comfortably exceed the 5 s default; 10 s gives slack.
        { timeout: 10_000 },
      )
      .toBe('panel-close')
  })

  test('Esc closes panel and returns focus to search', async ({ page }) => {
    await searchAndOpenPanel(page, 'France')
    // Wait for focus to have moved into the panel before pressing Escape;
    // otherwise Escape may fire while focus is still on the search input.
    await expect
      .poll(
        () => page.evaluate(() => document.activeElement?.getAttribute('data-testid')),
        // 300 ms focus-deferring setTimeout in App.tsx + CI render latency
        // can comfortably exceed the 5 s default; 10 s gives slack.
        { timeout: 10_000 },
      )
      .toBe('panel-close')

    // Press Escape on the focused element directly. `page.keyboard.press`
    // can behave inconsistently under CI's headless Chrome; `locator.press`
    // is scoped and reliably dispatches a real keydown on the target.
    await page.getByTestId('panel-close').press('Escape')
    await expect(page.getByTestId('country-panel')).not.toBeAttached({ timeout: 10_000 })

    const activeId = await page.evaluate(() => document.activeElement?.id)
    expect(activeId).toBe('search-input')
  })
})
