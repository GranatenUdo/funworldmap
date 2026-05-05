/**
 * Regression guard for commit 47d5d89 (Toast z-index fix).
 *
 * Proves that a toast dispatched while the game-over modal is open:
 *   (a) is visible (not occluded by the modal backdrop), and
 *   (b) has a computed z-index strictly greater than the modal's.
 *
 * Note: This test uses the `chromium` project (the consolidated real-GPU
 * project — chromium-gpu was merged into chromium on 2026-05-02).
 */
import { test, expect } from '@playwright/test'
import { stubDailyIndex, waitForGameTestHook, finalizeGame } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.setTimeout(60_000)

test('toast dispatched during game-over modal renders above the modal', async ({ page }) => {
  const today = toLocalDateString(new Date())

  // Stub the daily index so the test is network-independent.
  await stubDailyIndex(page, today)

  // Navigate to the daily game. Deep-link bypasses the launcher.
  await page.goto(`/#daily/${today}/country-pinning`)
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })

  // Wait for the game test seam to be registered.
  await waitForGameTestHook(page)

  // Submit a correct guess (FRA) and immediately end the best-of-3 early via
  // completeNow. The test seam dispatches the same reducer actions a real UI
  // click would — no force-click, no timing assumptions.
  await page.evaluate(() => {
    // @ts-expect-error — VITE_TEST_HOOKS seam
    window.__funworldmap_game.submitCountryGuess('FRA')
    // @ts-expect-error — VITE_TEST_HOOKS seam
    window.__funworldmap_game.completeNow()
  })

  // Drive the round-ended → game-over transition (bypasses the reveal hold).
  await finalizeGame(page)

  // Wait for the game-over modal to be present and visible.
  const modal = page.getByTestId('game-over')
  await expect(modal).toBeVisible({ timeout: 15_000 })

  // The DailyShareBlock is only rendered when the daily result has been
  // recorded. Wait for it before clicking Share.
  await expect(page.getByTestId('daily-share-block')).toBeVisible({ timeout: 15_000 })

  // The primary Share button falls through to clipboard.writeText() in
  // Playwright (navigator.share is not available in headless Chromium), which
  // dispatches a 'Copied!' toast via dispatchToast().
  await page.getByTestId('daily-share-primary').click()

  // Wait for the toast to appear. The Toast component renders a div with
  // role="status" aria-live="polite" containing the clipboard confirmation.
  // Filter by text so we don't accidentally match other role=status nodes
  // (AttemptsIndicator, LivesIndicator, etc.).
  const toast = page.getByRole('status').filter({ hasText: /Copied!/ })
  await expect(toast).toBeVisible({ timeout: 10_000 })

  // CRITICAL: assert that the toast's computed z-index is strictly greater
  // than the modal backdrop's. toBeVisible() does not check z-stacking, so
  // this is the load-bearing assertion for commit 47d5d89.
  const zIndices = await page.evaluate(() => {
    const toastEl = Array.from(document.querySelectorAll('[role="status"]')).find(
      (el) => el.textContent?.includes('Copied!'),
    )
    const modalEl = document.querySelector('[data-testid="game-over"]')
    return {
      toast: toastEl ? parseInt(getComputedStyle(toastEl).zIndex, 10) : NaN,
      modal: modalEl ? parseInt(getComputedStyle(modalEl).zIndex, 10) : NaN,
    }
  })

  expect(zIndices.toast).not.toBeNaN()
  expect(zIndices.modal).not.toBeNaN()
  expect(zIndices.toast).toBeGreaterThan(zIndices.modal)
})

test('toast dispatched via navigator.share (success) renders above the modal', async ({ page }) => {
  const today = toLocalDateString(new Date())

  // Stub the daily index so the test is network-independent.
  await stubDailyIndex(page, today)

  // Mock navigator.share BEFORE navigation to force the share-API path.
  await page.addInitScript(() => {
    (navigator as any).share = async () => Promise.resolve()
  })

  // Navigate to the daily game. Deep-link bypasses the launcher.
  await page.goto(`/#daily/${today}/country-pinning`)
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })

  // Wait for the game test seam to be registered.
  await waitForGameTestHook(page)

  // Submit a correct guess (FRA) and immediately end the best-of-3 early via
  // completeNow. The test seam dispatches the same reducer actions a real UI
  // click would — no force-click, no timing assumptions.
  await page.evaluate(() => {
    // @ts-expect-error — VITE_TEST_HOOKS seam
    window.__funworldmap_game.submitCountryGuess('FRA')
    // @ts-expect-error — VITE_TEST_HOOKS seam
    window.__funworldmap_game.completeNow()
  })

  // Drive the round-ended → game-over transition (bypasses the reveal hold).
  await finalizeGame(page)

  // Wait for the game-over modal to be present and visible.
  const modal = page.getByTestId('game-over')
  await expect(modal).toBeVisible({ timeout: 15_000 })

  // The DailyShareBlock is only rendered when the daily result has been
  // recorded. Wait for it before clicking Share.
  await expect(page.getByTestId('daily-share-block')).toBeVisible({ timeout: 15_000 })

  // The primary Share button now dispatches a 'Shared!' toast via dispatchToast()
  // when navigator.share succeeds (as mocked above).
  await page.getByTestId('daily-share-primary').click()

  // Wait for the toast to appear. The Toast component renders a div with
  // role="status" aria-live="polite" containing the share confirmation.
  // Filter by text so we don't accidentally match other role=status nodes
  // (AttemptsIndicator, LivesIndicator, etc.).
  const toast = page.getByRole('status').filter({ hasText: /Shared!/ })
  await expect(toast).toBeVisible({ timeout: 10_000 })

  // CRITICAL: assert that the toast's computed z-index is strictly greater
  // than the modal backdrop's. toBeVisible() does not check z-stacking, so
  // this is the load-bearing assertion for the share-API success path.
  const zIndices = await page.evaluate(() => {
    const toastEl = Array.from(document.querySelectorAll('[role="status"]')).find(
      (el) => el.textContent?.includes('Shared!'),
    )
    const modalEl = document.querySelector('[data-testid="game-over"]')
    return {
      toast: toastEl ? parseInt(getComputedStyle(toastEl).zIndex, 10) : NaN,
      modal: modalEl ? parseInt(getComputedStyle(modalEl).zIndex, 10) : NaN,
    }
  })

  expect(zIndices.toast).not.toBeNaN()
  expect(zIndices.modal).not.toBeNaN()
  expect(zIndices.toast).toBeGreaterThan(zIndices.modal)
})
