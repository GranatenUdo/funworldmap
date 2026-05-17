/**
 * Phase 3.6 — header ▶ button reopens launcher after game completion.
 *
 * Regression guard for the bug where clicking "Back to map" after a daily game
 * left the URL still containing the daily hash (history.replaceState was used,
 * which does NOT fire a hashchange event). useLauncherVisibility's currentHash
 * state was never updated, so visible remained false, and clicking ▶ had no
 * effect.
 *
 * Fix: writeIdleHash() in GameController.tsx now dispatches a synthetic
 * hashchange event after history.replaceState, so useLauncherVisibility
 * updates currentHash to ''.
 *
 * Map-first posture (PR2): the launcher no longer auto-appears at bare root
 * after game end. show() sets forceVisible=true so the ▶ pill can re-open
 * the launcher from bare root. These tests verify:
 *   (a) hash clears after back-to-map
 *   (b) ▶ pill is visible and clicking it opens the launcher
 */
import { test, expect, type Page } from '@playwright/test'
import { toLocalDateString } from '../src/game/daily/dates'
import {
  gotoAndWaitForMap,
  waitForAppReady,
  waitForGameTestHook,
  stubDailyIndex,
  finalizeGame,
  submitAndWait,
  routeMapTiles,
} from './helpers'

test.setTimeout(60_000)

const TODAY = toLocalDateString(new Date())

/**
 * Navigate to /, click the daily CTA, and wait until the game is in `playing`
 * state. Mirrors the approach in daily-puzzle.spec.ts.
 */
async function startDailyViaLauncher(page: Page): Promise<void> {
  // Register routeMapTiles first, then stubDailyIndex — LIFO means stubDailyIndex
  // handler runs first for **/daily/index.json requests, ensuring the stub wins.
  await routeMapTiles(page)
  await stubDailyIndex(page, TODAY)
  await page.addInitScript(() => {
    localStorage.removeItem('funworldmap-daily-history')
    localStorage.removeItem('funworldmap-daily-resume')
  })
  await page.goto('/')
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
  await waitForAppReady(page)
  // Open the launcher via the header CTA (map-first posture: bare '/' no longer auto-opens launcher)
  await page.getByTestId('header-play').click()
  await page.getByTestId('launcher').waitFor({ state: 'visible', timeout: 5_000 })
  await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeVisible({
    timeout: 10_000,
  })
  await page.getByTestId('launcher-card-country-pinning-daily-cta').click()
  await expect
    .poll(() => page.evaluate(() => window.location.hash), { timeout: 10_000 })
    .toContain(`daily/${TODAY}/country-pinning`)
  await waitForGameTestHook(page)
}

test.describe('header-play reopens launcher after game completion', () => {
  test('daily game: Back to map clears hash; ▶ pill reopens launcher with played state', async ({
    page,
  }) => {
    await startDailyViaLauncher(page)

    // Submit 3 guesses to exhaust all attempts (best-of-3 daily round)
    await submitAndWait(page, 'DEU', 1)
    await submitAndWait(page, 'ESP', 2)
    await submitAndWait(page, 'FRA', 3)

    // Transition to game-over (round-ended with endsGame=true → game-over)
    await finalizeGame(page)

    // Game-over overlay must be visible
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })

    // Click "Back to map"
    await page.getByTestId('game-over-back').click()
    await expect(page.getByTestId('game-over')).not.toBeAttached({ timeout: 5_000 })

    // Hash should have cleared (writeIdleHash dispatches hashchange)
    await expect.poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 }).toBe('')

    // Map-first posture: launcher does NOT auto-appear at bare root after game end.
    // The ▶ pill is visible; clicking it opens the launcher (show() → forceVisible=true).
    await expect(page.getByTestId('header-play')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('header-play').click()

    // Launcher appears with played-state "See reveal" CTA
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('launcher-card-country-pinning-see-reveal')).toBeVisible({
      timeout: 5_000,
    })
  })

  test('free game: "End game" exits, hash clears; ▶ pill reopens launcher', async ({ page }) => {
    await stubDailyIndex(page, TODAY)
    await page.addInitScript(() => {
      localStorage.removeItem('funworldmap-daily-history')
    })
    // Seed lastMode so the shared unlimited link routes to country-pinning.
    await page.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'country-pinning')
    })
    await gotoAndWaitForMap(page, '/')
    await waitForAppReady(page)
    // Open launcher via header CTA (map-first posture)
    await page.getByTestId('header-play').click()
    await page.getByTestId('launcher').waitFor({ state: 'visible', timeout: 5_000 })

    // Start free game via the shared unlimited link.
    await page.getByTestId('launcher-unlimited-link').click()
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 10_000 })
      .toContain('game/country-pinning')
    await waitForGameTestHook(page)

    // "End game" button in the HUD triggers onEndGame.
    // For a free game (dailyDate === null) with status 'playing', onEndGame calls finishFree()
    // → status becomes 'game-over', game-over overlay appears.
    // Then "Back to map" in the overlay calls onEndGame again with status='game-over'
    // → hits the else branch: endGame() + writeIdleHash() which now dispatches hashchange.
    await expect(page.getByTestId('game-end')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('game-end').click()

    // game-over overlay should appear
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })

    // Click "Back to map"
    await page.getByTestId('game-over-back').click()
    await expect(page.getByTestId('game-over')).not.toBeAttached({ timeout: 5_000 })

    // Hash must clear
    await expect.poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 }).toBe('')

    // Map-first posture: launcher does NOT auto-appear at bare root after game end.
    // The ▶ pill is visible; clicking it re-opens the launcher.
    await expect(page.getByTestId('header-play')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('header-play').click()

    // Launcher should appear
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
  })
})
