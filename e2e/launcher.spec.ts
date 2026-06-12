import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, waitForAppReady, waitForAnimationIdle, openLauncher } from './helpers'

test.setTimeout(60_000)

test.describe('Launcher (free-play hub)', () => {
  test('header Play opens the launcher; choosing a mode starts a free game', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await waitForAppReady(page)

    await page.getByTestId('header-play').click()
    const launcher = page.getByTestId('launcher')
    await expect(launcher).toBeVisible()
    await waitForAnimationIdle(launcher)

    // both mode cards present, each showing a personal-best line
    await expect(page.getByTestId('launcher-card-country-pinning')).toBeVisible()
    await expect(page.getByTestId('launcher-card-city-guessing-best')).toBeVisible()

    await page.getByTestId('launcher-card-country-pinning-play').click()
    await expect(launcher).not.toBeAttached()
    await expect(page).toHaveURL(/#game\/country-pinning/)
    await expect(page.getByTestId('game-hud')).toBeVisible()
  })

  test('does NOT appear on cold load at /; header CTA opens it', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await expect(page.getByTestId('launcher')).not.toBeAttached()
    await page.getByTestId('header-play').click()
    await expect(page.getByTestId('launcher')).toBeVisible()
  })

  test('does NOT appear on cold load at /#FRA (deep-link bypass)', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA')
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('launcher')).toBeHidden()
  })

  test('does NOT appear on cold load at /#game/country-pinning', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#game/country-pinning')
    await expect(page.getByTestId('launcher')).toBeHidden()
  })

  test('clicking the × close button dismisses and focuses search', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    await page.getByTestId('launcher-close').click()
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
    await expect(page.getByTestId('search-input')).toBeAttached({ timeout: 5_000 })
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('search input is not in DOM while launcher is open', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    await expect(page.getByTestId('search-input')).not.toBeAttached()
  })

  test('pressing Escape dismisses and focuses search', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
    await expect(page.getByTestId('search-input')).toBeAttached({ timeout: 5_000 })
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('header-play + satellite not in DOM while launcher visible', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    await expect(page.getByTestId('header-play')).not.toBeAttached()
    await expect(page.getByTestId('satellite-toggle')).not.toBeAttached()
  })

  test('play + satellite restored after dismiss', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    await page.getByTestId('launcher-close').click()
    await expect(page.getByTestId('header-play')).toBeVisible()
    await expect(page.getByTestId('satellite-toggle')).toBeVisible()
  })

  test('play button re-opens launcher', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await expect(page.getByTestId('header-play')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('header-play').click()
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 3_000 })
  })

  test('has dialog role + aria-modal + aria-label', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    const launcher = page.getByTestId('launcher')
    await expect(launcher).toHaveAttribute('role', 'dialog')
    await expect(launcher).toHaveAttribute('aria-modal', 'true')
    await expect(launcher).toHaveAttribute('aria-label', 'Choose how to play')
  })

  test('dismissing + reloading does NOT re-show launcher (map-first posture)', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    await page.getByTestId('launcher-close').click()
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
    await page.reload()
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
  })
})
