import { test, expect } from '@playwright/test'
import { toLocalDateString } from '../src/game/daily/dates'
import {
  waitForAppReady,
  stubDailyIndex,
  gotoAndWaitForMap,
} from './helpers'

test.setTimeout(60_000)

function todayString(): string {
  return toLocalDateString(new Date())
}

async function setupFreshLaunch(page: Parameters<typeof stubDailyIndex>[0]): Promise<void> {
  await stubDailyIndex(page, todayString())
  await page.addInitScript(() => {
    localStorage.removeItem('funworldmap-game-last-mode')
    localStorage.removeItem('funworldmap-daily-history')
  })
  await gotoAndWaitForMap(page, '/')
  await waitForAppReady(page)
  await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
}

test.describe('Launcher — backdrop dismiss', () => {
  test('header is not in DOM while launcher is open', async ({ page }) => {
    await setupFreshLaunch(page)
    // The entire header must be removed from the DOM (not just hidden)
    await expect(page.getByTestId('header-play')).not.toBeAttached()
    await expect(page.locator('#search-input')).not.toBeAttached()
    await expect(page.getByTestId('satellite-toggle')).not.toBeAttached()
  })

  test('backdrop click dismisses launcher', async ({ page }) => {
    await setupFreshLaunch(page)
    const launcher = page.getByTestId('launcher')
    // Click the backdrop div (top-left corner, away from centred card content)
    const backdrop = launcher.locator('> div[aria-hidden="true"]')
    await backdrop.click({ position: { x: 20, y: 20 } })
    await expect(launcher).not.toBeAttached({ timeout: 5_000 })
  })

  test('after backdrop dismiss, header re-appears in DOM', async ({ page }) => {
    await setupFreshLaunch(page)
    const launcher = page.getByTestId('launcher')
    const backdrop = launcher.locator('> div[aria-hidden="true"]')
    await backdrop.click({ position: { x: 20, y: 20 } })
    await expect(launcher).not.toBeAttached({ timeout: 5_000 })
    // Header controls must be back in the DOM
    await expect(page.getByTestId('header-play')).toBeAttached()
    await expect(page.locator('#search-input')).toBeAttached()
    await expect(page.getByTestId('satellite-toggle')).toBeAttached()
  })

  test('after backdrop dismiss, focus moves to search input', async ({ page }) => {
    await setupFreshLaunch(page)
    const launcher = page.getByTestId('launcher')
    const backdrop = launcher.locator('> div[aria-hidden="true"]')
    await backdrop.click({ position: { x: 20, y: 20 } })
    await expect(launcher).not.toBeAttached({ timeout: 5_000 })
    // Wait for header to re-mount after launcher unmounts, then check focus
    await expect(page.locator('#search-input')).toBeAttached({ timeout: 5_000 })
    await expect(page.locator('#search-input')).toBeFocused()
  })
})
