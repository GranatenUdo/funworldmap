import { test, expect } from '@playwright/test'

test('app renders with polworldmap text', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toContainText('polworldmap')
})

test('page has no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await page.goto('/')
  await page.waitForTimeout(1000)
  expect(errors).toEqual([])
})
