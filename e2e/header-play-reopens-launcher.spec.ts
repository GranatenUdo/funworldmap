/**
 * Regression guard: header ▶ button reopens the launcher after a free game ends.
 *
 * After "Back to map", the hash clears and useLauncherVisibility resets so the
 * ▶ pill can re-open the launcher. These tests verify:
 *   (a) the hash clears after back-to-map
 *   (b) the ▶ pill is visible and clicking it opens the launcher
 */
import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, waitForAppReady, waitForGameTestHook } from './helpers'

test.setTimeout(60_000)

test.describe('header-play reopens launcher after game completion', () => {
  test('free country-pinning: "End game" → game-over → Back to map clears hash; ▶ pill reopens launcher', async ({
    page,
  }) => {
    await gotoAndWaitForMap(page, '/')
    await waitForAppReady(page)

    // Open launcher and start a free country-pinning game
    await page.getByTestId('header-play').click()
    await page.getByTestId('launcher').waitFor({ state: 'visible', timeout: 5_000 })
    await page.getByTestId('launcher-card-country-pinning-play').click()
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })

    // Wait for game to be in playing state
    await expect(page).toHaveURL(/#game\/country-pinning/)
    await waitForGameTestHook(page)

    // "End game" button triggers onEndGame → finishFree() → game-over overlay
    await expect(page.getByTestId('game-end')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('game-end').click()
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })

    // Click "Back to map"
    await page.getByTestId('game-over-back').click()
    await expect(page.getByTestId('game-over')).not.toBeAttached({ timeout: 5_000 })

    // Hash must clear
    await expect.poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 }).toBe('')

    // ▶ pill is visible; clicking it re-opens the launcher
    await expect(page.getByTestId('header-play')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('header-play').click()
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
  })

  test('free city-guessing: "End game" → game-over → Back to map clears hash; ▶ pill reopens launcher', async ({
    page,
  }) => {
    await gotoAndWaitForMap(page, '/')
    await waitForAppReady(page)

    // Open launcher and start a free city-guessing game
    await page.getByTestId('header-play').click()
    await page.getByTestId('launcher').waitFor({ state: 'visible', timeout: 5_000 })
    await page.getByTestId('launcher-card-city-guessing-play').click()
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })

    // Wait for game to be in playing state
    await expect(page).toHaveURL(/#game\/city-guessing/)
    await waitForGameTestHook(page)

    // "End game" button triggers onEndGame → finishFree() → game-over overlay
    await expect(page.getByTestId('game-end')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('game-end').click()
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })

    // Click "Back to map"
    await page.getByTestId('game-over-back').click()
    await expect(page.getByTestId('game-over')).not.toBeAttached({ timeout: 5_000 })

    // Hash must clear
    await expect.poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 }).toBe('')

    // ▶ pill is visible; clicking it re-opens the launcher
    await expect(page.getByTestId('header-play')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('header-play').click()
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
  })

  test('deep-linked game: back-to-map clears hash; ▶ pill reopens launcher', async ({ page }) => {
    // Start a country-pinning game via deep-link (bypasses launcher)
    await page.goto('/#game/country-pinning/play')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    await waitForGameTestHook(page)

    // End game via button
    await expect(page.getByTestId('game-end')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('game-end').click()
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })

    // Back to map
    await page.getByTestId('game-over-back').click()
    await expect(page.getByTestId('game-over')).not.toBeAttached({ timeout: 5_000 })

    // Hash clears
    await expect.poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 }).toBe('')

    // ▶ pill re-opens the launcher
    await expect(page.getByTestId('header-play')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('header-play').click()
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
  })
})
