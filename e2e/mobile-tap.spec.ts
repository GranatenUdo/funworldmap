import { test, expect, type Page } from '@playwright/test'
import { gotoAndWaitForMap, openLauncher, waitForGameTestHook } from './helpers'

test.setTimeout(60_000)

async function setupWithCountryPinning(page: Page) {
  await gotoAndWaitForMap(page)
  await openLauncher(page)
  await page.getByTestId('launcher-card-country-pinning-play').click()
  await waitForGameTestHook(page)
  await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })
}

// Install a click counter on window.__mapClickCount that MapLibre's click
// handler increments for every accepted click. Must run BEFORE the gesture
// so the handler is subscribed when the click fires.
async function installClickCounter(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__mapClickCount = 0
    window.__funworldmap_map?.on('click', () => {
      window.__mapClickCount = (window.__mapClickCount ?? 0) + 1
    })
  })
}

async function mapClickCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__mapClickCount ?? 0)
}

// Dispatch a "finger-roll tap" directly as DOM events on the canvas so we
// exercise MapLibre's MapEventHandler.click tolerance gate deterministically,
// independent of each browser's own click-vs-drag synthesis (which varies
// widely — Chromium drops clicks at ~4px, WebKit tolerates ~10px+, etc.).
async function fingerRollTap(page: Page, deltaPx: number): Promise<void> {
  await page.evaluate((delta) => {
    const canvas = document.querySelector('.maplibregl-canvas') as HTMLCanvasElement | null
    if (!canvas) throw new Error('no canvas')
    const rect = canvas.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: cx, clientY: cy, button: 0, bubbles: true }),
    )
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: cx + delta,
        clientY: cy + delta,
        button: 0,
        bubbles: true,
      }),
    )
    canvas.dispatchEvent(
      new MouseEvent('click', {
        clientX: cx + delta,
        clientY: cy + delta,
        button: 0,
        bubbles: true,
      }),
    )
  }, deltaPx)
}

test.describe('mobile tap reliability — clickTolerance', () => {
  test('5 px finger-roll tap is accepted (within tolerance)', async ({ page }) => {
    await setupWithCountryPinning(page)
    await installClickCounter(page)

    // 5 px delta between mousedown and click. With default clickTolerance=3,
    // MapEventHandler.click drops this (7.07 px euclidean distance >= 3).
    // With clickTolerance=8 (our fix), the distance is below threshold and
    // the click propagates to MapLibre's event listeners.
    await fingerRollTap(page, 5)

    await expect.poll(() => mapClickCount(page), { timeout: 2000 }).toBe(1)
  })

  test('12 px drag is NOT accepted as a click (above tolerance)', async ({ page }) => {
    await setupWithCountryPinning(page)
    await installClickCounter(page)

    // 12 px delta → ~17 px euclidean distance, above tolerance=8. MapLibre
    // drops the click. Pairs with the 5 px test to prove the threshold is
    // meaningful, not just "accepts everything".
    await fingerRollTap(page, 12)

    await expect.poll(() => mapClickCount(page), { timeout: 500 }).toBe(0)
  })
})
