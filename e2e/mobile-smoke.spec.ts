import { test, expect } from '@playwright/test'
import { routeMapTiles } from './helpers'

test.setTimeout(60_000)

test.describe('mobile smoke', () => {
  test('app loads and map reaches loaded state', async ({ page }) => {
    await routeMapTiles(page)
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    await expect(page.locator('main[data-app-ready="true"]')).toBeAttached()
  })
})
