import { test, expect } from '@playwright/test'

test('app renders without crashing', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#root')).toBeAttached()
})

test('page has no console errors on load', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await page.goto('/')
  // Wait for map to load (or timeout)
  await page.waitForSelector('[data-map-loaded]', { timeout: 15000 }).catch(() => {})
  expect(errors).toEqual([])
})
