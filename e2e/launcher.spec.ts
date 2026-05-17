import { test, expect, type Page } from '@playwright/test'
import { toLocalDateString } from '../src/game/daily/dates'
import {
  gotoAndWaitForMap,
  openLauncher,
  routeMapTiles,
  waitForAnimationIdle,
  waitForAppReady,
} from './helpers'

test.setTimeout(60_000)

test.describe('Launcher — visibility', () => {
  test('does NOT appear on cold load at /; header CTA opens it', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await expect(page.getByTestId('launcher')).not.toBeAttached()
    await page.getByTestId('header-play').click()
    await expect(page.getByTestId('launcher')).toBeVisible()
  })

  test('does NOT appear on cold load at /#FRA (deep-link bypass)', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA')
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('launcher')).not.toBeVisible()
  })

  test('does NOT appear on cold load at /#game/country-pinning', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#game/country-pinning')
    await expect(page.getByTestId('launcher')).not.toBeVisible()
  })
})

test.describe('Launcher — dismiss paths', () => {
  test('clicking the × close button dismisses and focuses search', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    await page.getByTestId('launcher-close').click()
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
    // Wait for header to re-mount after launcher unmounts, then check focus
    await expect(page.getByTestId('search-input')).toBeAttached({ timeout: 5_000 })
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('search input is not in DOM while launcher is open', async ({ page }) => {
    // Header returns null when launcher is visible, so the search input is not
    // in the DOM at all — this prevents pointer-blocked affordances.
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    await expect(page.getByTestId('search-input')).not.toBeAttached()
  })

  test('pressing Escape dismisses and focuses search', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
    // Wait for header to re-mount after launcher unmounts, then check focus
    await expect(page.getByTestId('search-input')).toBeAttached({ timeout: 5_000 })
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('clicking the backdrop area dismisses the launcher', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    const launcher = page.getByTestId('launcher')
    // Click the backdrop div directly (top-left corner, away from centred card content)
    const backdrop = launcher.locator('> div[aria-hidden="true"]')
    await backdrop.click({ position: { x: 20, y: 20 } })
    await expect(launcher).not.toBeAttached({ timeout: 5_000 })
  })
})

test.describe('Launcher — session scope', () => {
  test('dismissing + reloading does NOT re-show launcher (map-first posture)', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    await page.getByTestId('launcher-close').click()
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
    await page.reload()
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    // After PR2, bare '/' no longer auto-opens the launcher — the map is the default view.
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
  })

  test('dismissing + closing a country panel does NOT re-show launcher', async ({ page }) => {
    // Quarantined on CI pending tracking issue #31 — even after the className-
    // based animation migration + Playwright reducedMotion: 'reduce' (commit
    // 5394abc), CI compositor pressure (10m geojson, parallel workers) still
    // defeats Playwright's bounding-box stability check on panel-close. The
    // panel mounts, data renders, animations are 0.01ms — but the click action
    // never sees a "stable" frame within actionTimeout. Likely needs a deeper
    // investigation into compositor frame production under CDP+ANGLE; possibly
    // resolvable by reducing per-test browser load or further animation strip.
    test.fixme(
      !!process.env.CI,
      'tracking issue: https://github.com/GranatenUdo/funworldmap/issues/31',
    )
    await gotoAndWaitForMap(page, '/')
    // Launcher is NOT open on bare '/', so no need to open/close it first.
    await page.getByTestId('search-input').fill('France')
    // Target the France option explicitly; Fuse.js returns multiple matches
    // and .first() can race with DOM render order on slow CI.
    const franceOption = page
      .getByTestId('search-results')
      .getByRole('option', { name: /^France\s/ })
      .first()
    await expect(franceOption).toBeVisible({ timeout: 10_000 })
    await franceOption.click()
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    // Wait for the search results dropdown to be fully gone before clicking
    // panel-close, so the dropdown cannot intercept the click at z-50.
    await expect(page.getByTestId('search-results')).not.toBeAttached({ timeout: 5_000 })
    // Wait for the panel slide-in animation to finish before clicking
    // panel-close — on slow Software ANGLE CI the animation is still running
    // when the next line executes, causing the click to miss / be intercepted.
    await waitForAnimationIdle(page.getByTestId('country-panel'))
    await page.getByTestId('panel-close').click()
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 3_000 })
  })
})

