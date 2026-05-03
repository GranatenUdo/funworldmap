import { test, expect, type Page } from '@playwright/test'
import { toLocalDateString } from '../src/game/daily/dates'
import { waitForAnimationIdle } from './helpers'

test.setTimeout(60_000)

async function freshTab(page: Page, hash = ''): Promise<void> {
  await page.goto(hash === '' ? '/' : `/${hash}`)
}

test.describe('Launcher — visibility', () => {
  test('appears on cold load at /', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
  })

  test('does NOT appear on cold load at /#FRA (deep-link bypass)', async ({ page }) => {
    await freshTab(page, '#FRA')
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('launcher')).not.toBeVisible()
  })

  test('does NOT appear on cold load at /#game/country-pinning', async ({ page }) => {
    await freshTab(page, '#game/country-pinning')
    await expect(page.getByTestId('launcher')).not.toBeVisible()
  })
})

test.describe('Launcher — dismiss paths', () => {
  test('clicking "Just explore the map" dismisses and focuses search', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-dismiss').click()
    await expect(page.getByTestId('launcher')).not.toBeVisible()
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('typing in search dismisses on first non-empty change', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('search-input').fill('F')
    await expect(page.getByTestId('launcher')).not.toBeVisible({ timeout: 3_000 })
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('focusing search without typing does NOT dismiss', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('search-input').focus()
    await expect(page.getByTestId('search-input')).toBeFocused()
    await expect(page.getByTestId('launcher')).toBeVisible()
  })

  test('pressing Escape dismisses and focuses search', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher')).not.toBeVisible({ timeout: 3_000 })
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('clicking the backdrop area does NOT dismiss', async ({ page }) => {
    await freshTab(page)
    const launcher = page.getByTestId('launcher')
    await expect(launcher).toBeVisible({ timeout: 10_000 })
    const viewport = page.viewportSize() || { width: 1280, height: 720 }
    await page.mouse.click(10, 10)
    await expect(launcher).toBeVisible()
    await page.mouse.click(viewport.width - 10, viewport.height - 10)
    await expect(launcher).toBeVisible()
  })
})

test.describe('Launcher — session scope', () => {
  test('dismissing + reloading re-shows launcher', async ({ page }) => {
    await freshTab(page)
    await page.getByTestId('launcher-dismiss').click()
    await expect(page.getByTestId('launcher')).not.toBeVisible()
    await page.reload()
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
  })

  test('dismissing + closing a country panel does NOT re-show launcher', async ({ page }) => {
    // Quarantined on CI pending tracking issue #31 — country-panel slide-in's
    // staggered child animations keep panel-close (and earlier in the test, the
    // France search-result option) perpetually unstable, so Playwright's click
    // actionability check loops indefinitely. Reproduces 4/4 CI runs; cannot
    // reproduce locally. Runs locally for diagnosis.
    test.fixme(!!process.env.CI, 'tracking issue: https://github.com/GranatenUdo/funworldmap/issues/31')
    await freshTab(page)
    await page.getByTestId('launcher-dismiss').click()
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
  test('play + satellite hidden while launcher visible', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('header-play')).not.toBeVisible()
    await expect(page.getByTestId('satellite-toggle')).not.toBeVisible()
  })

  test('play + satellite restored after dismiss', async ({ page }) => {
    await freshTab(page)
    await page.getByTestId('launcher-dismiss').click()
    await expect(page.getByTestId('header-play')).toBeVisible()
    await expect(page.getByTestId('satellite-toggle')).toBeVisible()
  })

  test('play button re-opens launcher', async ({ page }) => {
    await freshTab(page)
    await page.getByTestId('launcher-dismiss').click()
    await expect(page.getByTestId('launcher')).not.toBeVisible()
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
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute('data-state', 'unplayed')
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeVisible()
  })

  test('played daily state renders the result line', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await page.addInitScript(({ today }) => {
      localStorage.setItem('funworldmap-daily-history', JSON.stringify({
        version: 1,
        streak: { current: 1, longest: 1, lastActiveDate: today, lastMilestoneShown: 0 },
        days: { [today]: { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } } },
      }))
    }, { today })
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
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute('data-state', 'played')
    await expect(page.getByTestId('launcher-card-country-pinning-played-result')).toContainText('87')
  })

  test('unavailable state when daily index fetch fails', async ({ page }) => {
    await page.route('**/daily/index.json', (route) => route.fulfill({ status: 500, body: '' }))
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute('data-state', 'unavailable')
    await expect(page.getByTestId('launcher-card-country-pinning-unavailable')).toBeVisible()
  })

  test('free-mode link starts endless free mode', async ({ page }) => {
    await page.route('**/daily/index.json', (route) => route.fulfill({ status: 500, body: '' }))
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-card-country-pinning-free-link').click()
    await expect(page.getByTestId('launcher')).not.toBeVisible({ timeout: 3_000 })
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toContain('game/country-pinning')
  })
})

test.describe('Launcher — accessibility', () => {
  test('has dialog role + aria-modal + aria-label', async ({ page }) => {
    await freshTab(page)
    const launcher = page.getByTestId('launcher')
    await expect(launcher).toBeVisible({ timeout: 10_000 })
    await expect(launcher).toHaveAttribute('role', 'dialog')
    await expect(launcher).toHaveAttribute('aria-modal', 'true')
    await expect(launcher).toHaveAttribute('aria-label', 'Choose how to play')
  })

  test('initial focus lands on last-played mode card', async ({ page }) => {
    await page.route('**/daily/index.json', (route) => route.fulfill({ status: 404 }))
    await page.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'city-guessing')
    })
    await freshTab(page)
    await expect(page.getByTestId('launcher-card-city-guessing-free-link')).toBeFocused({ timeout: 5_000 })
  })

  test('Tab cycles through mode card 1, mode card 2, dismiss link, wraps', async ({ page }) => {
    await page.route('**/daily/index.json', (route) => route.fulfill({ status: 404 }))
    await page.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'country-pinning')
    })
    await freshTab(page)
    await expect(page.getByTestId('launcher-card-country-pinning-free-link')).toBeFocused({ timeout: 5_000 })
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-card-city-guessing-free-link')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-dismiss')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-card-country-pinning-free-link')).toBeFocused()
  })
})
