import { test, expect } from '@playwright/test'
import { ensureLauncherDismissed, waitForAppReady } from './helpers'

test.describe('canonical-195 dataset reduction', () => {
  // The "Launcher subtitle reflects the canonical 195 count" test was removed
  // in PR1 (2026-05-17). The subtitle was redesigned to show "Today's puzzle ·
  // <date>" and no longer contains the country count — that's intentional.

  test('Palestine is searchable', async ({ page }) => {
    await page.goto('/')
    await ensureLauncherDismissed(page)
    await page.getByTestId('search-input').fill('Pal')
    await expect(
      page.getByTestId('search-results').getByRole('option', { name: /Palestine/ }),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('dropped territories are not searchable (Greenland)', async ({ page }) => {
    await page.goto('/')
    await ensureLauncherDismissed(page)
    const input = page.getByTestId('search-input')
    await input.fill('land')
    const results = page.getByTestId('search-results')
    // Sanity check: search did populate (Iceland is in the 195 and matches "land").
    await expect(results.getByRole('option', { name: /Iceland/ })).toBeVisible({ timeout: 15_000 })
    // Greenland (dropped) must NOT appear.
    await expect(results.getByRole('option', { name: /Greenland/i })).toHaveCount(0)
  })
})
