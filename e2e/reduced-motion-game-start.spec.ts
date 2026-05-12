import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady, waitForGameTestHook } from './helpers'

/**
 * Spy on `__funworldmap_map.flyTo` and return the duration from the most
 * recent call. Must be called AFTER the map is available (waitForAppReady).
 *
 * The recorded duration is stored under a unique key on `window` so the spy
 * is page-local: a fresh Playwright `page` fixture starts with a fresh
 * `__funworldmap_map` and no leftover spy state.
 */
async function spyOnFlyToDuration(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __funworldmap_map: { flyTo: (opts: { duration?: number }) => void }
      __flyTo_last_duration?: number
    }
    const orig = w.__funworldmap_map.flyTo.bind(w.__funworldmap_map)
    w.__flyTo_last_duration = undefined
    w.__funworldmap_map.flyTo = (opts) => {
      w.__flyTo_last_duration = opts.duration
      orig(opts)
    }
  })
}

async function getLastFlyToDuration(page: Page): Promise<number | undefined> {
  return page.evaluate(
    () => (window as unknown as { __flyTo_last_duration?: number }).__flyTo_last_duration,
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
