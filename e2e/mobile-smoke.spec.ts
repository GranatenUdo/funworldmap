import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap } from './helpers'

test.setTimeout(60_000)

test.describe('mobile smoke', () => {
  test('app loads and map reaches loaded state', async ({ page }) => {
    await gotoAndWaitForMap(page)
    await expect(page.locator('main[data-app-ready="true"]')).toBeAttached()
  })
})