test.describe('Launcher — header behaviour', () => {
  test('header-play + satellite not in DOM while launcher visible', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    // Header returns null when launcher is visible (Header.tsx line 42).
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
    // header-play is visible on map-first load (no launcher)
    await expect(page.getByTestId('header-play')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('header-play').click()
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 3_000 })
  })
})

test.describe('Launcher — daily state', () => {
  test('unplayed daily state renders the daily CTA', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await page.route('**/daily/index.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          window: { start: today, end: today },
          days: { [today]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
        }),
      })
    })
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute(
      'data-state',
      'unplayed',
    )
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeVisible()
  })

  test('played daily state renders the result line', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await page.addInitScript(
      ({ today }) => {
        localStorage.setItem(
          'funworldmap-daily-history',
          JSON.stringify({
            version: 1,
            streak: { current: 1, longest: 1, lastActiveDate: today, lastMilestoneShown: 0 },
            days: { [today]: { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } } },
          }),
        )
      },
      { today },
    )
    await page.route('**/daily/index.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          window: { start: today, end: today },
          days: { [today]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
        }),
      })
    })
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute(
      'data-state',
      'played',
    )
    await expect(page.getByTestId('launcher-card-country-pinning-played-result')).toContainText(
      '87',
    )
  })

  test('unavailable-error state when daily index fetch fails', async ({ page }) => {
    // Register routeMapTiles first, then the daily index stub — Playwright uses
    // LIFO so the later-registered stub handler runs first for daily/index.json
    // requests and returns 500 before routeMapTiles' continue() sees it.
    await routeMapTiles(page)
    await page.route('**/daily/index.json', (route) => route.fulfill({ status: 500, body: '' }))
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    await waitForAppReady(page)
    await openLauncher(page)
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute(
      'data-state',
      'unavailable-error',
    )
    await expect(page.getByTestId('launcher-card-country-pinning-error')).toBeVisible()
  })

  test('shared unlimited link starts endless mode', async ({ page }) => {
    // Same LIFO fix: routeMapTiles first, then the 500 stub runs first due to LIFO.
    await routeMapTiles(page)
    await page.route('**/daily/index.json', (route) => route.fulfill({ status: 500, body: '' }))
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    await waitForAppReady(page)
    await openLauncher(page)
    await page.getByTestId('launcher-unlimited-link').click()
    await expect.poll(() => page.url()).toMatch(/#game\//)
  })

  test('#daily/<today> deep-link opens launcher automatically without CTA click', async ({
    page,
  }) => {
    const today = toLocalDateString(new Date())
    await page.route('**/daily/index.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          window: { start: today, end: today },
          days: { [today]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
        }),
      })
    })
    await gotoAndWaitForMap(page, `/#daily/${today}`)
    // Deep-link to a daily date should open the launcher automatically.
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Launcher — accessibility', () => {
  test('has dialog role + aria-modal + aria-label', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    const launcher = page.getByTestId('launcher')
    await expect(launcher).toHaveAttribute('role', 'dialog')
    await expect(launcher).toHaveAttribute('aria-modal', 'true')
    await expect(launcher).toHaveAttribute('aria-label', 'Choose how to play')
  })

  test('initial focus lands on last-played mode card', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await page.route('**/daily/index.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          window: { start: today, end: today },
          days: { [today]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
        }),
      })
    })
    await page.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'city-guessing')
    })
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    // Focus lands on lastMode's daily-cta (city-guessing, since that is last-mode and unplayed)
    await expect(page.getByTestId('launcher-card-city-guessing-daily-cta')).toBeFocused({
      timeout: 5_000,
    })
  })

  test('Tab cycles through mode card 1, mode card 2, close button, wraps', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await page.route('**/daily/index.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          window: { start: today, end: today },
          days: { [today]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
        }),
      })
    })
    await page.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'country-pinning')
    })
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    // DOM order: launcher-close (absolute, first) → country-pinning-daily-cta → city-guessing-daily-cta → launcher-unlimited-link (last)
    // Focus trap wraps last→first. Initial focus lands on lastMode daily-cta.
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeFocused({
      timeout: 5_000,
    })
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-card-city-guessing-daily-cta')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-unlimited-link')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-close')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeFocused()
  })
})
