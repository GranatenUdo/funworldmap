import { test, expect } from '@playwright/test'
import { waitForAppReady, waitForGameTestHook } from './helpers'

/**
 * Spy on `__funworldmap_map.flyTo` and return the duration from the most
 * recent call. Must be called AFTER the map is available (waitForAppReady).
 *
 * Implementation: replaces flyTo with a wrapper that records the duration
 * argument, then calls through to the original implementation. The recorded
 * value is exposed on `window.__flyTo_last_duration` for retrieval.
 */
async function spyOnFlyToDuration(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const map = (window as unknown as { __funworldmap_map: { flyTo: (...args: unknown[]) => void } }).__funworldmap_map
    const orig = map.flyTo.bind(map)
    ;(window as unknown as { __flyTo_last_duration?: number | undefined }).__flyTo_last_duration = undefined
    map.flyTo = (opts: unknown) => {
      ;(window as unknown as { __flyTo_last_duration?: number | undefined }).__flyTo_last_duration =
        (opts as { duration?: number }).duration
      orig(opts)
    }
  })
}

async function getLastFlyToDuration(page: import('@playwright/test').Page): Promise<number | undefined> {
  return page.evaluate(
    () => (window as unknown as { __flyTo_last_duration?: number | undefined }).__flyTo_last_duration,
  )
}

test.describe('Game start respects prefers-reduced-motion', () => {
  /**
   * With prefers-reduced-motion: reduce, the App.tsx game-start effect must
   * pass duration: 0 (not 700) to flyTo. MapLibre also overrides the duration
   * internally when the media query is active, but this test validates that
   * our App.tsx code sends the correct intent — defense-in-depth and WCAG
   * SC 2.3.3 compliance at the source level.
   */
  test('reduce: flyTo is called with duration 0 on idle → playing', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await page.goto('/')
    await waitForAppReady(page)
    await waitForGameTestHook(page)

    await spyOnFlyToDuration(page)

    await page.evaluate(() => { window.location.hash = 'game/country-pinning' })

    // Wait for the session to enter playing state — the flyTo fires synchronously
    // in the useEffect that watches session.status. Poll until the spy captured a call.
    await expect.poll(
      () => getLastFlyToDuration(page),
      { timeout: 10_000 },
    ).not.toBeUndefined()

    const duration = await getLastFlyToDuration(page)
    expect(duration).toBe(0)
  })

  /**
   * With no preference, the animation should run at full duration (700ms).
   * The chromium project sets reducedMotion: 'reduce' globally in playwright.config.ts;
   * this test overrides it per-page to validate the other branch.
   */
  test('no preference: flyTo is called with duration 700 on idle → playing', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    await page.goto('/')
    await waitForAppReady(page)
    await waitForGameTestHook(page)

    await spyOnFlyToDuration(page)

    await page.evaluate(() => { window.location.hash = 'game/country-pinning' })

    await expect.poll(
      () => getLastFlyToDuration(page),
      { timeout: 10_000 },
    ).not.toBeUndefined()

    const duration = await getLastFlyToDuration(page)
    expect(duration).toBe(700)
  })
})
