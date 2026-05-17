import { test, expect } from '@playwright/test'
import { ensureLauncherDismissed } from './helpers'

test('app renders with map container', async ({ page }) => {
  await page.goto('/')
  await ensureLauncherDismissed(page)
  await expect(page.locator('#root')).toBeAttached()
  await expect(page.locator('.maplibregl-canvas')).toBeAttached({ timeout: 15000 })
})

test('search bar is visible and interactive', async ({ page }) => {
  await page.goto('/')
  await ensureLauncherDismissed(page)
  const input = page.getByTestId('search-input')
  await expect(input).toBeVisible()
  await expect(input).toBeEditable()
})

test('theme toggle is visible', async ({ page }) => {
  await page.goto('/')
  await ensureLauncherDismissed(page)
  await expect(page.getByTestId('theme-toggle')).toBeVisible()
})
